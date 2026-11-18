/**
 * Module xử lý Timeline: định dạng file timeline.json, voice.srt và timeline_for_ai.md
 */

import fs from "fs";
import path from "path";

/**
 * Chuyển số giây (float) thành định dạng SRT HH:MM:SS,mmm
 * @param {number} seconds
 * @returns {string}
 */
export function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);

  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Tạo nội dung file SRT từ timeline lines
 * @param {Array<{ id: string, start: number, end: number, voiceEnd?: number, narration?: string }>} lines
 * @param {Array<{ id: string, narration: string }>} scriptLines
 * @returns {string}
 */
export function generateSrtContent(lines, scriptLines = []) {
  const scriptMap = new Map(scriptLines.map((l) => [l.id, l.narration]));

  return lines
    .map((line, index) => {
      const seq = index + 1;
      const text = scriptMap.get(line.id) || line.narration || "";
      // Phụ đề hiển thị theo thời gian giọng đọc kết thúc (voiceEnd) hoặc end
      const endTime = line.voiceEnd || line.end;
      const timeRange = `${formatSrtTime(line.start)} --> ${formatSrtTime(endTime)}`;
      return `${seq}\n${timeRange}\n${text.trim()}\n`;
    })
    .join("\n");
}

/**
 * Tách một đoạn văn bản thành các câu và ước tính mốc thời gian kết thúc từng câu
 * @param {string} text Nguyên văn lời đọc
 * @param {number} lineStart Giờ bắt đầu dòng
 * @param {number} voiceDuration Thời lượng giọng đọc thật
 * @param {Array<{ text: string, start: number, end: number }> | null} words Danh sách từ nếu có
 * @returns {Array<{ text: string, end: number, isEstimated: boolean }>}
 */
export function extractSentenceBreakpoints(text, lineStart, voiceDuration, words = null) {
  if (!text) return [];

  // Tách câu theo dấu chấm, chấm than, hỏi, chấm phẩy
  // Giữ lại dấu ngắt câu
  const rawSentences = text
    .split(/([.!?…;]+)/)
    .reduce((acc, part, idx) => {
      if (idx % 2 === 0) {
        if (part.trim()) acc.push(part.trim());
      } else if (acc.length > 0) {
        acc[acc.length - 1] += part;
      }
      return acc;
    }, [])
    .filter((s) => s.trim().length > 0);

  if (rawSentences.length <= 1) {
    return [];
  }

  const results = [];
  const totalChars = text.replace(/\s+/g, "").length || 1;
  let charAcc = 0;

  for (let i = 0; i < rawSentences.length; i++) {
    const sentence = rawSentences[i];
    const sentenceChars = sentence.replace(/\s+/g, "").length;
    charAcc += sentenceChars;

    // Nếu có mốc từ thực tế từ TTS
    if (words && words.length > 0) {
      // Tìm từ cuối cùng của câu này
      const lastWordText = sentence.trim().split(/\s+/).pop()?.replace(/[.,!?;:]/g, "") || "";
      const matchedWord = words.find((w) => w.text.includes(lastWordText));
      if (matchedWord) {
        results.push({
          text: sentence.trim(),
          end: Number((lineStart + matchedWord.end).toFixed(2)),
          isEstimated: false
        });
        continue;
      }
    }

    // Nếu không có words, ước tính tuyến tính theo tỷ lệ độ dài ký tự
    const ratio = Math.min(1, charAcc / totalChars);
    const estTime = Number((lineStart + voiceDuration * ratio).toFixed(2));
    results.push({
      text: sentence.trim(),
      end: estTime,
      isEstimated: true
    });
  }

  return results;
}

/**
 * Tạo bảng Markdown timeline gửi cho AI (out/timeline_for_ai.md)
 * @param {object} timelineData
 * @param {object} scriptData
 * @returns {string}
 */
export function generateTimelineForAi(timelineData, scriptData) {
  const scriptMap = new Map((scriptData.lines || []).map((l) => [l.id, l.narration]));
  const lines = timelineData.lines || [];

  let md = "# Bảng Timeline Lời Đọc & Gợi Ý Cảnh Cho AI\n\n";
  md += "> **Hướng dẫn cho AI:** Dựa vào bảng mốc thời gian tuyệt đối dưới đây, hãy tạo danh sách cảnh `scenes.json` khớp hoàn toàn với tổng thời lượng, không để hở hay chồng lấn thời gian. Với các dòng dài > 8 giây (được đánh dấu ⚠️), hãy chia thành 2 hoặc nhiều cảnh tương ứng với các mốc ngắt câu được cung cấp.\n\n";
  md += "| STT | ID | Bắt đầu | Kết thúc | Thời lượng | Lời đọc nguyên văn | Ghi chú / Điểm ngắt câu gợi ý |\n";
  md += "| :---: | :---: | :---: | :---: | :---: | :--- | :--- |\n";

  lines.forEach((line, idx) => {
    const stt = idx + 1;
    const narration = scriptMap.get(line.id) || "";
    const duration = (line.end - line.start).toFixed(2);
    const voiceDuration = (line.voiceEnd - line.start).toFixed(2);

    let note = "1 ảnh";
    if (Number(duration) > 8) {
      const sentences = extractSentenceBreakpoints(narration, line.start, Number(voiceDuration), line.words);
      if (sentences.length > 0) {
        const sentenceNotes = sentences
          .map((s, sIdx) => `Câu ${sIdx + 1} hết lúc ~${s.end}s${s.isEstimated ? " (ước lượng)" : ""}`)
          .join("<br>");
        note = `⚠️ **Nên chia ${sentences.length} ảnh**:<br>${sentenceNotes}`;
      } else {
        const halfTime = (line.start + Number(duration) / 2).toFixed(2);
        note = `⚠️ **Nên chia 2 ảnh** (khoảng giữa ~${halfTime}s)`;
      }
    }

    // Thoát ký tự pipe | trong narration để không vỡ bảng
    const safeNarration = narration.replace(/\|/g, "\\|");
    md += `| ${stt} | \`${line.id}\` | **${line.start.toFixed(2)}s** | **${line.end.toFixed(2)}s** | ${duration}s | ${safeNarration} | ${note} |\n`;
  });

  md += "\n---\n";
  md += `**Tổng kết:**\n`;
  md += `- **Tổng số dòng:** ${lines.length} dòng\n`;
  md += `- **Tổng thời lượng video:** **${(timelineData.totalSeconds || 0).toFixed(2)} giây** (${Math.floor((timelineData.totalSeconds || 0) / 60)} phút ${((timelineData.totalSeconds || 0) % 60).toFixed(1)} giây)\n`;

  return md;
}

