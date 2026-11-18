/**
 * Script CLI: Tạo giọng đọc và bảng timeline cho AI
 * Lệnh: npm run voice
 * Tùy chọn: npm run voice -- --only=line_001
 */

import fs from "fs";
import path from "path";
import { generateAllVoices } from "../lib/voice.mjs";

async function main() {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "src/data/script.json");

  // Đọc cờ --only=line_xxx nếu có
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyLineId = onlyArg ? onlyArg.split("=")[1] : null;

  let scriptData;
  if (!fs.existsSync(scriptPath)) {
    console.log("ℹ️ Chưa có src/data/script.json, tự động khởi tạo dữ liệu mẫu kiểm thử...");
    scriptData = {
      meta: {
        width: 1280,
        height: 720,
        fps: 30,
        music: null,
        musicVolume: 0.08,
        fadeSeconds: 0.3,
        voice: {
          provider: "edge",
          name: "vi-VN-HoaiMyNeural",
          rate: "+0%"
        }
      },
      lines: [
        {
          id: "line_001",
          narration: "Sáng hôm sau, bạn tỉnh dậy trong một căn phòng không phải của mình.",
          pause: 0.35
        },
        {
          id: "line_002",
          narration: "Bạn nhìn xung quanh và nhận ra mọi đồ vật đều lơ lửng giữa không trung một cách kỳ lạ, như thể trọng lực của cả căn phòng đã hoàn toàn biến mất không để lại dấu vết.",
          pause: 0.35
        }
      ]
    };
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2), "utf-8");
  } else {
    try {
      scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
    } catch (err) {
      console.error("❌ File src/data/script.json bị lỗi cú pháp:", err.message);
      process.exit(1);
    }
  }

  console.log(`🎙️ Bắt đầu tạo giọng đọc cho ${scriptData.lines.length} dòng...`);
  if (onlyLineId) {
    console.log(`🎯 Chỉ tạo lại riêng cho dòng: ${onlyLineId}`);
  }

  const startTime = Date.now();

  try {
    const { timelineData } = await generateAllVoices({
      scriptData,
      projectRoot,
      onlyLineId,
      onProgress: ({ current, total, lineId, cached }) => {
        const tag = cached ? "⚡ [Cache]" : "🌐 [Tạo mới]";
        console.log(`[${current}/${total}] ${tag} ${lineId}`);
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Thành công trong ${elapsed}s!`);
    console.log(`📊 Tổng thời lượng video: ${timelineData.totalSeconds} giây (${timelineData.lines.length} dòng)`);
    console.log(`📁 Các file đã được tạo:`);
    console.log(`  - src/data/timeline.json`);
    console.log(`  - out/timeline_for_ai.md`);
    console.log(`  - out/voice.srt`);
    console.log(`  - out/voice_full.mp3`);
  } catch (err) {
    console.error(`\n❌ Lỗi khi tạo giọng đọc:`, err.message);
    process.exit(1);
  }
}

main();

