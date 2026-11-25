/**
 * scripts/generate-builtin-assets.mjs
 * Renders real high-resolution transparent PNG asset images for all built-in props, expressions, and VFX.
 * Uses sharp to convert vector SVG artwork into crisp 32-bit transparent PNG files.
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const PUBLIC_ASSETS = path.resolve(process.cwd(), "public", "assets");

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function renderSvgToPng(svgString, outPath, width = 256, height = 256) {
  await ensureDir(path.dirname(outPath));
  const buffer = Buffer.from(svgString);
  await sharp(buffer)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
}

// ==========================================
// 1. PROPS VECTOR SVG ASSETS
// ==========================================
const PROPS_SVG = {
  prop_coffee_cup: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <!-- Steam -->
      <path d="M 80 45 Q 70 30 80 15 Q 90 0 80 -10" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <path d="M 110 50 Q 120 35 110 20 Q 100 5 110 -5" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <!-- Saucer plate -->
      <ellipse cx="100" cy="180" rx="80" ry="14" fill="#cbd5e1" stroke="#1e293b" stroke-width="6"/>
      <ellipse cx="100" cy="178" rx="72" ry="10" fill="#f8fafc"/>
      <!-- Cup Handle -->
      <path d="M 140 90 C 185 90 185 150 135 155" fill="none" stroke="#1e293b" stroke-width="20" stroke-linecap="round"/>
      <path d="M 140 90 C 180 90 180 150 135 155" fill="none" stroke="#f8fafc" stroke-width="12" stroke-linecap="round"/>
      <!-- Cup Body -->
      <path d="M 50 80 L 60 160 C 60 172 140 172 140 160 L 150 80 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="7" stroke-linejoin="round"/>
      <!-- Coffee Surface inside -->
      <ellipse cx="100" cy="80" rx="50" ry="14" fill="#1e293b" stroke="#1e293b" stroke-width="5"/>
      <ellipse cx="100" cy="80" rx="46" ry="11" fill="#6f4e37"/>
      <ellipse cx="100" cy="80" rx="40" ry="8" fill="#4a2e18"/>
      <!-- Cup Gloss Highlight -->
      <path d="M 66 94 Q 68 140 76 156" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
    </svg>`,

  prop_laptop_modern: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
      <!-- Screen Lid -->
      <path d="M 40 30 L 200 30 C 205 30 208 34 207 39 L 195 140 L 45 140 L 33 39 C 32 34 35 30 40 30 Z" fill="#1e293b" stroke="#0f172a" stroke-width="6" stroke-linejoin="round"/>
      <!-- Screen Glass -->
      <polygon points="46,40 194,40 185,134 55,134" fill="#0284c7"/>
      <!-- Glowing code / lines on screen -->
      <rect x="65" y="55" width="70" height="8" rx="4" fill="#bae6fd"/>
      <rect x="65" y="70" width="105" height="6" rx="3" fill="#7dd3fc"/>
      <rect x="65" y="82" width="85" height="6" rx="3" fill="#38bdf8"/>
      <rect x="75" y="94" width="60" height="6" rx="3" fill="#f43f5e"/>
      <rect x="65" y="106" width="90" height="6" rx="3" fill="#a7f3d0"/>
      <!-- Base Chassis -->
      <polygon points="10,158 230,158 200,140 40,140" fill="#cbd5e1" stroke="#0f172a" stroke-width="6" stroke-linejoin="round"/>
      <!-- Keyboard area -->
      <polygon points="35,144 205,144 195,152 45,152" fill="#475569"/>
      <!-- Trackpad -->
      <rect x="100" y="152" width="40" height="5" rx="1.5" fill="#94a3b8"/>
      <!-- Base front thickness -->
      <path d="M 10 158 L 10 164 Q 120 168 230 164 L 230 158 Z" fill="#94a3b8" stroke="#0f172a" stroke-width="5" stroke-linejoin="round"/>
    </svg>`,

  prop_phone_smart: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 220" width="140" height="220">
      <!-- Body Outer -->
      <rect x="25" y="15" width="90" height="190" rx="20" fill="#0f172a" stroke="#334155" stroke-width="6"/>
      <rect x="28" y="18" width="84" height="184" rx="17" fill="#020617"/>
      <!-- Screen -->
      <rect x="32" y="32" width="76" height="156" rx="8" fill="#1e1b4b"/>
      <!-- Wallpaper gradient simulation -->
      <circle cx="70" cy="110" r="32" fill="#6366f1" opacity="0.8"/>
      <circle cx="85" cy="130" r="26" fill="#ec4899" opacity="0.7"/>
      <!-- App icons -->
      <rect x="42" y="50" width="14" height="14" rx="3" fill="#38bdf8"/>
      <rect x="63" y="50" width="14" height="14" rx="3" fill="#10b981"/>
      <rect x="84" y="50" width="14" height="14" rx="3" fill="#f59e0b"/>
      <rect x="42" y="72" width="14" height="14" rx="3" fill="#a855f7"/>
      <rect x="63" y="72" width="14" height="14" rx="3" fill="#ef4444"/>
      <rect x="84" y="72" width="14" height="14" rx="3" fill="#64748b"/>
      <!-- Camera punch hole -->
      <circle cx="70" cy="24" r="3.5" fill="#334155"/>
      <!-- Screen glare -->
      <path d="M 36 34 L 100 34 L 40 180 L 36 180 Z" fill="#ffffff" opacity="0.08"/>
    </svg>`,

  prop_book_magic: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <!-- Back cover -->
      <path d="M 30 45 L 165 25 L 175 160 L 40 180 Z" fill="#450a0a" stroke="#1c1917" stroke-width="7" stroke-linejoin="round"/>
      <!-- Pages thickness -->
      <path d="M 40 178 L 172 158 L 168 144 L 38 164 Z" fill="#fef3c7" stroke="#78350f" stroke-width="3"/>
      <!-- Front cover -->
      <path d="M 32 40 L 165 20 L 165 146 L 32 166 Z" fill="#991b1b" stroke="#1c1917" stroke-width="7" stroke-linejoin="round"/>
      <!-- Golden spine & corner ornaments -->
      <path d="M 32 40 L 52 37 L 52 163 L 32 166 Z" fill="#b45309" stroke="#1c1917" stroke-width="5"/>
      <polygon points="145,23 165,20 165,40" fill="#fbbf24"/>
      <polygon points="145,149 165,146 165,126" fill="#fbbf24"/>
      <!-- Golden magical crest on cover -->
      <circle cx="108" cy="92" r="28" fill="none" stroke="#fbbf24" stroke-width="4"/>
      <polygon points="108,70 115,86 132,86 118,97 124,113 108,103 92,113 98,97 84,86 101,86" fill="#fef08a" stroke="#d97706" stroke-width="2"/>
    </svg>`,

  prop_broom_stick: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 260" width="160" height="260">
      <!-- Wooden handle -->
      <line x1="120" y1="20" x2="60" y2="170" stroke="#78350f" stroke-width="12" stroke-linecap="round"/>
      <line x1="120" y1="20" x2="60" y2="170" stroke="#b45309" stroke-width="6" stroke-linecap="round"/>
      <!-- Binding band -->
      <rect x="46" y="166" width="26" height="14" rx="4" transform="rotate(22 59 173)" fill="#991b1b" stroke="#1c1917" stroke-width="3"/>
      <!-- Straw bristles -->
      <path d="M 52 178 C 30 200 15 235 25 248 C 55 252 80 244 86 230 C 82 205 70 185 64 178 Z" fill="#fde047" stroke="#1c1917" stroke-width="6" stroke-linejoin="round"/>
      <!-- Straw fiber details -->
      <path d="M 40 195 L 32 242" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
      <path d="M 54 190 L 52 246" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
      <path d="M 66 185 L 72 236" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
    </svg>`,

  prop_desk_wood: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 180" width="280" height="180">
      <!-- Back legs -->
      <rect x="40" y="60" width="12" height="100" fill="#451a03" stroke="#1c1917" stroke-width="4"/>
      <rect x="228" y="60" width="12" height="100" fill="#451a03" stroke="#1c1917" stroke-width="4"/>
      <!-- Table top plank -->
      <polygon points="15,65 265,65 245,28 35,28" fill="#b45309" stroke="#1c1917" stroke-width="6" stroke-linejoin="round"/>
      <polygon points="17,63 263,63 243,30 37,30" fill="#d97706"/>
      <!-- Table front rim -->
      <rect x="15" y="65" width="250" height="22" rx="2" fill="#92400e" stroke="#1c1917" stroke-width="6"/>
      <!-- Front legs -->
      <polygon points="26,87 38,87 34,168 22,168" fill="#78350f" stroke="#1c1917" stroke-width="5"/>
      <polygon points="242,87 254,87 258,168 246,168" fill="#78350f" stroke="#1c1917" stroke-width="5"/>
      <!-- Wood highlights -->
      <line x1="30" y1="45" x2="230" y2="45" stroke="#fef3c7" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
    </svg>`,

  prop_chair_cafe: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240" width="160" height="240">
      <!-- Backrest posts -->
      <line x1="45" y1="20" x2="48" y2="135" stroke="#1e293b" stroke-width="10" stroke-linecap="round"/>
      <line x1="115" y1="20" x2="112" y2="135" stroke="#1e293b" stroke-width="10" stroke-linecap="round"/>
      <!-- Backrest top bar -->
      <path d="M 38 35 C 80 18 80 18 122 35" fill="none" stroke="#1e293b" stroke-width="14" stroke-linecap="round"/>
      <path d="M 46 70 C 80 58 80 58 114 70" fill="none" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
      <!-- Seat Cushion -->
      <ellipse cx="80" cy="138" rx="46" ry="14" fill="#d97706" stroke="#1e293b" stroke-width="6"/>
      <ellipse cx="80" cy="135" rx="42" ry="11" fill="#f59e0b"/>
      <!-- 4 Legs -->
      <line x1="48" y1="145" x2="36" y2="225" stroke="#1e293b" stroke-width="9" stroke-linecap="round"/>
      <line x1="112" y1="145" x2="124" y2="225" stroke="#1e293b" stroke-width="9" stroke-linecap="round"/>
      <line x1="62" y1="145" x2="56" y2="210" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
      <line x1="98" y1="145" x2="104" y2="210" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  prop_pen_tool: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 240" width="100" height="240">
      <!-- Barrel -->
      <rect x="42" y="50" width="16" height="130" rx="3" fill="#2563eb" stroke="#0f172a" stroke-width="5"/>
      <!-- Grip -->
      <rect x="42" y="145" width="16" height="35" fill="#1e293b"/>
      <!-- Tip Cone -->
      <polygon points="42,180 58,180 52,215 48,215" fill="#cbd5e1" stroke="#0f172a" stroke-width="4"/>
      <!-- Ball point -->
      <circle cx="50" cy="216" r="2.5" fill="#0f172a"/>
      <!-- Clicker Top -->
      <rect x="45" y="32" width="10" height="18" rx="2" fill="#94a3b8" stroke="#0f172a" stroke-width="4"/>
      <!-- Clip -->
      <path d="M 42 60 L 32 60 L 32 120 L 40 120" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
};

// ==========================================
// 2. EXPRESSIONS VECTOR SVG ASSETS
// ==========================================
const EXPR_SVG = {
  expr_neutral: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <!-- Head Base -->
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Brows -->
      <path d="M 52 72 Q 72 70 88 74" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 74 Q 128 70 148 72" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <!-- Eyes -->
      <circle cx="70" cy="95" r="14" fill="#111827"/>
      <circle cx="66" cy="91" r="5" fill="#ffffff"/>
      <circle cx="130" cy="95" r="14" fill="#111827"/>
      <circle cx="126" cy="91" r="5" fill="#ffffff"/>
      <!-- Calm Smile/Line Mouth -->
      <path d="M 86 142 Q 100 146 114 142" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  expr_happy: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Brows -->
      <path d="M 50 68 Q 70 60 88 68" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 68 Q 130 60 150 68" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <!-- Laughing crescent eyes -->
      <path d="M 54 98 C 54 78 86 78 86 98" fill="none" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
      <path d="M 114 98 C 114 78 146 78 146 98" fill="none" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
      <!-- Rosy Cheeks -->
      <ellipse cx="48" cy="115" rx="14" ry="8" fill="#fda4af" opacity="0.8"/>
      <ellipse cx="152" cy="115" rx="14" ry="8" fill="#fda4af" opacity="0.8"/>
      <!-- Big toothy open smile -->
      <path d="M 68 126 Q 100 132 132 126 C 132 165 68 165 68 126 Z" fill="#991b1b" stroke="#111827" stroke-width="7" stroke-linejoin="round"/>
      <!-- Upper Teeth -->
      <path d="M 74 128 Q 100 134 126 128 L 126 137 Q 100 142 74 137 Z" fill="#ffffff"/>
      <!-- Tongue -->
      <path d="M 82 154 Q 100 142 118 154 Q 100 166 82 154 Z" fill="#f43f5e"/>
    </svg>`,

  expr_sad: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Slanted sad brows -->
      <path d="M 52 74 L 86 64" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <path d="M 148 74 L 114 64" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <!-- Glossy tearful eyes -->
      <circle cx="70" cy="98" r="15" fill="#111827"/>
      <circle cx="66" cy="94" r="6" fill="#ffffff"/>
      <circle cx="75" cy="104" r="3" fill="#ffffff"/>
      <circle cx="130" cy="98" r="15" fill="#111827"/>
      <circle cx="126" cy="94" r="6" fill="#ffffff"/>
      <circle cx="135" cy="104" r="3" fill="#ffffff"/>
      <!-- Downward sad mouth -->
      <path d="M 80 150 Q 100 132 120 150" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  expr_crying: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Squeezed crying eyes -->
      <path d="M 52 92 L 72 102 L 52 112" fill="none" stroke="#111827" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 148 92 L 128 102 L 148 112" fill="none" stroke="#111827" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Slanted brows -->
      <path d="M 50 78 L 84 66" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <path d="M 150 78 L 116 66" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <!-- Waterfall tear streams -->
      <path d="M 68 104 C 55 125 50 160 55 190 C 75 190 75 125 74 104 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="4" opacity="0.85"/>
      <path d="M 132 104 C 145 125 150 160 145 190 C 125 190 125 125 126 104 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="4" opacity="0.85"/>
      <!-- Quivering open wail mouth -->
      <path d="M 76 138 Q 100 128 124 138 C 124 168 76 168 76 138 Z" fill="#991b1b" stroke="#111827" stroke-width="6"/>
      <path d="M 88 155 Q 100 146 112 155" fill="none" stroke="#f43f5e" stroke-width="6"/>
    </svg>`,

  expr_angry: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Anger Cross vein on forehead -->
      <path d="M 142 42 Q 152 48 162 42 M 152 32 Q 152 52 152 62 M 144 52 Q 160 52 160 52" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
      <!-- Slanted fierce brows -->
      <polygon points="46,82 92,94 92,82 46,68" fill="#111827"/>
      <polygon points="154,82 108,94 108,82 154,68" fill="#111827"/>
      <!-- Glaring narrowed eyes -->
      <circle cx="72" cy="102" r="10" fill="#111827"/>
      <circle cx="70" cy="100" r="3" fill="#ffffff"/>
      <circle cx="128" cy="102" r="10" fill="#111827"/>
      <circle cx="126" cy="100" r="3" fill="#ffffff"/>
      <!-- Clenched teeth mouth -->
      <rect x="70" y="132" width="60" height="22" rx="4" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <line x1="70" y1="143" x2="130" y2="143" stroke="#111827" stroke-width="4"/>
      <line x1="85" y1="132" x2="85" y2="154" stroke="#111827" stroke-width="3"/>
      <line x1="100" y1="132" x2="100" y2="154" stroke="#111827" stroke-width="3"/>
      <line x1="115" y1="132" x2="115" y2="154" stroke="#111827" stroke-width="3"/>
    </svg>`,

  expr_laughing: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Curved brows -->
      <path d="M 48 64 Q 68 52 88 64" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <path d="M 112 64 Q 132 52 152 64" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <!-- Happy arched eyes -->
      <path d="M 52 94 C 52 74 88 74 88 94" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>
      <path d="M 112 94 C 112 74 148 74 148 94" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>
      <!-- Tears of joy -->
      <path d="M 40 94 C 35 106 38 114 46 114 C 54 114 54 106 46 94 Z" fill="#38bdf8"/>
      <path d="M 160 94 C 165 106 162 114 154 114 C 146 114 146 106 154 94 Z" fill="#38bdf8"/>
      <!-- Huge laughing open mouth -->
      <path d="M 64 118 Q 100 128 136 118 C 136 172 64 172 64 118 Z" fill="#881337" stroke="#111827" stroke-width="7"/>
      <path d="M 72 120 Q 100 126 128 120 L 128 130 Q 100 136 72 130 Z" fill="#ffffff"/>
      <ellipse cx="100" cy="154" rx="20" ry="12" fill="#fb7185"/>
    </svg>`,

  expr_surprised: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- High arched brows -->
      <path d="M 50 60 Q 70 44 90 60" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <path d="M 110 60 Q 130 44 150 60" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <!-- Wide round eyes -->
      <circle cx="70" cy="94" r="20" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <circle cx="70" cy="94" r="9" fill="#111827"/>
      <circle cx="67" cy="91" r="3" fill="#ffffff"/>
      <circle cx="130" cy="94" r="20" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <circle cx="130" cy="94" r="9" fill="#111827"/>
      <circle cx="127" cy="91" r="3" fill="#ffffff"/>
      <!-- 'O' mouth -->
      <ellipse cx="100" cy="146" rx="16" ry="22" fill="#881337" stroke="#111827" stroke-width="7"/>
    </svg>`,

  expr_shocked: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Blue vertical shock lines on forehead -->
      <line x1="80" y1="25" x2="80" y2="60" stroke="#0284c7" stroke-width="5"/>
      <line x1="100" y1="20" x2="100" y2="65" stroke="#0284c7" stroke-width="5"/>
      <line x1="120" y1="25" x2="120" y2="60" stroke="#0284c7" stroke-width="5"/>
      <!-- High trembling brows -->
      <path d="M 50 65 Q 68 50 86 65" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 114 65 Q 132 50 150 65" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <!-- Tiny pinprick pupils in wide whites -->
      <circle cx="70" cy="94" r="22" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <circle cx="70" cy="94" r="5" fill="#111827"/>
      <circle cx="130" cy="94" r="22" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <circle cx="130" cy="94" r="5" fill="#111827"/>
      <!-- Jagged shock jaw drop -->
      <polygon points="80,132 120,132 124,168 100,162 76,168" fill="#881337" stroke="#111827" stroke-width="7" stroke-linejoin="round"/>
      <rect x="84" y="132" width="32" height="10" fill="#ffffff"/>
    </svg>`,

  expr_scared: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Pale cold sweat gradient overlay top-right -->
      <path d="M 130 50 Q 155 70 170 100 C 185 85 180 50 155 35 Z" fill="#38bdf8" opacity="0.3"/>
      <!-- Giant cold sweat drop -->
      <path d="M 155 60 C 145 78 145 92 155 92 C 165 92 165 78 155 60 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
      <!-- Trembling high brows -->
      <path d="M 52 68 Q 68 56 86 64" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 114 64 Q 132 56 148 68" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <!-- Wide shivering pupils -->
      <circle cx="70" cy="96" r="18" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <circle cx="70" cy="96" r="8" fill="#111827"/>
      <circle cx="130" cy="96" r="18" fill="#ffffff" stroke="#111827" stroke-width="6"/>
      <circle cx="130" cy="96" r="8" fill="#111827"/>
      <!-- Chattering teeth wavy line -->
      <path d="M 75 144 Q 85 138 95 144 Q 105 150 115 144 Q 125 138 135 144" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  expr_thinking: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Question mark above head -->
      <path d="M 150 30 Q 160 20 170 30 Q 170 42 160 50 L 160 58" fill="none" stroke="#eab308" stroke-width="6" stroke-linecap="round"/>
      <circle cx="160" cy="68" r="3.5" fill="#eab308"/>
      <!-- One raised brow, one lowered brow -->
      <path d="M 52 78 Q 72 82 88 78" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 60 Q 130 48 148 60" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <!-- Looking up-right pupils -->
      <circle cx="70" cy="95" r="14" fill="#111827"/>
      <circle cx="76" cy="88" r="5" fill="#ffffff"/>
      <circle cx="130" cy="95" r="14" fill="#111827"/>
      <circle cx="136" cy="88" r="5" fill="#ffffff"/>
      <!-- Sideways pursed mouth -->
      <path d="M 85 146 Q 105 142 118 138" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  expr_dizzy: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Orbiting yellow stars -->
      <polygon points="40,35 44,45 54,46 46,53 49,63 40,57 31,63 34,53 26,46 36,45" fill="#eab308"/>
      <polygon points="160,35 164,45 174,46 166,53 169,63 160,57 151,63 154,53 146,46 156,45" fill="#eab308"/>
      <!-- Spiral eyes (swirl pupils) -->
      <path d="M 70 96 m -18 0 a 18 18 0 1 0 36 0 a 14 14 0 1 0 -28 0 a 10 10 0 1 0 20 0 a 6 6 0 1 0 -12 0" fill="none" stroke="#111827" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 130 96 m -18 0 a 18 18 0 1 0 36 0 a 14 14 0 1 0 -28 0 a 10 10 0 1 0 20 0 a 6 6 0 1 0 -12 0" fill="none" stroke="#111827" stroke-width="4.5" stroke-linecap="round"/>
      <!-- Wobbly wavy mouth -->
      <path d="M 72 144 Q 86 154 100 144 Q 114 134 128 144" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  expr_talking: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Brows -->
      <path d="M 50 70 Q 70 66 88 72" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 72 Q 130 66 150 70" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <!-- Attentive eyes -->
      <circle cx="70" cy="94" r="14" fill="#111827"/>
      <circle cx="68" cy="90" r="5" fill="#ffffff"/>
      <circle cx="130" cy="94" r="14" fill="#111827"/>
      <circle cx="128" cy="90" r="5" fill="#ffffff"/>
      <!-- Talking open mouth phoneme -->
      <ellipse cx="100" cy="142" rx="20" ry="16" fill="#881337" stroke="#111827" stroke-width="6"/>
      <path d="M 86 132 Q 100 136 114 132 L 114 136 Q 100 140 86 136 Z" fill="#ffffff"/>
      <ellipse cx="100" cy="150" rx="12" ry="6" fill="#fb7185"/>
    </svg>`,

  expr_love_eyes: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <!-- Floating tiny hearts -->
      <path d="M 40 40 A 6 6 0 0 0 34 50 L 40 56 L 46 50 A 6 6 0 0 0 40 40 Z" fill="#f43f5e"/>
      <path d="M 160 40 A 6 6 0 0 0 154 50 L 160 56 L 166 50 A 6 6 0 0 0 160 40 Z" fill="#f43f5e"/>
      <!-- Red Heart Eyes -->
      <path d="M 70 82 A 12 12 0 0 0 54 98 L 70 114 L 86 98 A 12 12 0 0 0 70 82 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <path d="M 130 82 A 12 12 0 0 0 114 98 L 130 114 L 146 98 A 12 12 0 0 0 130 82 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <!-- Cheeks -->
      <circle cx="48" cy="116" r="10" fill="#fda4af"/>
      <circle cx="152" cy="116" r="10" fill="#fda4af"/>
      <!-- Dreamy smile -->
      <path d="M 78 136 Q 100 156 122 136" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
    </svg>`
};

// ==========================================
// 3. CARTOON VFX VECTOR SVG ASSETS
// ==========================================
const VFX_SVG = {
  vfx_sweat_drop: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" width="120" height="160">
      <path d="M 60 15 C 30 65 20 100 20 120 A 40 40 0 0 0 100 120 C 100 100 90 65 60 15 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="8" stroke-linejoin="round"/>
      <path d="M 40 105 A 25 25 0 0 0 75 140" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.8"/>
      <circle cx="78" cy="100" r="4" fill="#ffffff" opacity="0.8"/>
    </svg>`,

  vfx_anger_mark: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
      <path d="M 40 25 Q 70 40 100 25 M 70 15 Q 70 70 70 125 M 40 115 Q 70 100 100 115 M 25 70 Q 70 70 115 70" fill="none" stroke="#ef4444" stroke-width="14" stroke-linecap="round"/>
      <path d="M 40 25 Q 70 40 100 25 M 70 15 Q 70 70 70 125 M 40 115 Q 70 100 100 115 M 25 70 Q 70 70 115 70" fill="none" stroke="#b91c1c" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  vfx_golden_aura: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" width="200" height="260">
      <defs>
        <radialGradient id="auraGlow" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stop-color="#fef08a" stop-opacity="0.9"/>
          <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#d97706" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- Base Outer Flame -->
      <path d="M 100 10 C 60 70 20 120 20 180 C 20 230 60 250 100 250 C 140 250 180 230 180 180 C 180 120 140 70 100 10 Z" fill="url(#auraGlow)"/>
      <!-- Inner Flame Spikes -->
      <path d="M 100 30 Q 70 90 40 150 Q 80 130 70 210 Q 110 160 100 240 Q 130 170 140 210 Q 130 140 160 150 Z" fill="#fef08a" opacity="0.85"/>
      <!-- Rising Energy Sparks -->
      <circle cx="50" cy="120" r="5" fill="#fef08a"/>
      <circle cx="150" cy="90" r="4" fill="#fef08a"/>
      <circle cx="75" cy="60" r="6" fill="#ffffff"/>
      <circle cx="125" cy="50" r="5" fill="#ffffff"/>
    </svg>`,

  vfx_dizzy_stars: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <!-- Orbit ring -->
      <ellipse cx="80" cy="80" rx="65" ry="32" fill="none" stroke="#fde047" stroke-width="4" stroke-dasharray="8 8" opacity="0.6" transform="rotate(-15 80 80)"/>
      <!-- Star 1 -->
      <polygon points="40,60 46,75 62,76 49,87 54,103 40,93 26,103 31,87 18,76 34,75" fill="#eab308" stroke="#ca8a04" stroke-width="3"/>
      <!-- Star 2 -->
      <polygon points="120,40 124,52 136,53 126,62 130,74 120,66 110,74 114,62 104,53 116,52" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <!-- Star 3 -->
      <polygon points="90,110 93,120 104,121 95,129 98,140 90,133 82,140 85,129 76,121 87,120" fill="#fef08a" stroke="#ca8a04" stroke-width="2.5"/>
    </svg>`,

  vfx_dust_cloud: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <path d="M 40 130 C 15 130 10 100 30 85 C 20 60 55 40 75 55 C 95 30 145 35 155 65 C 185 65 195 105 175 125 C 185 135 160 145 150 135 C 130 150 70 150 40 130 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="7" stroke-linejoin="round"/>
      <path d="M 60 115 Q 90 95 130 110" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
      <circle cx="28" cy="138" r="8" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
      <circle cx="168" cy="140" r="10" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
    </svg>`,

  vfx_speed_lines: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" width="240" height="140">
      <line x1="20" y1="30" x2="220" y2="30" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <line x1="60" y1="55" x2="235" y2="55" stroke="#0f172a" stroke-width="12" stroke-linecap="round"/>
      <line x1="10" y1="80" x2="210" y2="80" stroke="#0f172a" stroke-width="10" stroke-linecap="round"/>
      <line x1="80" y1="105" x2="230" y2="105" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
    </svg>`
};

export async function generateAllBuiltinAssets() {
  console.log("🎨 Đang kết xuất hình ảnh PNG thực tế cho kho tài nguyên V4...");

  // 1. Kết xuất Props
  for (const [id, svg] of Object.entries(PROPS_SVG)) {
    const dir = path.join(PUBLIC_ASSETS, "prop", id);
    await renderSvgToPng(svg, path.join(dir, "prop.png"), 240, 240);
    await renderSvgToPng(svg, path.join(dir, "thumb.png"), 120, 120);
    console.log(`  ✔ Prop PNG: ${id}`);
  }

  // 2. Kết xuất Expressions
  for (const [id, svg] of Object.entries(EXPR_SVG)) {
    const dir = path.join(PUBLIC_ASSETS, "expression", id);
    await renderSvgToPng(svg, path.join(dir, "sprite.png"), 256, 256);
    await renderSvgToPng(svg, path.join(dir, "thumb.png"), 128, 128);
    console.log(`  ✔ Expression PNG: ${id}`);
  }

  // 3. Kết xuất VFX
  for (const [id, svg] of Object.entries(VFX_SVG)) {
    const dir = path.join(PUBLIC_ASSETS, "vfx", id);
    await renderSvgToPng(svg, path.join(dir, "vfx.png"), 200, 200);
    await renderSvgToPng(svg, path.join(dir, "thumb.png"), 100, 100);
    console.log(`  ✔ VFX PNG: ${id}`);
  }

  console.log("🎉 Hoàn tất kết xuất toàn bộ tệp ảnh PNG thực tế trong public/assets/!");
}

// Chạy trực tiếp nếu script được gọi qua CLI
if (process.argv[1] && process.argv[1].endsWith("generate-builtin-assets.mjs")) {
  generateAllBuiltinAssets().catch(err => {
    console.error("Lỗi kết xuất ảnh asset:", err);
    process.exit(1);
  });
}

