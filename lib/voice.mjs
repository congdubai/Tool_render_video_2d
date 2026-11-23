/**
 * Module tạo giọng đọc TTS bằng Microsoft Edge TTS
 * Sử dụng endpoint Cognitive WebSocket chuẩn (api.msedgeservices.com)
 * Hỗ trợ cache mã băm SHA-256, retry 3 lần, trích xuất mốc từ (WordBoundary),
 * đo thời lượng chính xác và gộp file voice_full.mp3 bằng ffmpeg-static.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import WebSocket from "ws";
import ffmpegStatic from "ffmpeg-static";
import { IsomorphicDRM } from "edge-tts-universal";
import { generateSrtContent, generateTimelineForAi } from "./timeline.mjs";

const execFileAsync = promisify(execFile);
const ffmpegPath = ffmpegStatic;

const EDGE_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${EDGE_TOKEN}`;

/**
 * Tính mã băm SHA-256 cho văn bản + giọng + tốc độ để làm khóa cache
 * @param {string} text
 * @param {string} voice
 * @param {string} rate
 * @returns {string}
 */
export function computeHash(text, voice, rate) {
  return crypto
    .createHash("sha256")
    .update(`${text.trim()}|${voice}|${rate}`)
    .digest("hex");
}

/**
 * Đo thời lượng chính xác của file MP3 bằng ffmpeg
 * @param {string} filePath
 * @returns {Promise<number>} Thời lượng tính bằng giây
 */
export async function getAudioDuration(filePath) {
  try {
    const { stderr } = await execFileAsync(ffmpegPath, ["-i", filePath, "-f", "null", "-"]);
    const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }
  } catch (err) {
    if (err.stderr) {
      const match = err.stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match) {
        const hours = parseFloat(match[1]);
        const minutes = parseFloat(match[2]);
        const seconds = parseFloat(match[3]);
        return hours * 3600 + minutes * 60 + seconds;
      }
    }
    throw new Error(`Không thể đo thời lượng file âm thanh ${filePath}: ${err.message}`);
  }
  return 0;
}

/**
 * Gọi WebSocket tới Edge TTS để tổng hợp giọng nói
 * @param {string} text
 * @param {string} voice
 * @param {string} rate
 * @returns {Promise<{ audio: Buffer, words: Array<{ text: string, start: number, end: number }> }>}
 */
async function callEdgeTtsWs(text, voice, rate) {
  const secMsGec = await IsomorphicDRM.generateSecMsGec();
  const connectId = crypto.randomUUID().replaceAll("-", "");
  const url = `${WSS_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${connectId}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
        Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Accept-Encoding": "gzip, deflate, br"
      }
    });

    const audioChunks = [];
    const words = [];
    const dateStr = new Date().toUTCString();

    const timeout = setTimeout(() => {
      try { ws.close(); } catch (e) {}
      reject(new Error("Hết thời gian chờ (15s) khi kết nối Edge TTS"));
    }, 15000);

    ws.on("open", () => {
      // 1. Gửi cấu hình speech.config
      const configMsg =
        `X-Timestamp:${dateStr}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: "false",
                  wordBoundaryEnabled: "true"
                },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3"
              }
            }
          }
        }) +
        "\r\n";
      ws.send(configMsg);

      // 2. Gửi SSML
      const reqId = crypto.randomUUID().replaceAll("-", "");
      // Thoát các ký tự XML trong text
      const safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rate || "+0%"}' volume='+0%'>${safeText}</prosody></voice></speak>`;
      const ssmlMsg =
        `X-RequestId:${reqId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${dateStr}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml;
      ws.send(ssmlMsg);
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const headerLen = data.readUInt16BE(0);
        const headerStr = data.subarray(2, 2 + headerLen).toString("utf-8");
        if (headerStr.includes("Path:audio")) {
          const audioBody = data.subarray(2 + headerLen);
          if (audioBody.length > 0) {
            audioChunks.push(audioBody);
          }
        }
      } else {
        const str = data.toString("utf-8");
        if (str.includes("Path:audio.metadata")) {
          const bodyIdx = str.indexOf("\r\n\r\n");
          if (bodyIdx !== -1) {
            try {
              const meta = JSON.parse(str.slice(bodyIdx + 4));
              if (meta.Metadata && Array.isArray(meta.Metadata)) {
                for (const item of meta.Metadata) {
                  if (item.Type === "WordBoundary" && item.Data) {
                    words.push({
                      text: item.Data.text?.Text || item.Data.Text || "",
                      start: Number((item.Data.Offset / 1e7).toFixed(3)),
                      end: Number(((item.Data.Offset + item.Data.Duration) / 1e7).toFixed(3))
                    });
                  }
                }
              }
            } catch (e) {}
          }
        } else if (str.includes("Path:turn.end")) {
          clearTimeout(timeout);
          try { ws.close(); } catch (e) {}
          const audioBuffer = Buffer.concat(audioChunks);
          resolve({ audio: audioBuffer, words });
        }
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("unexpected-response", (req, res) => {
      clearTimeout(timeout);
      reject(new Error(`Edge TTS HTTP status lỗi: ${res.statusCode}`));
    });
  });
}

/**
 * Tổng hợp giọng đọc cho một câu duy nhất với cơ chế Retry tối đa 3 lần
 * @param {string} text Lời đọc
 * @param {string} voice Tên giọng
 * @param {string} rate Tốc độ
 * @param {string} outPath File MP3 đầu ra
 * @returns {Promise<{ words: Array<{ text: string, start: number, end: number }> }>}
 */
export async function synthesizeSingleLine(text, voice, rate, outPath) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await callEdgeTtsWs(text, voice, rate);
      if (!res.audio || res.audio.length === 0) {
        throw new Error("Không nhận được dữ liệu âm thanh từ Edge TTS.");
      }

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, res.audio);

      return { words: res.words };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(`Tạo giọng thất bại sau ${maxRetries} lần thử: ${lastError.message}`);
}

/**
 * Gộp toàn bộ file MP3 thành out/voice_full.mp3 có khoảng lặng chính xác giữa các dòng
 * @param {Array<{ audioPath: string, pause: number }>} lineAudioList
 * @param {string} outFullPath
 */
export async function mergeFullAudio(lineAudioList, outFullPath) {
  if (!lineAudioList || lineAudioList.length === 0) return;

  fs.mkdirSync(path.dirname(outFullPath), { recursive: true });

  const inputs = [];
  const filterParts = [];
  const concatInputs = [];

  lineAudioList.forEach((item, idx) => {
    inputs.push("-i", item.audioPath);
    const pauseDur = Math.max(0, item.pause || 0);
    if (pauseDur > 0) {
      filterParts.push(`[${idx}:a]apad=pad_dur=${pauseDur.toFixed(3)}[a${idx}]`);
      concatInputs.push(`[a${idx}]`);
    } else {
      concatInputs.push(`[${idx}:a]`);
    }
  });

  const filterComplex = `${filterParts.join(";")}${filterParts.length > 0 ? ";" : ""}${concatInputs.join("")}concat=n=${lineAudioList.length}:v=0:a=1[outa]`;

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[outa]",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outFullPath
  ];

  await execFileAsync(ffmpegPath, args);
}

/**
 * Quy trình chính: Tạo toàn bộ giọng đọc từ ScriptData, ghi cache, timeline.json, srt, timeline_for_ai.md
 * @param {object} params
 * @param {object} params.scriptData
 * @param {string} [params.projectRoot]
 * @param {string} [params.onlyLineId]
 * @param {(progress: { current: number, total: number, lineId: string, cached: boolean }) => void} [params.onProgress]
 * @returns {Promise<{ timelineData: any, scriptData: any }>}
 */
export async function generateAllVoices({
  scriptData,
  projectRoot = process.cwd(),
  onlyLineId = null,
  onProgress = null
}) {
  const defaultVoice = process.env.EDGE_VOICE || "vi-VN-HoaiMyNeural";
  const defaultRate = process.env.VOICE_RATE || "+0%";
  const voice = scriptData.meta?.voice?.name || defaultVoice;
  const rate = scriptData.meta?.voice?.rate || defaultRate;

  const cacheFilePath = path.join(projectRoot, "out/.tts_cache.json");
  let cache = {};
  if (fs.existsSync(cacheFilePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFilePath, "utf-8"));
    } catch (e) {
      cache = {};
    }
  }

  const lines = scriptData.lines || [];
  const total = lines.length;
  const lineResults = [];
  const audioMergeList = [];

  let currentStart = 0;

  for (let i = 0; i < total; i++) {
    const line = lines[i];
    const lineId = line.id;
    const narration = (line.narration || "").trim();
    const pause = line.pause !== undefined ? Number(line.pause) : 0.35;
    const relAudioPath = `audio/lines/${lineId}.mp3`;
    const fullAudioPath = path.join(projectRoot, "public", relAudioPath);

    const hash = computeHash(narration, voice, rate);
    const isCached = cache[lineId] && cache[lineId].hash === hash && fs.existsSync(fullAudioPath);

    const shouldProcess = !onlyLineId || onlyLineId === lineId;
    let words = null;

    if (shouldProcess) {
      if (isCached) {
        words = cache[lineId].words || null;
        if (onProgress) onProgress({ current: i + 1, total, lineId, cached: true });
      } else {
        const result = await synthesizeSingleLine(narration, voice, rate, fullAudioPath);
        words = result.words;
        cache[lineId] = {
          hash,
          words,
          updatedAt: new Date().toISOString()
        };
        if (onProgress) onProgress({ current: i + 1, total, lineId, cached: false });
      }
    } else {
      words = cache[lineId]?.words || null;
    }

    const voiceDuration = await getAudioDuration(fullAudioPath);
    const start = Number(currentStart.toFixed(3));
    const voiceEnd = Number((start + voiceDuration).toFixed(3));
    const end = Number((voiceEnd + pause).toFixed(3));

    lineResults.push({
      id: lineId,
      start,
      end,
      voiceEnd,
      audio: relAudioPath,
      words: words && words.length > 0 ? words : null
    });

    audioMergeList.push({
      audioPath: fullAudioPath,
      pause
    });

    currentStart = end;
  }

  const timelineData = {
    totalSeconds: Number(currentStart.toFixed(3)),
    lines: lineResults
  };

  // Lưu file cache
  fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), "utf-8");

  // Lưu out/script.json
  const scriptPath = path.join(projectRoot, "out/script.json");
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2), "utf-8");

  // Lưu out/timeline.json
  const timelinePath = path.join(projectRoot, "out/timeline.json");
  fs.writeFileSync(timelinePath, JSON.stringify(timelineData, null, 2), "utf-8");

  // Lưu out/voice.srt
  const srtPath = path.join(projectRoot, "out/voice.srt");
  fs.mkdirSync(path.dirname(srtPath), { recursive: true });
  fs.writeFileSync(srtPath, generateSrtContent(lineResults, lines), "utf-8");

  // Lưu out/timeline_for_ai.md
  const aiMdPath = path.join(projectRoot, "out/timeline_for_ai.md");
  fs.writeFileSync(aiMdPath, generateTimelineForAi(timelineData, scriptData), "utf-8");

  // Gộp audio full
  const fullVoicePath = path.join(projectRoot, "out/voice_full.mp3");
  await mergeFullAudio(audioMergeList, fullVoicePath);

  return { timelineData, scriptData };
}
