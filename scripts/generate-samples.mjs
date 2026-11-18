/**
 * Script tạo dữ liệu ảnh mẫu chuẩn trong samples/ để kiểm thử tự động
 * 1. Ảnh nền phòng ngủ 1280x720
 * 2. Ảnh nhân vật nền trắng có mặt trắng, áo trắng và dấu '?' lơ lửng
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

async function generateSampleAssets() {
  const projectRoot = process.cwd();
  const samplesDir = path.join(projectRoot, "samples");
  const rawDir = path.join(projectRoot, "raw/characters");
  const bgDir = path.join(projectRoot, "public/backgrounds");

  fs.mkdirSync(samplesDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(bgDir, { recursive: true });

  // 1. Tạo ảnh nền phòng ngủ 1280x720 (SVG -> PNG)
  const bedroomSvg = `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#4A5568" />
        <stop offset="100%" stop-color="#2D3748" />
      </linearGradient>
      <linearGradient id="floorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#B7791F" />
        <stop offset="100%" stop-color="#7B341E" />
      </linearGradient>
      <linearGradient id="windowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FEFCBF" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#FAF089" stop-opacity="0.3" />
      </linearGradient>
    </defs>
    <!-- Tường phòng ngủ -->
    <rect width="1280" height="520" fill="url(#wallGrad)" />
    
    <!-- Cửa sổ buổi sáng -->
    <rect x="150" y="80" width="280" height="340" rx="10" fill="#E2E8F0" stroke="#718096" stroke-width="8" />
    <rect x="165" y="95" width="115" height="145" fill="url(#windowGlow)" />
    <rect x="295" y="95" width="115" height="145" fill="url(#windowGlow)" />
    <rect x="165" y="255" width="115" height="150" fill="url(#windowGlow)" />
    <rect x="295" y="255" width="115" height="150" fill="url(#windowGlow)" />

    <!-- Tranh treo tường -->
    <rect x="750" y="100" width="220" height="150" fill="#CBD5E0" stroke="#4A5568" stroke-width="6" rx="4" />
    <circle cx="860" cy="175" r="45" fill="#ED8936" opacity="0.8" />
    <polygon points="760,240 820,180 890,240" fill="#319795" />
    <polygon points="850,240 910,195 960,240" fill="#2C7A7B" />

    <!-- Sàn gỗ -->
    <rect y="520" width="1280" height="200" fill="url(#floorGrad)" />
    <line x1="0" y1="580" x2="1280" y2="580" stroke="#5C2614" stroke-width="3" />
    <line x1="0" y1="640" x2="1280" y2="640" stroke="#5C2614" stroke-width="3" />

    <!-- Giường ngủ 2D -->
    <rect x="620" y="440" width="580" height="160" rx="15" fill="#3182CE" stroke="#1A365D" stroke-width="6" />
    <rect x="600" y="400" width="120" height="90" rx="10" fill="#E2E8F0" stroke="#A0AEC0" stroke-width="4" />
    <!-- Chăn đắp (có thể làm foreground) -->
    <path d="M 720 460 Q 900 440 1200 460 L 1200 600 L 720 600 Z" fill="#63B3ED" stroke="#2B6CB0" stroke-width="5" />
  </svg>
  `;

  const bgPathSamples = path.join(samplesDir, "scene_001.png");
  const bgPathPublic = path.join(bgDir, "scene_001.png");
  await sharp(Buffer.from(bedroomSvg)).png().toFile(bgPathSamples);
  fs.copyFileSync(bgPathSamples, bgPathPublic);
  console.log("✅ Đã tạo ảnh nền 1280x720: scene_001.png");

  // 2. Tạo ảnh nhân vật gốc nền trắng tinh (RGB 255, 255, 255)
  // Có mặt trắng, áo trắng, viền đen và dấu hỏi '?' tách rời trên đầu
  const charSvg = `
  <svg width="600" height="700" viewBox="0 0 600 700" xmlns="http://www.w3.org/2000/svg">
    <!-- Nền trắng toàn phần -->
    <rect width="600" height="700" fill="#FFFFFF" />

    <!-- Dấu hỏi '?' tách rời lơ lửng trên đầu bên phải -->
    <g transform="translate(420, 70)">
      <path d="M 0 40 C -15 20, 10 -20, 40 -15 C 65 -10, 65 25, 45 45 C 30 60, 30 75, 30 85" 
            fill="none" stroke="#1A202C" stroke-width="16" stroke-linecap="round" />
      <circle cx="30" cy="115" r="9" fill="#1A202C" />
    </g>

    <!-- Nhân vật 2D -->
    <g transform="translate(150, 160)">
      <!-- Tóc -->
      <path d="M 10 90 Q 75 -20 150 20 Q 225 -20 290 90 Z" fill="#2D3748" stroke="#1A202C" stroke-width="8" />

      <!-- Đầu / Khuôn mặt (Màu trắng tinh khiết bên trong viền đen!) -->
      <circle cx="150" cy="140" r="110" fill="#FFFFFF" stroke="#1A202C" stroke-width="10" />

      <!-- Đôi mắt biểu cảm ngạc nhiên (trợn tròn) -->
      <circle cx="110" cy="130" r="26" fill="#FFFFFF" stroke="#1A202C" stroke-width="6" />
      <circle cx="110" cy="130" r="10" fill="#1A202C" />
      <circle cx="106" cy="126" r="3" fill="#FFFFFF" />

      <circle cx="190" cy="130" r="26" fill="#FFFFFF" stroke="#1A202C" stroke-width="6" />
      <circle cx="190" cy="130" r="10" fill="#1A202C" />
      <circle cx="186" cy="126" r="3" fill="#FFFFFF" />

      <!-- Miệng há hốc ngạc nhiên -->
      <ellipse cx="150" cy="195" rx="20" ry="28" fill="#E53E3E" stroke="#1A202C" stroke-width="6" />

      <!-- Thân / Áo (Áo màu trắng có viền đen) -->
      <path d="M 50 260 L 250 260 L 280 480 L 20 480 Z" fill="#FFFFFF" stroke="#1A202C" stroke-width="10" />
      <!-- Cổ áo chữ V -->
      <polygon points="120,260 150,310 180,260" fill="#E2E8F0" stroke="#1A202C" stroke-width="6" />
    </g>
  </svg>
  `;

  const charRawPath = path.join(rawDir, "ngac-nhien.png");
  const charSamplePath = path.join(samplesDir, "ngac-nhien_raw.png");
  await sharp(Buffer.from(charSvg)).png().toFile(charRawPath);
  fs.copyFileSync(charRawPath, charSamplePath);
  console.log("✅ Đã tạo ảnh nhân vật nền trắng mẫu: raw/characters/ngac-nhien.png");

  // 3. Tạo một ảnh foreground mẫu (cái chăn phủ che mép dưới nhân vật)
  const fgSvg = `
  <svg width="600" height="200" viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
    <path d="M 0 60 Q 300 10 600 60 L 600 200 L 0 200 Z" fill="#63B3ED" stroke="#2B6CB0" stroke-width="6" />
  </svg>
  `;
  const fgPath = path.join(projectRoot, "public/foregrounds/blanket.png");
  fs.mkdirSync(path.dirname(fgPath), { recursive: true });
  await sharp(Buffer.from(fgSvg)).png().toFile(fgPath);
  console.log("✅ Đã tạo ảnh foreground mẫu: public/foregrounds/blanket.png");
}

generateSampleAssets().catch(console.error);

