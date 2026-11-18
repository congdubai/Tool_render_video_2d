/**
 * Module kiểm tra tính hợp lệ của dữ liệu (script.json, timeline.json, scenes.json)
 * Tuyệt đối không dùng eval / Function. Kiểm tra an toàn đường dẫn chống Path Traversal.
 */

import fs from "fs";
import path from "path";

/**
 * Kiểm tra chuỗi JSON có hợp lệ không một cách an toàn
 * @param {string} jsonString
 * @param {string} fileName
 * @returns {{ data: any, error: string | null }}
 */
export function safeParseJson(jsonString, fileName = "JSON") {
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    return { data: null, error: `${fileName} đang để trống hoặc không hợp lệ.` };
  }
  try {
    const data = JSON.parse(jsonString);
    return { data, error: null };
  } catch (err) {
    // Trích xuất vị trí dòng và cột từ lỗi parse nếu có
    const message = err.message || "Cú pháp không hợp lệ";
    return {
      data: null,
      error: `Lỗi cú pháp trong ${fileName}: ${message}`
    };
  }
}

/**
 * Kiểm tra tên file/đường dẫn an toàn, chống Path Traversal
 * @param {string} filePath Đường dẫn tương đối
 * @param {string} baseDir Thư mục gốc an toàn
 * @returns {boolean} true nếu hợp lệ, false nếu có dấu hiệu tấn công thư mục
 */
export function isSafePath(filePath, baseDir = process.cwd()) {
  if (!filePath || typeof filePath !== "string") return false;
  // Chặn null bytes và các ký tự nguy hiểm
  if (filePath.includes("\0")) return false;
  
  // Chuẩn hóa và kiểm tra đường dẫn giải quyết xong có nằm trong baseDir không
  const resolved = path.resolve(baseDir, filePath);
  const normalizedBase = path.resolve(baseDir);
  return resolved.startsWith(normalizedBase);
}

/**
 * Kiểm tra toàn bộ dữ liệu dựng video trước khi render
 * @param {object} params
 * @param {object} params.scriptData Dữ liệu script.json
 * @param {object} params.timelineData Dữ liệu timeline.json
 * @param {object} params.scenesData Dữ liệu scenes.json
 * @param {string} [params.projectRoot] Thư mục gốc dự án
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAllData({ scriptData, timelineData, scenesData, projectRoot = process.cwd() }) {
  const errors = [];
  const warnings = [];

  // 1. Kiểm tra timelineData
  if (!timelineData || !Array.isArray(timelineData.lines)) {
    errors.push("Dữ liệu timeline (timeline.json) không hợp lệ hoặc thiếu danh sách 'lines'.");
    return { valid: false, errors, warnings };
  }

  const totalSeconds = Number(timelineData.totalSeconds) || 0;
  if (totalSeconds <= 0) {
    errors.push(`Tổng thời lượng video trong timeline.json không hợp lệ (${totalSeconds}s).`);
  }

  // Tập hợp các line ID để kiểm tra tham chiếu
  const validLineIds = new Set(timelineData.lines.map((l) => l.id));

  // 2. Kiểm tra scenesData
  if (!scenesData || !Array.isArray(scenesData.scenes)) {
    errors.push("Dữ liệu cảnh (scenes.json) không hợp lệ hoặc thiếu mảng 'scenes'.");
    return { valid: false, errors, warnings };
  }

  if (scenesData.scenes.length === 0) {
    errors.push("Danh sách cảnh trong scenes.json đang trống.");
    return { valid: false, errors, warnings };
  }

  // Sắp xếp các cảnh theo thứ tự start tăng dần để kiểm tra hở/chồng
  const sortedScenes = [...scenesData.scenes].sort((a, b) => a.start - b.end);

  // Kiểm tra cảnh đầu tiên phải bắt đầu từ 0
  const firstScene = sortedScenes[0];
  if (Math.abs(firstScene.start - 0) > 0.05) {
    errors.push(`Cảnh đầu tiên (${firstScene.id}) phải bắt đầu từ 0s (hiện tại: ${firstScene.start}s).`);
  }

  // Duyệt qua từng cảnh để kiểm tra tính liên tục và tài nguyên
  for (let i = 0; i < sortedScenes.length; i++) {
    const scene = sortedScenes[i];
    const sceneIdx = i + 1;

    // Kiểm tra định dạng thời gian của cảnh
    if (typeof scene.start !== "number" || typeof scene.end !== "number") {
      errors.push(`Cảnh ${scene.id || sceneIdx} thiếu hoặc sai định dạng start/end.`);
      continue;
    }

    if (scene.end <= scene.start) {
      errors.push(`Cảnh ${scene.id || sceneIdx} có thời gian kết thúc (${scene.end}s) nhỏ hơn hoặc bằng thời gian bắt đầu (${scene.start}s).`);
    }

    const duration = scene.end - scene.start;
    // Cảnh báo thời lượng
    if (duration > 10) {
      warnings.push(`Cảnh ${scene.id || sceneIdx} dài hơn 10 giây (${duration.toFixed(1)}s), nên cân nhắc chia nhỏ ảnh để tránh nhàm chán.`);
    } else if (duration < 1.5) {
      warnings.push(`Cảnh ${scene.id || sceneIdx} ngắn hơn 1.5 giây (${duration.toFixed(1)}s), chuyển cảnh có thể quá nhanh.`);
    }

    // Kiểm tra liên tục giữa 2 cảnh kế tiếp (không hở, không chồng)
    if (i > 0) {
      const prevScene = sortedScenes[i - 1];
      const diff = scene.start - prevScene.end;
      const epsilon = 0.05; // Dung sai 50ms cho số thực
      if (diff > epsilon) {
        errors.push(`Phát hiện khoảng hở thời gian (${diff.toFixed(2)}s) giữa cảnh ${prevScene.id} (kết thúc ${prevScene.end}s) và cảnh ${scene.id} (bắt đầu ${scene.start}s).`);
      } else if (diff < -epsilon) {
        errors.push(`Phát hiện thời gian chồng lấn (${Math.abs(diff).toFixed(2)}s) giữa cảnh ${prevScene.id} (kết thúc ${prevScene.end}s) và cảnh ${scene.id} (bắt đầu ${scene.start}s).`);
      }
    }

    // Kiểm tra tham chiếu line nếu có
    if (scene.line && !validLineIds.has(scene.line)) {
      errors.push(`Cảnh ${scene.id || sceneIdx} tham chiếu đến dòng lời đọc '${scene.line}' không tồn tại trong timeline.json.`);
    }

    // Kiểm tra file ảnh nền
    if (!scene.bg) {
      errors.push(`Cảnh ${scene.id || sceneIdx} chưa khai báo ảnh nền ('bg').`);
    } else {
      if (!isSafePath(scene.bg, path.join(projectRoot, "public"))) {
        errors.push(`Đường dẫn ảnh nền '${scene.bg}' ở cảnh ${scene.id} không an toàn (phát hiện Path Traversal).`);
      } else {
        const bgFullPath = path.resolve(projectRoot, "public", scene.bg);
        if (!fs.existsSync(bgFullPath)) {
          errors.push(`Không tìm thấy file ảnh nền: public/${scene.bg} (ở cảnh ${scene.id || sceneIdx}).`);
        }
      }
    }

    // Kiểm tra file ảnh nhân vật nếu có
    if (scene.character && scene.character.image) {
      const charImg = scene.character.image;
      if (!isSafePath(charImg, path.join(projectRoot, "public"))) {
        errors.push(`Đường dẫn ảnh nhân vật '${charImg}' ở cảnh ${scene.id} không an toàn.`);
      } else {
        const charFullPath = path.resolve(projectRoot, "public", charImg);
        if (!fs.existsSync(charFullPath)) {
          errors.push(`Không tìm thấy file ảnh nhân vật: public/${charImg} (ở cảnh ${scene.id || sceneIdx}).`);
        }
      }
    }

    // Kiểm tra file ảnh tiền cảnh (foreground) nếu có
    if (scene.foreground && scene.foreground.image) {
      const fgImg = scene.foreground.image;
      if (!isSafePath(fgImg, path.join(projectRoot, "public"))) {
        errors.push(`Đường dẫn ảnh foreground '${fgImg}' ở cảnh ${scene.id} không an toàn.`);
      } else {
        const fgFullPath = path.resolve(projectRoot, "public", fgImg);
        if (!fs.existsSync(fgFullPath)) {
          errors.push(`Không tìm thấy file ảnh foreground: public/${fgImg} (ở cảnh ${scene.id || sceneIdx}).`);
        }
      }
    }
  }

  // Kiểm tra cảnh cuối cùng có phủ hết totalSeconds không
  const lastScene = sortedScenes[sortedScenes.length - 1];
  if (lastScene) {
    const endDiff = Math.abs(lastScene.end - totalSeconds);
    if (endDiff > 0.1) {
      errors.push(`Cảnh cuối cùng (${lastScene.id}) kết thúc lúc ${lastScene.end}s, không khớp với tổng thời lượng timeline (${totalSeconds}s). Chênh lệch: ${endDiff.toFixed(2)}s.`);
    }
  }

  // 3. Kiểm tra tính đồng bộ thời gian giữa script.json và timeline.json nếu có file trên đĩa
  try {
    const scriptPath = path.join(projectRoot, "src/data/script.json");
    const timelinePath = path.join(projectRoot, "src/data/timeline.json");
    if (fs.existsSync(scriptPath) && fs.existsSync(timelinePath)) {
      const scriptStat = fs.statSync(scriptPath);
      const timelineStat = fs.statSync(timelinePath);
      if (scriptStat.mtimeMs > timelineStat.mtimeMs + 1000) {
        warnings.push("File script.json mới hơn timeline.json. Hãy chạy lại chức năng Tạo giọng đọc để cập nhật timeline mới nhất!");
      }
    }
  } catch (e) {
    // Bỏ qua lỗi đọc file thời gian
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Rút trích danh sách tất cả file ảnh cần có từ scenes.json
 * @param {object} scenesData
 * @param {string} [projectRoot]
 * @returns {Array<{ type: 'bg'|'character'|'foreground', path: string, exists: boolean }>}
 */
export function extractRequiredAssets(scenesData, projectRoot = process.cwd()) {
  const assets = [];
  const seenPaths = new Set();

  if (!scenesData || !Array.isArray(scenesData.scenes)) {
    return assets;
  }

  const addAsset = (type, relPath) => {
    if (!relPath || seenPaths.has(relPath)) return;
    seenPaths.add(relPath);
    const fullPath = path.resolve(projectRoot, "public", relPath);
    assets.push({
      type,
      path: relPath,
      exists: fs.existsSync(fullPath)
    });
  };

  for (const scene of scenesData.scenes) {
    if (scene.bg) addAsset("bg", scene.bg);
    if (scene.character && scene.character.image) addAsset("character", scene.character.image);
    if (scene.foreground && scene.foreground.image) addAsset("foreground", scene.foreground.image);
  }

  return assets;
}

