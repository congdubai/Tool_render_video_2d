/**
 * Module nạp, giải nén an toàn và thẩm định dự án Thanh Hai 2D Studio do AI tạo ra (AI Code Project Loader)
 * Thiết kế bảo mật cao: Chống Zip Slip, chặn Path Traversal, kiểm soát an toàn file
 */

import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { detectThanhHaiConfig, validateThanhHaiProject } from "./thanhhai-render-adapter.mjs";

// Danh sách phần mở rộng file bị cấm tuyệt đối vì lý do an toàn
const FORBIDDEN_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".sh",
  ".msi",
  ".dll",
  ".scr",
  ".jar"
]);

/**
 * Giải nén file ZIP một cách an toàn vào thư mục đích (Chống Zip Slip & Path Traversal)
 * @param {string | Buffer} zipInput Đường dẫn file ZIP hoặc Buffer
 * @param {string} targetDir Thư mục giải nén
 * @returns {{ success: boolean, extractedFiles: string[], projectRoot: string }}
 */
export function unzipProjectSafe(zipInput, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const normalizedTargetDir = path.resolve(targetDir);

  const zip = Buffer.isBuffer(zipInput) ? new AdmZip(zipInput) : new AdmZip(zipInput);
  const zipEntries = zip.getEntries();
  const extractedFiles = [];

  for (const entry of zipEntries) {
    const rawName = entry.entryName;

    // Bỏ qua các file rác của hệ thống macOS hoặc Windows
    if (rawName.startsWith("__MACOSX/") || rawName.includes("/.DS_Store") || rawName === ".DS_Store") {
      continue;
    }

    // Kiểm tra an toàn: Chặn Path Traversal và Zip Slip
    const safeTarget = path.resolve(normalizedTargetDir, rawName);
    if (!safeTarget.startsWith(normalizedTargetDir + path.sep) && safeTarget !== normalizedTargetDir) {
      throw new Error(`Phát hiện tấn công Zip Slip hoặc đường dẫn bất hợp pháp: "${rawName}"`);
    }

    // Chặn các file nhị phân thực thi nguy hại
    const ext = path.extname(rawName).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      throw new Error(`File ZIP chứa định dạng cấm vì lý do an ninh: "${rawName}"`);
    }

    if (entry.isDirectory) {
      fs.mkdirSync(safeTarget, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(safeTarget), { recursive: true });
      fs.writeFileSync(safeTarget, entry.getData());
      extractedFiles.push(path.relative(normalizedTargetDir, safeTarget).replace(/\\/g, "/"));
    }
  }

  // Tự động kiểm tra và làm phẳng nếu tất cả file bị bao bọc bởi thư mục mẹ chung duy nhất
  const isJunkFileOrDir = (name) => {
    return (
      name.startsWith("__MACOSX") ||
      name === ".DS_Store" ||
      name === "Thumbs.db" ||
      name === "desktop.ini"
    );
  };

  let flattening = true;
  let currentCheckDir = normalizedTargetDir;

  while (flattening) {
    const topItems = fs.readdirSync(currentCheckDir).filter((name) => !isJunkFileOrDir(name));

    if (topItems.length === 1) {
      const singleItemPath = path.join(currentCheckDir, topItems[0]);
      if (fs.statSync(singleItemPath).isDirectory()) {
        const nestedItems = fs.readdirSync(singleItemPath).filter((name) => !isJunkFileOrDir(name));
        for (const item of nestedItems) {
          const oldPath = path.join(singleItemPath, item);
          const newPath = path.join(normalizedTargetDir, item);
          if (fs.existsSync(newPath)) {
            if (fs.statSync(newPath).isDirectory()) {
              fs.rmSync(newPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(newPath);
            }
          }
          fs.renameSync(oldPath, newPath);
        }
        try {
          fs.rmdirSync(singleItemPath);
        } catch (e) {}
        continue;
      }
    }
    flattening = false;
  }

  return {
    success: true,
    extractedFiles,
    projectRoot: normalizedTargetDir
  };
}

/**
 * Quét toàn bộ danh sách file trong thư mục dự án (Bỏ qua node_modules, .git)
 * @param {string} dir
 * @param {string} baseDir
 * @returns {Array<{ path: string, name: string, size: number, isDirectory: boolean }>}
 */
export function listProjectFiles(dir, baseDir = dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "__MACOSX") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      result.push({
        path: relPath,
        name: entry.name,
        size: 0,
        isDirectory: true
      });
      result.push(...listProjectFiles(fullPath, baseDir));
    } else {
      const stats = fs.statSync(fullPath);
      result.push({
        path: relPath,
        name: entry.name,
        size: stats.size,
        isDirectory: false
      });
    }
  }

  return result;
}

/**
 * Đọc cấu hình dự án Thanh Hai 2D Studio
 * @param {string} projectDir
 */
export function detectProjectConfig(projectDir) {
  return detectThanhHaiConfig(projectDir);
}

/**
 * Thẩm định tính toàn vẹn của dự án Thanh Hai 2D Studio
 * @param {string} projectDir
 */
export function validateProject(projectDir) {
  return validateThanhHaiProject(projectDir);
}
