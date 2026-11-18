/**
 * Module phát hiện và quản lý phần cứng GPU (NVIDIA NVENC, Chromium ANGLE)
 * Tự động thích ứng đa máy (RTX 3050, RTX 4050 6GB hoặc CPU thuần)
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Phát hiện thông tin card đồ họa NVIDIA qua nvidia-smi
 * @returns {Promise<{ hasNvidia: boolean, gpuName: string, driverVersion: string, vramTotal: string, error?: string }>}
 */
export async function detectGpu() {
  try {
    const { stdout } = await execAsync(
      "nvidia-smi --query-gpu=gpu_name,driver_version,memory.total --format=csv,noheader,nounits"
    );
    const line = stdout.trim().split("\n")[0];
    if (line) {
      const parts = line.split(",").map((s) => s.trim());
      return {
        hasNvidia: true,
        gpuName: parts[0] || "NVIDIA GPU",
        driverVersion: parts[1] || "Unknown",
        vramTotal: parts[2] ? `${parts[2]} MB` : "Unknown"
      };
    }
  } catch (err) {
    // Không có nvidia-smi hoặc máy không dùng NVIDIA
    return {
      hasNvidia: false,
      gpuName: "Không tìm thấy GPU NVIDIA (Sử dụng CPU)",
      driverVersion: "N/A",
      vramTotal: "N/A",
      error: err.message
    };
  }

  return {
    hasNvidia: false,
    gpuName: "Không tìm thấy GPU NVIDIA",
    driverVersion: "N/A",
    vramTotal: "N/A"
  };
}

/**
 * Lấy cấu hình render tương ứng với chế độ tăng tốc
 * @param {'cpu' | 'gpu_nvenc' | 'gpu_angle'} mode
 * @returns {{ hardwareAcceleration: 'if-possible' | 'disabled', chromiumOptions: object, name: string }}
 */
export function getRenderAccelerationConfig(mode = "cpu") {
  switch (mode) {
    case "gpu_nvenc":
      return {
        name: "Mã hóa bằng GPU (NVENC)",
        hardwareAcceleration: "if-possible",
        chromiumOptions: {}
      };
    case "gpu_angle":
      return {
        name: "Mã hóa và vẽ bằng GPU (NVENC kèm ANGLE)",
        hardwareAcceleration: "if-possible",
        chromiumOptions: {
          gl: process.platform === "linux" ? "angle-egl" : "angle"
        }
      };
    case "cpu":
    default:
      return {
        name: "CPU (Mặc định)",
        hardwareAcceleration: "disabled",
        chromiumOptions: {}
      };
  }
}

