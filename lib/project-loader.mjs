/**
 * Module nạp, giải nén an toàn và thẩm định dự án Remotion do AI tạo ra (AI Code Project Loader)
 * Thiết kế bảo mật cao: Chống Zip Slip, chặn Path Traversal, kiểm soát Dependencies và Assets
 */

import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";

// Danh sách các package được cho phép sử dụng an toàn trong dự án Remotion AI
const ALLOWED_PACKAGES = new Set([
  "remotion",
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@remotion/bundler",
  "@remotion/renderer",
  "@remotion/google-fonts",
  "@remotion/media-utils",
  "@remotion/shapes",
  "@remotion/paths",
  "@remotion/transitions",
  "@remotion/motion-blur",
  "@remotion/noise",
  "@remotion/zod-types",
  "@animation",
  "zod",
  "path",
  "fs"
]);

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

  // Tự động kiểm tra xem tất cả file có bị bao bọc bởi 1 thư mục mẹ chung duy nhất không
  let effectiveRoot = normalizedTargetDir;
  const topLevelItems = fs.readdirSync(normalizedTargetDir).filter((name) => {
    return !name.startsWith("__MACOSX") && name !== ".DS_Store";
  });

  if (topLevelItems.length === 1) {
    const candidatePath = path.join(normalizedTargetDir, topLevelItems[0]);
    if (fs.statSync(candidatePath).isDirectory()) {
      // Di chuyển toàn bộ nội dung của thư mục mẹ lên cấp trên để cấu trúc dự án phẳng và chuẩn hóa
      const innerItems = fs.readdirSync(candidatePath);
      for (const item of innerItems) {
        const src = path.join(candidatePath, item);
        const dest = path.join(normalizedTargetDir, item);
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }
        fs.renameSync(src, dest);
      }
      fs.rmSync(candidatePath, { recursive: true, force: true });
    }
  }

  return {
    success: true,
    extractedFiles,
    projectRoot: normalizedTargetDir
  };
}

/**
 * Quét toàn bộ cây thư mục dự án và trả về danh sách file có cấu trúc
 * @param {string} dir
 * @param {string} [baseDir]
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
 * Đọc và trích xuất cấu hình từ project (video.config.json, remotion.config.json, package.json hoặc tự động dò)
 * @param {string} projectDir
 * @returns {{
 *   projectName: string,
 *   entryPoint: string,
 *   compositionId: string,
 *   width: number,
 *   height: number,
 *   fps: number,
 *   durationInFrames: number,
 *   configSource: string
 * }}
 */
export function detectProjectConfig(projectDir) {
  let config = {
    projectName: path.basename(projectDir),
    entryPoint: null,
    compositionId: null,
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    configSource: "default"
  };

  // 1. Thử đọc video.config.json
  const videoConfigPath = path.join(projectDir, "video.config.json");
  if (fs.existsSync(videoConfigPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(videoConfigPath, "utf-8"));
      config = {
        ...config,
        ...raw,
        configSource: "video.config.json"
      };
    } catch (e) {
      console.warn("Lỗi đọc video.config.json:", e.message);
    }
  }

  // 2. Thử đọc remotion.config.json nếu chưa có video.config.json
  const remotionConfigPath = path.join(projectDir, "remotion.config.json");
  if (config.configSource === "default" && fs.existsSync(remotionConfigPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(remotionConfigPath, "utf-8"));
      config = {
        ...config,
        ...raw,
        configSource: "remotion.config.json"
      };
    } catch (e) {}
  }

  // 3. Tự động dò entryPoint nếu chưa có
  if (!config.entryPoint) {
    const candidateEntries = [
      "src/index.ts",
      "src/index.tsx",
      "src/Root.tsx",
      "src/Video.tsx",
      "index.ts",
      "index.tsx"
    ];
    for (const cand of candidateEntries) {
      if (fs.existsSync(path.join(projectDir, cand))) {
        config.entryPoint = cand;
        break;
      }
    }
  }

  // 4. Quét toàn bộ các Composition thực tế được khai báo trong Root.tsx / entryPoint
  const candidateRootFiles = [
    "src/Root.tsx",
    config.entryPoint,
    "src/index.ts",
    "src/index.tsx",
    "src/Video.tsx",
    "Root.tsx",
    "index.ts",
    "index.tsx"
  ].filter(Boolean);

  const scannedCompositions = [];
  const seenCompIds = new Set();

  for (const rf of candidateRootFiles) {
    const absPath = path.join(projectDir, rf);
    if (fs.existsSync(absPath)) {
      try {
        const content = fs.readFileSync(absPath, "utf-8");
        // Tìm tất cả <Composition ... /> hoặc Composition({ ... })
        const compMatches = content.matchAll(/<Composition\s+([^>]+?)\/?>/gi);
        for (const m of compMatches) {
          const propsStr = m[1] || "";
          const idMatch = propsStr.match(/id=["']([^"']+)["']/i);
          if (idMatch && idMatch[1] && !seenCompIds.has(idMatch[1])) {
            const compId = idMatch[1];
            seenCompIds.add(compId);

            const widthMatch = propsStr.match(/width=\{?(\d+)\}?/);
            const heightMatch = propsStr.match(/height=\{?(\d+)\}?/);
            const fpsMatch = propsStr.match(/fps=\{?(\d+)\}?/);
            const durMatch = propsStr.match(/durationInFrames=\{?(\d+)\}?/);

            scannedCompositions.push({
              id: compId,
              width: widthMatch ? parseInt(widthMatch[1], 10) : config.width || 1920,
              height: heightMatch ? parseInt(heightMatch[1], 10) : config.height || 1080,
              fps: fpsMatch ? parseInt(fpsMatch[1], 10) : config.fps || 30,
              durationInFrames: durMatch ? parseInt(durMatch[1], 10) : config.durationInFrames || 300
            });
          }
        }
      } catch (e) {}
    }
  }

  // 5. Đối chiếu compositionId với danh sách thực tế
  config.compositions = scannedCompositions;

  if (scannedCompositions.length > 0) {
    // Nếu có compositionId từ video.config.json nhưng nó không tồn tại trong mã nguồn:
    const matched = scannedCompositions.find((c) => c.id === config.compositionId);
    if (!matched) {
      // Tự động dùng composition thực tế đầu tiên (thay vì ID rác/cũ từ template)
      const realComp = scannedCompositions[0];
      config.compositionId = realComp.id;
      config.width = realComp.width;
      config.height = realComp.height;
      config.fps = realComp.fps;
      config.durationInFrames = realComp.durationInFrames;

      // Đồng bộ lại video.config.json nếu có
      if (fs.existsSync(videoConfigPath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(videoConfigPath, "utf-8"));
          raw.compositionId = realComp.id;
          fs.writeFileSync(videoConfigPath, JSON.stringify(raw, null, 2), "utf-8");
        } catch (e) {}
      }
    } else {
      // Lấy thông số từ composition đã khớp nếu config chưa có
      config.width = config.width || matched.width;
      config.height = config.height || matched.height;
      config.fps = config.fps || matched.fps;
      config.durationInFrames = config.durationInFrames || matched.durationInFrames;
    }
  } else {
    // Mặc định an toàn nếu không tìm thấy thẻ Composition nào
    if (!config.compositionId) config.compositionId = "MainVideo";
    config.compositions = [
      {
        id: config.compositionId,
        width: config.width || 1920,
        height: config.height || 1080,
        fps: config.fps || 30,
        durationInFrames: config.durationInFrames || 300
      }
    ];
  }

  if (!config.entryPoint) config.entryPoint = "src/index.ts";

  // Đảm bảo số nguyên hợp lệ
  config.width = parseInt(config.width, 10) || 1920;
  config.height = parseInt(config.height, 10) || 1080;
  config.fps = parseInt(config.fps, 10) || 30;
  config.durationInFrames = parseInt(config.durationInFrames, 10) || 300;

  // Tự động nhận diện phong cách Stickman Rig V2
  if (!config.characterStyle) {
    const candidateFiles = ["src/Root.tsx", config.entryPoint, "src/index.ts", "src/Video.tsx"].filter(Boolean);
    for (const rf of candidateFiles) {
      const absPath = path.join(projectDir, rf);
      if (fs.existsSync(absPath)) {
        try {
          const content = fs.readFileSync(absPath, "utf-8");
          if (content.includes("@animation") || content.includes("Stickman") || content.includes("stickman-v2")) {
            config.characterStyle = "stickman-v2";
            config.isStickmanV2 = true;
            break;
          }
        } catch (e) {}
      }
    }
  } else if (config.characterStyle === "stickman-v2") {
    config.isStickmanV2 = true;
  }

  return config;
}

/**
 * Quét toàn bộ mã nguồn để tìm kiếm assets được sử dụng và kiểm tra dependencies
 * @param {string} projectDir
 * @returns {{
 *   usedAssets: Set<string>,
 *   usedImports: Set<string>,
 *   tsFiles: string[]
 * }}
 */
function scanSourceCode(projectDir) {
  const srcDir = path.join(projectDir, "src");
  const usedAssets = new Set();
  const usedImports = new Set();
  const tsFiles = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tsx?|jsx?|mjs|cjs)$/i.test(entry.name)) {
        tsFiles.push(fullPath);
        try {
          const code = fs.readFileSync(fullPath, "utf-8");

          // 1. Quét dependencies: import ... from 'pkg' hoặc require('pkg')
          const importMatches = code.matchAll(/(?:import\s+(?:[\w*\s{},]*)\s+from\s+['"]([^'"]+)['"])|(?:require\(['"]([^'"]+)['"]\))/g);
          for (const m of importMatches) {
            const pkg = m[1] || m[2];
            if (pkg && !pkg.startsWith(".") && !pkg.startsWith("/")) {
              // Bóc package name gốc (ví dụ @remotion/google-fonts/Roboto -> @remotion/google-fonts)
              let rootPkg = pkg;
              if (pkg.startsWith("@")) {
                const parts = pkg.split("/");
                rootPkg = parts.length > 1 && parts[1] ? `${parts[0]}/${parts[1]}` : parts[0];
              } else {
                rootPkg = pkg.split("/")[0];
              }
              usedImports.add(rootPkg);
            }
          }

          // 2. Quét assets: staticFile("..."), đường dẫn .png, .jpg, .svg, .mp3, .wav...
          const staticMatches = code.matchAll(/staticFile\(\s*["'`]([^"'`]+)["'`]\s*\)/g);
          for (const m of staticMatches) {
            if (m[1]) usedAssets.add(m[1].replace(/^\//, ""));
          }

          const fileExtMatches = code.matchAll(/["'`]([^"'`\n]+\.(?:png|jpe?g|svg|webp|gif|mp3|wav|ogg|mp4|webm))["'`]/gi);
          for (const m of fileExtMatches) {
            const rawAsset = m[1].replace(/^\//, "");
            // Bỏ qua các URL tuyệt đối http/https
            if (!rawAsset.startsWith("http://") && !rawAsset.startsWith("https://")) {
              usedAssets.add(rawAsset);
            }
          }
        } catch (e) {}
      }
    }
  }

  walk(srcDir);
  return { usedAssets, usedImports, tsFiles };
}

/**
 * Thẩm định toàn diện dự án Remotion do AI tạo ra (Project Validation)
 * Kiểm tra cấu trúc, entrypoint, composition, TypeScript/TSX, assets, dependencies, duration/FPS/resolution
 * @param {string} projectDir
 * @returns {{
 *   valid: boolean,
 *   config: ReturnType<typeof detectProjectConfig>,
 *   files: Array<{ path: string, name: string, size: number, isDirectory: boolean }>,
 *   assets: { found: string[], missing: string[] },
 *   dependencies: { allowed: string[], unknown: string[] },
 *   errors: string[],
 *   warnings: string[]
 * }}
 */
export function validateProject(projectDir) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(projectDir)) {
    return {
      valid: false,
      config: null,
      files: [],
      assets: { found: [], missing: [] },
      dependencies: { allowed: [], unknown: [] },
      errors: [`Thư mục dự án không tồn tại: ${projectDir}`],
      warnings: []
    };
  }

  // 1. Quét danh sách files
  const files = listProjectFiles(projectDir);
  const config = detectProjectConfig(projectDir);

  // 2. Kiểm tra EntryPoint
  const absEntryPoint = path.join(projectDir, config.entryPoint);
  if (!fs.existsSync(absEntryPoint)) {
    errors.push(`Không tìm thấy file entrypoint tại: "${config.entryPoint}". Vui lòng tạo file src/index.ts hoặc src/Root.tsx.`);
  }

  // 3. Kiểm tra Composition ID
  if (!config.compositionId) {
    errors.push("Chưa xác định được compositionId cho dự án (cần khai báo trong video.config.json hoặc thẻ <Composition id='...'>).");
  }

  // 4. Kiểm tra độ phân giải và FPS
  if (config.width <= 0 || config.height <= 0) {
    errors.push(`Độ phân giải không hợp lệ (${config.width}x${config.height}).`);
  } else {
    // Tiêu chuẩn H.264: Chiều rộng và chiều cao phải là số chẵn
    if (config.width % 2 !== 0) {
      warnings.push(`Chiều rộng video (${config.width}px) là số lẻ. Khuyến nghị làm tròn thành ${config.width + 1}px để tương thích H.264.`);
    }
    if (config.height % 2 !== 0) {
      warnings.push(`Chiều cao video (${config.height}px) là số lẻ. Khuyến nghị làm tròn thành ${config.height + 1}px để tương thích H.264.`);
    }
  }

  if (config.fps <= 0 || config.fps > 120) {
    errors.push(`Tỉ lệ khung hình (FPS = ${config.fps}) không hợp lý (nên từ 15 đến 60 fps).`);
  }

  if (config.durationInFrames <= 0) {
    errors.push(`Thời lượng (durationInFrames = ${config.durationInFrames}) phải lớn hơn 0.`);
  }

  // 5. Quét mã nguồn và kiểm tra dependencies + assets
  const { usedAssets, usedImports, tsFiles } = scanSourceCode(projectDir);

  if (tsFiles.length === 0) {
    errors.push("Thư mục src/ không chứa bất kỳ file mã nguồn TypeScript/JavaScript nào (.ts, .tsx, .js).");
  }

  // Kiểm tra cú pháp cơ bản của file TSX (tìm các thẻ JSX chưa đóng hoặc lỗi cú pháp trắng trợn)
  for (const file of tsFiles) {
    try {
      const code = fs.readFileSync(file, "utf-8");
      // Kiểm tra sơ bộ dấu ngoặc nhọn / ngoặc tròn cân đối
      let curly = 0;
      let paren = 0;
      for (const char of code) {
        if (char === "{") curly++;
        if (char === "}") curly--;
        if (char === "(") paren++;
        if (char === ")") paren--;
      }
      if (curly !== 0) {
        warnings.push(`File "${path.relative(projectDir, file)}" có thể bị mất cân bằng dấu ngoặc nhọn { } (chênh lệch: ${curly}).`);
      }
    } catch (e) {
      warnings.push(`Không thể đọc file "${path.relative(projectDir, file)}": ${e.message}`);
    }
  }

  // Phân loại dependencies
  const allowed = [];
  const unknown = [];
  for (const pkg of usedImports) {
    if (ALLOWED_PACKAGES.has(pkg)) {
      allowed.push(pkg);
    } else {
      unknown.push(pkg);
      warnings.push(`Dự án sử dụng thư viện lạ "${pkg}" chưa được cấu hình sẵn trong tool. Quá trình bundle có thể gặp lỗi nếu thiếu thư viện này.`);
    }
  }

  // Kiểm tra assets trong thư mục public/
  const publicDir = path.join(projectDir, "public");
  const foundAssets = [];
  const missingAssets = [];

  for (const asset of usedAssets) {
    const assetPathInProject = path.join(publicDir, asset);
    const assetPathInTool = path.join(process.cwd(), "public", asset);

    if (fs.existsSync(assetPathInProject)) {
      foundAssets.push(asset);
    } else if (fs.existsSync(assetPathInTool)) {
      // Tái sử dụng được từ thư mục public của tool chính
      foundAssets.push(`${asset} (kế thừa từ tool)`);
    } else {
      missingAssets.push(asset);
      warnings.push(`Asset chưa có trong thư mục public/: "${asset}". Video có thể không hiển thị được tài nguyên này.`);
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    config,
    compositions: config.compositions || [],
    files,
    assets: {
      found: foundAssets,
      missing: missingAssets
    },
    dependencies: {
      allowed,
      unknown
    },
    errors,
    warnings
  };
}

