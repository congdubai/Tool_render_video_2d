import { renderDynamicVideo } from "../lib/dynamic-render.mjs";
import path from "path";

async function main() {
  console.log("=== BẮT ĐẦU RENDER VIDEO 30S MULTI-SCENE STICKMAN RIG V2 ===");
  const outPath = path.resolve("out/stickman-v2-long-storyboard-30s.mp4");
  const startTime = Date.now();

  const result = await renderDynamicVideo({
    projectDir: path.resolve("sample-projects/stickman-v2-long-storyboard"),
    outputPath: outPath,
    onProgress: (p) => {
      const pct = Math.round(p.progress * 100);
      process.stdout.write(`\rTiến độ: ${pct}% (${p.renderedFrames}/${p.totalFrames} frames)`);
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== RENDER THÀNH CÔNG TRONG ${durationSec} GIÂY ===`);
  console.log("File xuất ra:", result.outputPath);
}

main().catch((err) => {
  console.error("Lỗi khi render:", err);
  process.exit(1);
});
