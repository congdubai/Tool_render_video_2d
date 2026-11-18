/**
 * Script CLI: Kiểm tra phần cứng GPU NVIDIA và khả năng hỗ trợ Chrome
 * Lệnh: npm run gpu-check
 */

import { detectGpu } from "../lib/gpu.mjs";

async function main() {
  console.log("🔍 Đang kiểm tra cấu hình phần cứng GPU...");
  const gpuInfo = await detectGpu();

  console.log("\n================ KẾT QUẢ KIỂM TRA GPU ================");
  if (gpuInfo.hasNvidia) {
    console.log(`✅ Phát hiện GPU NVIDIA: ${gpuInfo.gpuName}`);
    console.log(`📌 Phiên bản Driver:    ${gpuInfo.driverVersion}`);
    console.log(`💾 Tổng bộ nhớ VRAM:     ${gpuInfo.vramTotal}`);
    console.log(`⚡ Hỗ trợ phần cứng:    NVENC (H.264 / HEVC) & ANGLE Backend`);
  } else {
    console.log(`ℹ️ Không tìm thấy GPU NVIDIA hoặc nvidia-smi.`);
    console.log(`⚙️ Hệ thống sẽ dựng video hoàn toàn bằng CPU đa luồng (Đảm bảo 100% ổn định).`);
  }
  console.log("======================================================\n");
}

main().catch(console.error);

