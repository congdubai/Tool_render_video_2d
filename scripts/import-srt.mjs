/**
 * Script CLI: Nhập giọng đọc và file SRT có sẵn từ nơi khác
 * Lệnh: node scripts/import-srt.mjs --file=path/to/sub.srt --voice=public/audio/voice.mp3 [--force]
 */

import fs from "fs";
import path from "path";

/**
 * Chuyển đổi chuỗi thời gian SRT HH:MM:SS,mmm thành số giây (float)
 * @param {string} timeStr
 * @returns {number}
 */
function parseSrtTimeToSeconds(timeStr) {
  const parts = timeStr.trim().split(":");
  if (parts.length < 3) return 0;
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const secParts = parts[2].split(",");
  const seconds = parseFloat(secParts[0]);
  const ms = secParts[1] ? parseFloat(secParts[1]) : 0;
  return Number((hours * 3600 + minutes * 60 + seconds + ms / 1000).toFixed(3));
}

async function main() {
  const projectRoot = process.cwd();
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const voiceArg = process.argv.find((a) => a.startsWith("--voice="));
  const isForce = process.argv.includes("--force");

  if (!fileArg) {
    console.error("❌ Thiếu tham số --file=<duong_dan_file.srt>");
    console.log("Ví dụ: node scripts/import-srt.mjs --file=samples/sample.srt --voice=audio/full.mp3 --force");
    process.exit(1);
  }

  const srtPath = path.resolve(projectRoot, fileArg.split("=")[1]);
  if (!fs.existsSync(srtPath)) {
    console.error(`❌ Không tìm thấy file SRT: ${srtPath}`);
    process.exit(1);
  }

  const scriptDest = path.join(projectRoot, "src/data/script.json");
  const timelineDest = path.join(projectRoot, "src/data/timeline.json");

  if ((fs.existsSync(scriptDest) || fs.existsSync(timelineDest)) && !isForce) {
    console.error("⚠️ File script.json hoặc timeline.json đã tồn tại. Dùng thêm cờ --force để ghi đè.");
    process.exit(1);
  }

  const srtRaw = fs.readFileSync(srtPath, "utf-8");
  // Tách các khối SRT (phân tách bởi dòng trống)
  const blocks = srtRaw.split(/\r?\n\r?\n/).filter((b) => b.trim().length > 0);

  const scriptLines = [];
  const timelineLines = [];
  let maxEndTime = 0;

  blocks.forEach((block, index) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;

    // Dòng 1: STT
    // Dòng 2: 00:00:01,000 --> 00:00:04,500
    // Dòng 3+: Nội dung phụ đề
    const timeLine = lines[1].includes("-->") ? lines[1] : lines[0];
    const textLines = lines.slice(lines[1].includes("-->") ? 2 : 1).join(" ");

    const match = timeLine.match(/(\d+:\d+:\d+,\d+)\s*-->\s*(\d+:\d+:\d+,\d+)/);
    if (!match) return;

    const start = parseSrtTimeToSeconds(match[1]);
    const end = parseSrtTimeToSeconds(match[2]);
    const id = `line_${String(index + 1).padStart(3, "0")}`;

    if (end > maxEndTime) maxEndTime = end;

    scriptLines.push({
      id,
      narration: textLines,
      pause: 0.35
    });

    timelineLines.push({
      id,
      start,
      end,
      voiceEnd: end,
      audio: voiceArg ? voiceArg.split("=")[1] : `audio/lines/${id}.mp3`,
      words: null
    });
  });

  const scriptData = {
    meta: {
      width: 1280,
      height: 720,
      fps: 30,
      music: null,
      musicVolume: 0.08,
      fadeSeconds: 0.3,
      voice: { provider: "external", name: "ExternalVoice", rate: "+0%" },
      externalVoice: voiceArg ? voiceArg.split("=")[1] : null
    },
    lines: scriptLines
  };

  const timelineData = {
    totalSeconds: maxEndTime,
    lines: timelineLines
  };

  fs.mkdirSync(path.dirname(scriptDest), { recursive: true });
  fs.writeFileSync(scriptDest, JSON.stringify(scriptData, null, 2), "utf-8");
  fs.writeFileSync(timelineDest, JSON.stringify(timelineData, null, 2), "utf-8");

  console.log(`✅ Đã nhập thành công ${scriptLines.length} mục từ file SRT vào timeline.json và script.json!`);
  console.log(`📊 Tổng thời lượng: ${maxEndTime}s`);
}

main().catch(console.error);

