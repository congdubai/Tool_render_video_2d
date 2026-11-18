/**
 * Module xử lý xóa nền trắng nhân vật thông minh bằng thuật toán Flood Fill từ 4 cạnh
 * Giữ nguyên các vùng trắng bên trong viền đen (mắt, mặt, áo) và các chi tiết tách rời như dấu '?'
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Xử lý tách nền cho một file ảnh
 * @param {string} inputPath Đường dẫn file ảnh gốc
 * @param {string} outputPath Đường dẫn file PNG trong suốt xuất ra
 * @param {object} options
 * @param {number} [options.threshold=235] Ngưỡng màu coi là trắng (0-255)
 * @param {number} [options.feather=1] Bán kính làm mềm mép alpha (pixel)
 * @returns {Promise<{ filename: string, origWidth: number, origHeight: number, newWidth: number, newHeight: number }>}
 */
export async function processCutoutImage(inputPath, outputPath, options = {}) {
  const threshold = options.threshold !== undefined ? options.threshold : 235;

  // Đọc ảnh và chuyển thành raw RGBA buffer
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const origWidth = metadata.width;
  const origHeight = metadata.height;

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const totalPixels = width * height;

  // Mảng đánh dấu pixel nền ngoài (liên thông với 4 mép)
  // 1: là nền ngoài (sẽ xóa alpha = 0), 0: là chi tiết giữ lại
  const isOuterBg = new Uint8Array(totalPixels);

  // Hàm kiểm tra xem pixel có được coi là màu "trắng nền" không
  const isWhite = (x, y) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a < 20) return true; // Đã trong suốt
    return r >= threshold && g >= threshold && b >= threshold;
  };

  // Hàng đợi cho thuật toán BFS Flood Fill
  // Dùng Int32Array phẳng để tối ưu tốc độ và không tràn RAM
  const queue = new Int32Array(totalPixels);
  let qHead = 0;
  let qTail = 0;

  // Đưa các pixel thỏa mãn điều kiện ở 4 mép biên vào hàng đợi
  // Mép trên và dưới
  for (let x = 0; x < width; x++) {
    // Mép trên (y = 0)
    if (isWhite(x, 0)) {
      const idx = 0 * width + x;
      if (!isOuterBg[idx]) {
        isOuterBg[idx] = 1;
        queue[qTail++] = idx;
      }
    }
    // Mép dưới (y = height - 1)
    if (isWhite(x, height - 1)) {
      const idx = (height - 1) * width + x;
      if (!isOuterBg[idx]) {
        isOuterBg[idx] = 1;
        queue[qTail++] = idx;
      }
    }
  }

  // Mép trái và phải
  for (let y = 0; y < height; y++) {
    // Mép trái (x = 0)
    if (isWhite(0, y)) {
      const idx = y * width + 0;
      if (!isOuterBg[idx]) {
        isOuterBg[idx] = 1;
        queue[qTail++] = idx;
      }
    }
    // Mép phải (x = width - 1)
    if (isWhite(width - 1, y)) {
      const idx = y * width + (width - 1);
      if (!isOuterBg[idx]) {
        isOuterBg[idx] = 1;
        queue[qTail++] = idx;
      }
    }
  }

  // 4 hướng di chuyển: trên, dưới, trái, phải
  const dx = [0, 0, -1, 1];
  const dy = [-1, 1, 0, 0];

  // Tiến hành loang (BFS Flood Fill) từ các mép vào trong
  while (qHead < qTail) {
    const currIdx = queue[qHead++];
    const cx = currIdx % width;
    const cy = Math.floor(currIdx / width);

    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d];
      const ny = cy + dy[d];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!isOuterBg[nIdx] && isWhite(nx, ny)) {
          isOuterBg[nIdx] = 1;
          queue[qTail++] = nIdx;
        }
      }
    }
  }

  // Cập nhật kênh Alpha cho các pixel
  // Đồng thời tìm bounding box của các chi tiết giữ lại
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pIdx = y * width + x;
      const bIdx = pIdx * 4;

      if (isOuterBg[pIdx]) {
        // Thuộc vùng trắng ngoài mép -> xóa hoàn toàn
        data[bIdx + 3] = 0;
      } else {
        // Thuộc chi tiết giữ lại (kể cả phần trắng bên trong nét vẽ)
        // Cập nhật bounding box
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Nếu ảnh không còn chi tiết nào (hoàn toàn trắng), giữ khung gốc
  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = width - 1;
    maxY = height - 1;
  }

  // Thêm lề padding 1px cho bounding box
  const pad = 1;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(width - cropX, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - cropY, maxY - minY + 1 + pad * 2);

  // Đảm bảo thư mục đích tồn tại
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Crop sát khung bao và làm mềm nhẹ bằng sharp
  await sharp(data, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .extract({
      left: cropX,
      top: cropY,
      width: cropW,
      height: cropH
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toFile(outputPath);

  return {
    filename: path.basename(outputPath),
    origWidth,
    origHeight,
    newWidth: cropW,
    newHeight: cropH
  };
}

