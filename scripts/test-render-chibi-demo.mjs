import path from "node:path";
import fs from "node:fs";
import { detectProjectConfig, validateProject } from "../lib/project-loader.mjs";
import { getProjectCompositions, renderDynamicStill, renderDynamicVideo } from "../lib/dynamic-render.mjs";

async function main() {
  console.log("=== BẮT ĐẦU KIỂM THỬ CHIBI ENGINE DEMO 10S ===");
  const projectDir = path.resolve("./sample-projects/chibi-engine-demo-10s");

  console.log("1. Kiểm tra cấu hình và Validation...");
  const config = detectProjectConfig(projectDir);
  console.log("Detected config:", {
    compositionId: config.compositionId,
    fps: config.fps,
    width: config.width,
    height: config.height,
    durationInFrames: config.durationInFrames,
    compositions: config.compositions
  });

  const val = validateProject(projectDir);
  console.log("Validation valid:", val.valid, "Errors:", val.errors);
  if (!val.valid) throw new Error("Validation failed: " + JSON.stringify(val.errors));

  console.log("\n2. Đọc Composition thực tế bằng Remotion runtime...");
  const comps = await getProjectCompositions({ projectDir });
  console.log("Remotion dynamic compositions:", comps);
  if (!comps.some(c => c.id === "ChibiEngineDemo10s")) {
    throw new Error("Missing ChibiEngineDemo10s composition in bundle!");
  }
  console.log("✅ Composition ID 'ChibiEngineDemo10s' tồn tại chính xác trong bundle!");

  console.log("\n3. Soi và Render 3 Frame kiểm thử...");
  // Test các frame đặc trưng:
  // Frame 60: Đi bộ (Walk)
  // Frame 180: Đứng yên (Idle)
  // Frame 240: Vẫy chào (Wave)
  const framesToTest = [
    { frame: 60, name: "test_chibi_walk_f60.png", desc: "Đi bộ (Walk) - tay vung ngược pha" },
    { frame: 180, name: "test_chibi_idle_f180.png", desc: "Đứng yên (Idle) - thở nhẹ, chớp mắt" },
    { frame: 240, name: "test_chibi_wave_f240.png", desc: "Vẫy tay (Wave) - giơ tay chào, đầu nghiêng" }
  ];

  for (const item of framesToTest) {
    const outPath = path.resolve(`./output_videos/${item.name}`);
    await renderDynamicStill({
      projectDir,
      frame: item.frame,
      compositionId: "ChibiEngineDemo10s",
      outputPath: outPath,
    });
    console.log(`✅ Đã chụp frame ${item.frame} (${item.desc}) -> ${item.name} (${fs.statSync(outPath).size} bytes)`);
  }

  console.log("\n4. Render toàn bộ Video MP4 10s (300 frames, 1920x1080)...");
  const outputMp4 = path.resolve("./output_videos/chibi-engine-demo-10s.mp4");
  const renderRes = await renderDynamicVideo({
    projectDir,
    compositionId: "ChibiEngineDemo10s",
    outputPath: outputMp4,
    onProgress: (p) => {
      const pct = Math.round(p.progress * 100);
      if (pct % 20 === 0) {
        console.log(`Tiến độ render: ${pct}% (${p.renderedFrames}/${p.totalFrames} frames)`);
      }
    }
  });

  console.log("✅ Render video MP4 thành công rực rỡ!", {
    outputPath: renderRes.outputPath,
    fileSize: `${(fs.statSync(outputMp4).size / (1024 * 1024)).toFixed(2)} MB`,
    duration: renderRes.durationInFrames
  });

  console.log("\n=== TẤT CẢ KIỂM THỬ THÀNH CÔNG! ===");
}

main().catch((err) => {
  console.error("❌ Kiểm thử thất bại:", err);
  process.exit(1);
});

