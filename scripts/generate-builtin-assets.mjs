/**
 * scripts/generate-builtin-assets.mjs
 * Renders real high-resolution transparent PNG asset images for all built-in props, expressions, VFX and Weather.
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
      <path d="M 80 45 Q 70 30 80 15 Q 90 0 80 -10" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <path d="M 110 50 Q 120 35 110 20 Q 100 5 110 -5" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
      <ellipse cx="100" cy="180" rx="80" ry="14" fill="#cbd5e1" stroke="#1e293b" stroke-width="6"/>
      <ellipse cx="100" cy="178" rx="72" ry="10" fill="#f8fafc"/>
      <path d="M 140 90 C 185 90 185 150 135 155" fill="none" stroke="#1e293b" stroke-width="20" stroke-linecap="round"/>
      <path d="M 140 90 C 180 90 180 150 135 155" fill="none" stroke="#f8fafc" stroke-width="12" stroke-linecap="round"/>
      <path d="M 50 80 L 60 160 C 60 172 140 172 140 160 L 150 80 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="7" stroke-linejoin="round"/>
      <ellipse cx="100" cy="80" rx="50" ry="14" fill="#1e293b" stroke="#1e293b" stroke-width="5"/>
      <ellipse cx="100" cy="80" rx="46" ry="11" fill="#6f4e37"/>
      <ellipse cx="100" cy="80" rx="40" ry="8" fill="#4a2e18"/>
      <path d="M 66 94 Q 68 140 76 156" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.9"/>
    </svg>`,

  prop_laptop_modern: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
      <path d="M 40 30 L 200 30 C 205 30 208 34 207 39 L 195 140 L 45 140 L 33 39 C 32 34 35 30 40 30 Z" fill="#1e293b" stroke="#0f172a" stroke-width="6" stroke-linejoin="round"/>
      <polygon points="46,40 194,40 185,134 55,134" fill="#0284c7"/>
      <rect x="65" y="55" width="70" height="8" rx="4" fill="#bae6fd"/>
      <rect x="65" y="72" width="110" height="6" rx="3" fill="#bae6fd" opacity="0.75"/>
      <rect x="65" y="86" width="90" height="6" rx="3" fill="#bae6fd" opacity="0.75"/>
      <polygon points="20,150 220,150 240,175 0,175" fill="#334155" stroke="#0f172a" stroke-width="6" stroke-linejoin="round"/>
      <polygon points="26,152 214,152 232,171 8,171" fill="#475569"/>
      <rect x="85" y="156" width="70" height="12" rx="3" fill="#1e293b"/>
    </svg>`,

  prop_broom_stick: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 260" width="160" height="260">
      <line x1="80" y1="10" x2="80" y2="175" stroke="#92400e" stroke-width="14" stroke-linecap="round"/>
      <line x1="82" y1="10" x2="82" y2="175" stroke="#b45309" stroke-width="8" stroke-linecap="round"/>
      <rect x="68" y="170" width="24" height="16" rx="4" fill="#b91c1c" stroke="#7f1d1d" stroke-width="4"/>
      <path d="M 68 186 C 45 200 30 235 35 255 L 125 255 C 130 235 115 200 92 186 Z" fill="#facc15" stroke="#1e293b" stroke-width="6" stroke-linejoin="round"/>
      <line x1="60" y1="200" x2="55" y2="250" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
      <line x1="80" y1="195" x2="80" y2="252" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
      <line x1="100" y1="200" x2="105" y2="250" stroke="#ca8a04" stroke-width="3" stroke-linecap="round"/>
    </svg>`,

  prop_book: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <path d="M 30 50 C 65 60 95 62 100 70 C 105 62 135 60 170 50 L 175 160 C 140 170 110 172 100 180 C 90 172 60 170 25 160 Z" fill="#1e3a8a" stroke="#0f172a" stroke-width="7" stroke-linejoin="round"/>
      <path d="M 36 56 C 68 65 94 67 98 74 L 98 174 C 92 168 66 166 32 156 Z" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
      <path d="M 164 56 C 132 65 106 67 102 74 L 102 174 C 108 168 134 166 168 156 Z" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
      <line x1="45" y1="80" x2="85" y2="86" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
      <line x1="45" y1="100" x2="85" y2="106" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
      <line x1="45" y1="120" x2="85" y2="126" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
      <line x1="115" y1="86" x2="155" y2="80" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
      <line x1="115" y1="106" x2="155" y2="100" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
      <line x1="115" y1="126" x2="155" y2="120" stroke="#94a3b8" stroke-width="3" stroke-linecap="round"/>
    </svg>`,

  prop_smartphone: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240" width="160" height="240">
      <rect x="25" y="20" width="110" height="200" rx="20" fill="#0f172a" stroke="#334155" stroke-width="6"/>
      <rect x="33" y="32" width="94" height="176" rx="12" fill="#0284c7"/>
      <ellipse cx="80" cy="27" rx="10" ry="3" fill="#334155"/>
      <circle cx="80" cy="27" r="2.5" fill="#0f172a"/>
      <line x1="50" y1="80" x2="110" y2="80" stroke="#bae6fd" stroke-width="6" stroke-linecap="round"/>
      <line x1="50" y1="100" x2="90" y2="100" stroke="#bae6fd" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
      <circle cx="80" cy="150" r="18" fill="#38bdf8"/>
      <path d="M 75 145 L 87 150 L 75 155 Z" fill="#ffffff"/>
      <rect x="60" y="214" width="40" height="4" rx="2" fill="#ffffff" opacity="0.75"/>
    </svg>`,

  prop_wooden_table: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" width="240" height="180">
      <polygon points="10,60 230,60 215,85 25,85" fill="#b45309" stroke="#1e293b" stroke-width="6" stroke-linejoin="round"/>
      <polygon points="12,62 228,62 214,83 26,83" fill="#d97706"/>
      <rect x="35" y="85" width="170" height="14" fill="#92400e" stroke="#1e293b" stroke-width="5"/>
      <polygon points="40,99 30,170 46,170 52,99" fill="#78350f" stroke="#1e293b" stroke-width="5"/>
      <polygon points="188,99 194,170 210,170 200,99" fill="#78350f" stroke="#1e293b" stroke-width="5"/>
    </svg>`,

  prop_chair_classic: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 240" width="160" height="240">
      <rect x="35" y="30" width="90" height="85" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="6"/>
      <line x1="55" y1="40" x2="55" y2="105" stroke="#cbd5e1" stroke-width="4"/>
      <line x1="80" y1="40" x2="80" y2="105" stroke="#cbd5e1" stroke-width="4"/>
      <line x1="105" y1="40" x2="105" y2="105" stroke="#cbd5e1" stroke-width="4"/>
      <rect x="25" y="115" width="110" height="22" rx="6" fill="#3b82f6" stroke="#1e293b" stroke-width="6"/>
      <rect x="35" y="137" width="12" height="90" fill="#1e293b" stroke="#0f172a" stroke-width="4"/>
      <rect x="113" y="137" width="12" height="90" fill="#1e293b" stroke="#0f172a" stroke-width="4"/>
    </svg>`,

  prop_pen_metal: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 240" width="80" height="240">
      <rect x="34" y="30" width="12" height="150" rx="3" fill="#2563eb" stroke="#1e293b" stroke-width="4"/>
      <rect x="32" y="20" width="16" height="20" rx="4" fill="#94a3b8" stroke="#1e293b" stroke-width="4"/>
      <path d="M 34 180 L 40 220 L 46 180 Z" fill="#94a3b8" stroke="#1e293b" stroke-width="4"/>
      <circle cx="40" cy="220" r="2.5" fill="#0f172a"/>
      <rect x="44" y="36" width="6" height="60" rx="3" fill="#cbd5e1" stroke="#1e293b" stroke-width="3"/>
    </svg>`
};

// ==========================================
// 2. EXPRESSIONS VECTOR SVG ASSETS
// ==========================================
const EXPR_SVG = {
  expr_neutral: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <line x1="52" y1="72" x2="86" y2="72" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <line x1="114" y1="72" x2="148" y2="72" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <circle cx="70" cy="96" r="13" fill="#111827"/>
      <circle cx="67" cy="92" r="4.5" fill="#ffffff"/>
      <circle cx="130" cy="96" r="13" fill="#111827"/>
      <circle cx="127" cy="92" r="4.5" fill="#ffffff"/>
      <line x1="82" y1="140" x2="118" y2="140" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  expr_happy: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <path d="M 52 70 Q 70 60 88 70" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 70 Q 130 60 148 70" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 54 100 Q 70 82 86 100" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <path d="M 114 100 Q 130 82 146 100" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <circle cx="48" cy="116" r="11" fill="#fda4af" opacity="0.9"/>
      <circle cx="152" cy="116" r="11" fill="#fda4af" opacity="0.9"/>
      <path d="M 68 132 Q 100 174 132 132 Z" fill="#e11d48" stroke="#111827" stroke-width="7" stroke-linejoin="round"/>
      <path d="M 78 134 Q 100 142 122 134 L 122 140 Q 100 148 78 140 Z" fill="#ffffff"/>
    </svg>`,

  expr_angry: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <path d="M 45 42 Q 55 48 65 42 M 55 35 Q 55 60 55 65" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
      <line x1="48" y1="64" x2="90" y2="84" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
      <line x1="152" y1="64" x2="110" y2="84" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
      <circle cx="70" cy="100" r="12" fill="#111827"/>
      <circle cx="68" cy="98" r="3.5" fill="#ffffff"/>
      <circle cx="130" cy="100" r="12" fill="#111827"/>
      <circle cx="128" cy="98" r="3.5" fill="#ffffff"/>
      <polygon points="70,136 130,136 122,156 78,156" fill="#111827" stroke="#111827" stroke-width="6" stroke-linejoin="round"/>
      <line x1="84" y1="136" x2="84" y2="156" stroke="#ffffff" stroke-width="3"/>
      <line x1="100" y1="136" x2="100" y2="156" stroke="#ffffff" stroke-width="3"/>
      <line x1="116" y1="136" x2="116" y2="156" stroke="#ffffff" stroke-width="3"/>
    </svg>`,

  expr_shocked: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <path d="M 50 56 Q 70 46 90 56" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <path d="M 110 56 Q 130 46 150 56" fill="none" stroke="#111827" stroke-width="7" stroke-linecap="round"/>
      <circle cx="70" cy="90" r="22" fill="#fffdf8" stroke="#111827" stroke-width="5"/>
      <circle cx="70" cy="90" r="7" fill="#111827"/>
      <circle cx="130" cy="90" r="22" fill="#fffdf8" stroke="#111827" stroke-width="5"/>
      <circle cx="130" cy="90" r="7" fill="#111827"/>
      <ellipse cx="100" cy="148" rx="22" ry="28" fill="#0f172a" stroke="#111827" stroke-width="7"/>
      <ellipse cx="100" cy="164" rx="14" ry="8" fill="#e11d48"/>
    </svg>`,

  expr_scared: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="88" fill="#fffdf8" stroke="#111827" stroke-width="8"/>
      <path d="M 35 15 C 20 40 15 55 15 65 A 20 20 0 0 0 55 65 C 55 55 50 40 35 15 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <path d="M 52 64 Q 70 76 88 68" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <path d="M 112 68 Q 130 76 148 64" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <circle cx="70" cy="94" r="16" fill="#fffdf8" stroke="#111827" stroke-width="5"/>
      <circle cx="70" cy="94" r="5" fill="#111827"/>
      <circle cx="130" cy="94" r="16" fill="#fffdf8" stroke="#111827" stroke-width="5"/>
      <circle cx="130" cy="94" r="5" fill="#111827"/>
      <path d="M 68 142 Q 80 150 92 140 Q 104 130 116 142 Q 128 152 136 140" fill="none" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`
};

// ==========================================
// 3. CARTOON VFX VECTOR SVG ASSETS (PHASE 3)
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

  vfx_anger_smoke: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <circle cx="60" cy="100" r="25" fill="#f1f5f9" stroke="#94a3b8" stroke-width="4"/>
      <circle cx="100" cy="100" r="28" fill="#f1f5f9" stroke="#94a3b8" stroke-width="4"/>
      <circle cx="80" cy="65" r="32" fill="#f1f5f9" stroke="#94a3b8" stroke-width="5"/>
      <circle cx="80" cy="30" r="16" fill="#f1f5f9" stroke="#94a3b8" stroke-width="3"/>
    </svg>`,

  vfx_question_mark: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 180" width="140" height="180">
      <path d="M 40 50 C 40 20 100 20 100 55 C 100 78 70 82 70 115" fill="none" stroke="#0284c7" stroke-width="20" stroke-linecap="round"/>
      <path d="M 40 50 C 40 20 100 20 100 55 C 100 78 70 82 70 115" fill="none" stroke="#38bdf8" stroke-width="12" stroke-linecap="round"/>
      <circle cx="70" cy="150" r="12" fill="#38bdf8" stroke="#0284c7" stroke-width="5"/>
    </svg>`,

  vfx_exclamation_mark: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" width="120" height="180">
      <polygon points="48,20 72,20 66,110 54,110" fill="#f59e0b" stroke="#b45309" stroke-width="6" stroke-linejoin="round"/>
      <circle cx="60" cy="145" r="12" fill="#f59e0b" stroke="#b45309" stroke-width="5"/>
    </svg>`,

  vfx_love_hearts: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <path d="M 90 40 C 70 10 30 25 30 65 C 30 105 90 140 90 150 C 90 140 150 105 150 65 C 150 25 110 10 90 40 Z" fill="#f43f5e" stroke="#9f1239" stroke-width="6"/>
      <path d="M 60 50 Q 50 60 60 70" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
    </svg>`,

  vfx_cartoon_tears: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <path d="M 50 30 Q 30 80 40 140 L 60 140 Q 65 80 55 30 Z" fill="#60a5fa" stroke="#1d4ed8" stroke-width="5"/>
      <path d="M 130 30 Q 150 80 140 140 L 120 140 Q 115 80 125 30 Z" fill="#60a5fa" stroke="#1d4ed8" stroke-width="5"/>
      <circle cx="35" cy="155" r="8" fill="#38bdf8"/>
      <circle cx="145" cy="155" r="8" fill="#38bdf8"/>
    </svg>`,

  vfx_dizzy_stars: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <ellipse cx="80" cy="80" rx="65" ry="32" fill="none" stroke="#fde047" stroke-width="4" stroke-dasharray="8 8" opacity="0.6" transform="rotate(-15 80 80)"/>
      <polygon points="40,60 46,75 62,76 49,87 54,103 40,93 26,103 31,87 18,76 34,75" fill="#eab308" stroke="#ca8a04" stroke-width="3"/>
      <polygon points="120,40 124,52 136,53 126,62 130,74 120,66 110,74 114,62 104,53 116,52" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
      <polygon points="90,110 93,120 104,121 95,129 98,140 90,133 82,140 85,129 76,121 87,120" fill="#fef08a" stroke="#ca8a04" stroke-width="2.5"/>
    </svg>`,

  vfx_embarrassment_lines: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
      <line x1="30" y1="20" x2="45" y2="100" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
      <line x1="55" y1="20" x2="70" y2="100" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
      <line x1="80" y1="20" x2="95" y2="100" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
      <line x1="105" y1="20" x2="120" y2="100" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  vfx_shock_lines: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <circle cx="90" cy="90" r="40" fill="none" stroke="#111827" stroke-width="5"/>
      <line x1="90" y1="20" x2="90" y2="40" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <line x1="90" y1="140" x2="90" y2="160" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <line x1="20" y1="90" x2="40" y2="90" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <line x1="140" y1="90" x2="160" y2="90" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <line x1="40" y1="40" x2="55" y2="55" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
      <line x1="125" y1="125" x2="140" y2="140" stroke="#111827" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  vfx_dark_gloom: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140" width="180" height="140">
      <rect x="20" y="20" width="140" height="100" fill="#1e1b4b" opacity="0.75" rx="8"/>
      <line x1="40" y1="20" x2="40" y2="100" stroke="#0f172a" stroke-width="4"/>
      <line x1="60" y1="20" x2="60" y2="100" stroke="#0f172a" stroke-width="4"/>
      <line x1="80" y1="20" x2="80" y2="100" stroke="#0f172a" stroke-width="4"/>
      <line x1="100" y1="20" x2="100" y2="100" stroke="#0f172a" stroke-width="4"/>
      <line x1="120" y1="20" x2="120" y2="100" stroke="#0f172a" stroke-width="4"/>
      <line x1="140" y1="20" x2="140" y2="100" stroke="#0f172a" stroke-width="4"/>
    </svg>`,

  vfx_idea_bulb: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 180" width="160" height="180">
      <line x1="80" y1="10" x2="80" y2="25" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
      <line x1="30" y1="60" x2="15" y2="60" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
      <line x1="130" y1="60" x2="145" y2="60" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/>
      <path d="M 50 65 C 50 40 110 40 110 65 C 110 85 96 95 96 115 L 64 115 C 64 95 50 85 50 65 Z" fill="#fef08a" stroke="#d97706" stroke-width="5"/>
      <rect x="66" y="118" width="28" height="14" rx="2" fill="#94a3b8" stroke="#475569" stroke-width="3"/>
      <rect x="72" y="132" width="16" height="8" rx="2" fill="#64748b"/>
    </svg>`,

  vfx_dust_cloud: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="160">
      <path d="M 40 130 C 15 130 10 100 30 85 C 20 60 55 40 75 55 C 95 30 145 35 155 65 C 185 65 195 105 175 125 C 185 135 160 145 150 135 C 130 150 70 150 40 130 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="7" stroke-linejoin="round"/>
      <path d="M 60 115 Q 90 95 130 110" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
      <circle cx="28" cy="138" r="8" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
      <circle cx="168" cy="140" r="10" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
    </svg>`,

  vfx_fight_smoke: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200" width="220" height="200">
      <circle cx="90" cy="100" r="55" fill="#f8fafc" stroke="#334155" stroke-width="7"/>
      <circle cx="140" cy="95" r="50" fill="#f8fafc" stroke="#334155" stroke-width="7"/>
      <circle cx="110" cy="130" r="52" fill="#f8fafc" stroke="#334155" stroke-width="7"/>
      <circle cx="110" cy="70" r="48" fill="#f8fafc" stroke="#334155" stroke-width="7"/>
      <!-- Punching fist sticking out -->
      <circle cx="35" cy="80" r="18" fill="#fffdf8" stroke="#334155" stroke-width="6"/>
      <!-- Impact star -->
      <polygon points="180,60 185,75 200,75 188,85 192,100 180,90 168,100 172,85 160,75 175,75" fill="#f59e0b" stroke="#334155" stroke-width="3"/>
    </svg>`,

  vfx_impact_flash: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <polygon points="100,10 115,75 180,50 135,100 190,135 125,130 140,190 100,145 60,190 75,130 10,135 65,100 20,50 85,75" fill="#fef08a" stroke="#eab308" stroke-width="5"/>
      <circle cx="100" cy="100" r="28" fill="#ffffff"/>
    </svg>`,

  vfx_cartoon_explosion: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200" width="220" height="200">
      <polygon points="110,15 135,65 195,45 160,100 205,145 145,140 140,195 100,155 60,190 75,135 15,135 65,95 25,45 85,65" fill="#f97316" stroke="#1e293b" stroke-width="7"/>
      <circle cx="110" cy="105" r="45" fill="#facc15" stroke="#1e293b" stroke-width="6"/>
      <circle cx="110" cy="105" r="25" fill="#ffffff"/>
    </svg>`,

  vfx_speed_lines: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140" width="240" height="140">
      <line x1="20" y1="30" x2="220" y2="30" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <line x1="60" y1="55" x2="235" y2="55" stroke="#0f172a" stroke-width="12" stroke-linecap="round"/>
      <line x1="10" y1="80" x2="210" y2="80" stroke="#0f172a" stroke-width="10" stroke-linecap="round"/>
      <line x1="80" y1="105" x2="230" y2="105" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  vfx_golden_aura: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" width="200" height="260">
      <path d="M 100 10 C 60 70 20 120 20 180 C 20 230 60 250 100 250 C 140 250 180 230 180 180 C 180 120 140 70 100 10 Z" fill="#f59e0b" opacity="0.65"/>
      <path d="M 100 30 Q 70 90 40 150 Q 80 130 70 210 Q 110 160 100 240 Q 130 170 140 210 Q 130 140 160 150 Z" fill="#fef08a" opacity="0.9"/>
      <circle cx="75" cy="60" r="6" fill="#ffffff"/>
      <circle cx="125" cy="50" r="5" fill="#ffffff"/>
    </svg>`,

  vfx_blue_aura: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" width="200" height="260">
      <path d="M 100 10 C 60 70 20 120 20 180 C 20 230 60 250 100 250 C 140 250 180 230 180 180 C 180 120 140 70 100 10 Z" fill="#0284c7" opacity="0.65"/>
      <path d="M 100 30 Q 70 90 40 150 Q 80 130 70 210 Q 110 160 100 240 Q 130 170 140 210 Q 130 140 160 150 Z" fill="#38bdf8" opacity="0.9"/>
      <circle cx="75" cy="60" r="6" fill="#ffffff"/>
      <circle cx="125" cy="50" r="5" fill="#ffffff"/>
    </svg>`,

  vfx_red_aura: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" width="200" height="260">
      <path d="M 100 10 C 60 70 20 120 20 180 C 20 230 60 250 100 250 C 140 250 180 230 180 180 C 180 120 140 70 100 10 Z" fill="#b91c1c" opacity="0.65"/>
      <path d="M 100 30 Q 70 90 40 150 Q 80 130 70 210 Q 110 160 100 240 Q 130 170 140 210 Q 130 140 160 150 Z" fill="#ef4444" opacity="0.9"/>
      <circle cx="75" cy="60" r="6" fill="#ffffff"/>
      <circle cx="125" cy="50" r="5" fill="#ffffff"/>
    </svg>`,

  vfx_energy_ring: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120">
      <ellipse cx="110" cy="60" rx="90" ry="32" fill="none" stroke="#0284c7" stroke-width="14"/>
      <ellipse cx="110" cy="60" rx="90" ry="32" fill="none" stroke="#38bdf8" stroke-width="8"/>
      <ellipse cx="110" cy="60" rx="90" ry="32" fill="none" stroke="#ffffff" stroke-width="3"/>
    </svg>`,

  vfx_lightning_energy: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200">
      <polygon points="90,10 40,95 80,95 50,190 125,85 85,85" fill="#67e8f9" stroke="#0891b2" stroke-width="6"/>
      <polygon points="88,20 48,92 82,92 58,170 115,87 83,87" fill="#ffffff"/>
    </svg>`,

  vfx_body_glow: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220" width="160" height="220">
      <circle cx="80" cy="110" r="70" fill="#fef08a" opacity="0.6"/>
      <circle cx="80" cy="110" r="45" fill="#ffffff" opacity="0.8"/>
    </svg>`,

  vfx_power_burst: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <circle cx="100" cy="100" r="80" fill="none" stroke="#eab308" stroke-width="10"/>
      <circle cx="100" cy="100" r="60" fill="none" stroke="#facc15" stroke-width="6"/>
      <circle cx="100" cy="100" r="40" fill="#ffffff"/>
    </svg>`,

  vfx_sparkles: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <!-- 4-point sparkle 1 -->
      <path d="M 50 20 Q 50 45 75 45 Q 50 45 50 70 Q 50 45 25 45 Q 50 45 50 20 Z" fill="#ffffff" stroke="#38bdf8" stroke-width="3"/>
      <!-- 4-point sparkle 2 -->
      <path d="M 120 80 Q 120 100 140 100 Q 120 100 120 120 Q 120 100 100 100 Q 120 100 120 80 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="3"/>
    </svg>`,

  vfx_shockwave: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" width="220" height="120">
      <ellipse cx="110" cy="60" rx="95" ry="38" fill="none" stroke="#0891b2" stroke-width="8"/>
      <ellipse cx="110" cy="60" rx="75" ry="30" fill="none" stroke="#67e8f9" stroke-width="4"/>
    </svg>`,

  vfx_ground_dust: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" width="160" height="100">
      <circle cx="40" cy="60" r="22" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
      <circle cx="80" cy="55" r="28" fill="#e2e8f0" stroke="#64748b" stroke-width="4"/>
      <circle cx="120" cy="65" r="18" fill="#cbd5e1" stroke="#64748b" stroke-width="4"/>
    </svg>`,

  vfx_comic_burst: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 180" width="200" height="180">
      <polygon points="100,10 120,50 165,30 150,75 190,95 145,115 160,160 115,140 95,180 80,140 35,155 50,110 10,90 55,75 35,30 80,50" fill="#fde047" stroke="#1e293b" stroke-width="7"/>
      <text x="100" y="105" font-family="sans-serif" font-weight="900" font-size="32" fill="#dc2626" text-anchor="middle" stroke="#1e293b" stroke-width="2">POW!</text>
    </svg>`,

  vfx_camera_shake: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <rect x="35" y="45" width="90" height="70" rx="10" fill="#334155" stroke="#0f172a" stroke-width="6"/>
      <circle cx="80" cy="80" r="20" fill="#38bdf8" stroke="#0f172a" stroke-width="5"/>
      <!-- Shake ripples -->
      <path d="M 20 60 Q 10 80 20 100" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
      <path d="M 140 60 Q 150 80 140 100" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  vfx_screen_flash: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <rect x="10" y="10" width="160" height="160" fill="#ffffff" stroke="#facc15" stroke-width="8" rx="8"/>
      <line x1="90" y1="20" x2="90" y2="160" stroke="#fef08a" stroke-width="6"/>
      <line x1="20" y1="90" x2="160" y2="90" stroke="#fef08a" stroke-width="6"/>
    </svg>`,

  vfx_vignette: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140">
      <rect x="0" y="0" width="200" height="140" fill="#0f172a"/>
      <ellipse cx="100" cy="70" rx="70" ry="45" fill="#f8fafc"/>
    </svg>`,

  vfx_focus_lines: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <line x1="20" y1="20" x2="60" y2="60" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <line x1="160" y1="20" x2="120" y2="60" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <line x1="20" y1="160" x2="60" y2="120" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <line x1="160" y1="160" x2="120" y2="120" stroke="#0f172a" stroke-width="8" stroke-linecap="round"/>
      <circle cx="90" cy="90" r="16" fill="#ef4444"/>
    </svg>`
};

// ==========================================
// 4. WEATHER & ENVIRONMENT VECTOR SVG ASSETS
// ==========================================
const WEATHER_SVG = {
  weather_rain_cinematic: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <line x1="40" y1="20" x2="25" y2="80" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
      <line x1="90" y1="15" x2="75" y2="75" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/>
      <line x1="140" y1="25" x2="125" y2="85" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
      <line x1="60" y1="90" x2="45" y2="150" stroke="#0284c7" stroke-width="6" stroke-linecap="round"/>
      <line x1="110" y1="85" x2="95" y2="145" stroke="#0284c7" stroke-width="7" stroke-linecap="round"/>
      <line x1="160" y1="95" x2="145" y2="155" stroke="#0284c7" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="80" cy="165" rx="30" ry="8" fill="none" stroke="#bae6fd" stroke-width="3"/>
    </svg>`,

  weather_rain_heavy: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <path d="M 40 50 C 20 50 15 35 30 25 C 35 10 65 10 75 20 C 85 5 125 5 135 25 C 155 25 165 45 150 55 Z" fill="#334155" stroke="#1e293b" stroke-width="5"/>
      <line x1="45" y1="70" x2="30" y2="150" stroke="#0284c7" stroke-width="7" stroke-linecap="round"/>
      <line x1="80" y1="65" x2="65" y2="155" stroke="#0284c7" stroke-width="8" stroke-linecap="round"/>
      <line x1="115" y1="70" x2="100" y2="150" stroke="#0284c7" stroke-width="7" stroke-linecap="round"/>
      <line x1="150" y1="65" x2="135" y2="155" stroke="#0284c7" stroke-width="8" stroke-linecap="round"/>
    </svg>`,

  weather_snow_gentle: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <!-- Snowflake 1 -->
      <g transform="translate(60, 60)">
        <line x1="0" y1="-25" x2="0" y2="25" stroke="#38bdf8" stroke-width="5"/>
        <line x1="-22" y1="-12" x2="22" y2="12" stroke="#38bdf8" stroke-width="5"/>
        <line x1="-22" y1="12" x2="22" y2="-12" stroke="#38bdf8" stroke-width="5"/>
      </g>
      <!-- Snowflake 2 -->
      <g transform="translate(125, 120)">
        <line x1="0" y1="-30" x2="0" y2="30" stroke="#0284c7" stroke-width="6"/>
        <line x1="-26" y1="-15" x2="26" y2="15" stroke="#0284c7" stroke-width="6"/>
        <line x1="-26" y1="15" x2="26" y2="-15" stroke="#0284c7" stroke-width="6"/>
      </g>
    </svg>`,

  weather_wind_breeze: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140">
      <path d="M 20 40 Q 120 30 140 60 A 15 15 0 1 1 125 75" fill="none" stroke="#64748b" stroke-width="8" stroke-linecap="round"/>
      <path d="M 40 80 Q 140 70 160 100 A 12 12 0 1 1 148 112" fill="none" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
    </svg>`,

  weather_sunshine_rays: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
      <circle cx="40" cy="40" r="30" fill="#facc15" stroke="#eab308" stroke-width="6"/>
      <polygon points="40,40 120,70 110,95" fill="#fef08a" opacity="0.65"/>
      <polygon points="40,40 90,130 70,140" fill="#fef08a" opacity="0.65"/>
      <polygon points="40,40 150,110 135,130" fill="#fef08a" opacity="0.65"/>
    </svg>`,

  weather_fog_mystic: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" width="200" height="140">
      <path d="M 20 40 Q 60 20 110 40 Q 150 60 180 40" fill="none" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round"/>
      <path d="M 10 70 Q 50 90 100 70 Q 150 50 190 70" fill="none" stroke="#94a3b8" stroke-width="14" stroke-linecap="round"/>
      <path d="M 30 100 Q 80 80 130 100 Q 170 120 185 100" fill="none" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round"/>
    </svg>`,

  weather_storm_thunder: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <path d="M 40 70 C 15 70 10 40 35 30 C 40 10 80 10 95 25 C 110 5 155 5 165 30 C 190 35 195 70 170 80 Z" fill="#1e293b" stroke="#0f172a" stroke-width="6"/>
      <!-- Lightning bolt -->
      <polygon points="105,75 75,130 100,130 85,185 135,115 110,115" fill="#facc15" stroke="#ca8a04" stroke-width="4"/>
    </svg>`,

  weather_env_leaves: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <path d="M 50 40 C 30 65 30 105 70 115 C 80 75 75 45 50 40 Z" fill="#ea580c" stroke="#9a3412" stroke-width="4"/>
      <path d="M 110 80 C 90 105 90 145 130 155 C 140 115 135 85 110 80 Z" fill="#facc15" stroke="#ca8a04" stroke-width="4"/>
    </svg>`,

  weather_env_petals: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <path d="M 60 50 C 40 70 45 100 70 105 C 85 85 85 60 60 50 Z" fill="#f472b6" stroke="#db2777" stroke-width="3"/>
      <path d="M 110 90 C 90 110 95 140 120 145 C 135 125 135 100 110 90 Z" fill="#fda4af" stroke="#e11d48" stroke-width="3"/>
    </svg>`,

  weather_env_fireflies: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <circle cx="50" cy="60" r="14" fill="#a3e635" opacity="0.5"/>
      <circle cx="50" cy="60" r="6" fill="#ffffff"/>
      <circle cx="110" cy="110" r="18" fill="#a3e635" opacity="0.5"/>
      <circle cx="110" cy="110" r="8" fill="#ffffff"/>
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
    await renderSvgToPng(svg, path.join(dir, "thumb.png"), 120, 120);
    console.log(`  ✔ Expression PNG: ${id}`);
  }

  // 3. Kết xuất VFX (Phase 3)
  for (const [id, svg] of Object.entries(VFX_SVG)) {
    const dir = path.join(PUBLIC_ASSETS, "vfx", id);
    await renderSvgToPng(svg, path.join(dir, "vfx.png"), 200, 200);
    await renderSvgToPng(svg, path.join(dir, "thumb.png"), 100, 100);
    console.log(`  ✔ VFX PNG: ${id}`);
  }

  // 4. Kết xuất Weather & Environment (Phase 3)
  for (const [id, svg] of Object.entries(WEATHER_SVG)) {
    const dir = path.join(PUBLIC_ASSETS, "weather", id);
    await renderSvgToPng(svg, path.join(dir, "weather.png"), 200, 200);
    await renderSvgToPng(svg, path.join(dir, "thumb.png"), 100, 100);
    console.log(`  ✔ Weather PNG: ${id}`);
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
