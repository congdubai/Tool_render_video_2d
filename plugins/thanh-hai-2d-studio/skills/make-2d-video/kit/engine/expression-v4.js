// engine/expression-v4.js — Universal Expression Library & Semantic Rig V4
// Supports 11+ core emotional expressions, comic overlay marks, Mode A & Mode B mapping.

const exprSpriteCache = new Map();

export function getCachedExprImage(src) {
  if (!src) return null;
  if (exprSpriteCache.has(src)) {
    return exprSpriteCache.get(src);
  }
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    exprSpriteCache.set(src, img);
    return img;
  }
  return null;
}

/**
 * Bảng chuẩn hóa tên biểu cảm (Semantic Mapping)
 * Ánh xạ tất cả alias (tiếng Việt, tiếng Anh thông dụng) về 11 mã chuẩn
 */
export const EXPRESSION_ALIASES = {
  // 1. Neutral
  neutral: 'neutral',
  binh_thuong: 'neutral',
  calm: 'neutral',
  idle: 'neutral',

  // 2. Happy
  happy: 'happy',
  vui: 'happy',
  smile: 'happy',
  cheerful: 'happy',

  // 3. Sad
  sad: 'sad',
  buon: 'sad',
  sorrow: 'sad',
  pout: 'sad',

  // 4. Crying
  crying: 'crying',
  khoc: 'crying',
  tears: 'crying',
  weep: 'crying',

  // 5. Angry
  angry: 'angry',
  tuc_gian: 'angry',
  furious: 'angry',
  rage: 'angry',

  // 6. Laughing
  laughing: 'laughing',
  cuoi: 'laughing',
  laugh: 'laughing',
  giggle: 'laughing',

  // 7. Surprised
  surprised: 'surprised',
  ngac_nhien: 'surprised',
  surprise: 'surprised',
  gasp: 'surprised',

  // 8. Shocked
  shocked: 'shocked',
  soc: 'shocked',
  jaw_drop: 'shocked',

  // 9. Scared & Terrified
  scared: 'scared',
  so_hai: 'scared',
  terrified: 'terrified',
  horror: 'terrified',
  fear: 'scared',
  worried: 'scared',
  lo_lang: 'scared',

  // 10. Thinking
  thinking: 'thinking',
  suy_nghi: 'thinking',
  confused: 'thinking',
  wonder: 'thinking',

  // 11. Dizzy
  dizzy: 'dizzy',
  chong_mat: 'dizzy',
  faint: 'dizzy',
  spiral: 'dizzy',

  // 12. Talking
  talking: 'talking',
  noi: 'talking',
  speech: 'talking',
  speak: 'talking',

  // 13. Love Eyes
  love_eyes: 'love_eyes',
  yeu: 'love_eyes',
  heart: 'love_eyes',
  romance: 'love_eyes',

  // 14. Determined / Focus
  determined: 'determined',
  quyet_tam: 'determined',
  focus: 'determined',

  // 15. Smirk
  smirk: 'smirk',
  nhech_mep: 'smirk',

  // 16. Relief
  relief: 'relief',
  nhe_nhom: 'relief'
};

/**
 * Chuẩn hóa tên biểu cảm
 */
export function normalizeExpressionName(expr) {
  if (!expr || typeof expr !== 'string') return 'neutral';
  const clean = expr.toLowerCase().trim();
  return EXPRESSION_ALIASES[clean] || clean;
}

/**
 * Render hệ thống ngũ quan biểu cảm và các hiệu ứng ký hiệu hoạt hình (Overlay Marks)
 * Tích hợp độc lập cho đầu White Cartoon, Chibi và Imported Characters
 */
export function drawFacialExpressionV4(g, cx, cy, HR, rawExpr, o = {}, dir = 'front', inkCol = '#111827', t = 0) {
  const expr = normalizeExpressionName(rawExpr);
  const isFront = dir === 'front';
  const isSide = dir.startsWith('side');

  // Tính toán hướng nhìn (look tracking)
  const look = o.look || [0, 0];
  const lookDx = Math.max(-1, Math.min(1, look[0])) * 4;
  const lookDy = Math.max(-1, Math.min(1, look[1])) * 3;

  const eyeX = isFront ? [-15, 15] : isSide ? [14] : [-6, 18];
  const eyeY = cy - 4;
  const mouthX = isFront ? cx : isSide ? cx + 12 : cx + 6;
  const mouthY = eyeY + 22;

  g.save();

  // ==========================================
  // 1. OVERLAY MARKS BÊN DƯỚI (Background Marks)
  // ==========================================
  if (expr === 'shocked') {
    // Vệt sọc xanh dọc trán biểu hiện bàng hoàng
    g.strokeStyle = '#0284c7';
    g.lineWidth = 2.5;
    [-12, 0, 12].forEach(dx => {
      g.beginPath();
      g.moveTo(cx + dx, cy - HR + 6);
      g.lineTo(cx + dx, cy - HR + 26);
      g.stroke();
    });
  } else if (expr === 'scared') {
    // Bóng tái mặt lạnh
    g.save();
    g.fillStyle = 'rgba(56, 189, 248, 0.18)';
    g.beginPath();
    g.arc(cx, cy, HR - 2, Math.PI * 0.8, Math.PI * 1.5);
    g.fill();
    g.restore();
  }

  // ==========================================
  // 2. MẮT (EYES)
  // ==========================================
  if (o.blink) {
    // Chớp mắt nhắm
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(cx + ex, eyeY + 2, 7, Math.PI + 0.3, Math.PI * 2 - 0.3);
      g.stroke();
    });
  } else if (expr === 'happy' || expr === 'laughing') {
    // Mắt cười híp cong hình cung
    g.strokeStyle = inkCol;
    g.lineWidth = 3.8;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(cx + ex, eyeY + 1, 8.5, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    });
  } else if (expr === 'crying') {
    // Mắt khóc nhắm nghiền hình chữ > <
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;
    g.beginPath();
    g.moveTo(cx + eyeX[0] - 6, eyeY - 5);
    g.lineTo(cx + eyeX[0] + 5, eyeY);
    g.lineTo(cx + eyeX[0] - 6, eyeY + 5);
    g.stroke();
    if (eyeX.length > 1) {
      g.beginPath();
      g.moveTo(cx + eyeX[1] + 6, eyeY - 5);
      g.lineTo(cx + eyeX[1] - 5, eyeY);
      g.lineTo(cx + eyeX[1] + 6, eyeY + 5);
      g.stroke();
    }
  } else if (expr === 'dizzy') {
    // Mắt xoắn ốc (Hypnotic Swirl) xoay đều theo thời gian
    const swirlAngle = t * 6;
    eyeX.forEach(ex => {
      g.save();
      g.translate(cx + ex, eyeY);
      g.rotate(swirlAngle);
      g.strokeStyle = inkCol;
      g.lineWidth = 2.4;
      g.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.25) {
        const r = (a / (Math.PI * 4)) * 9;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.restore();
    });
  } else if (expr === 'love_eyes') {
    // Mắt hình trái tim đỏ
    eyeX.forEach(ex => {
      g.save();
      g.translate(cx + ex, eyeY);
      const pulse = 1.0 + Math.sin(t * 10) * 0.12;
      g.scale(pulse, pulse);
      g.fillStyle = '#ef4444';
      g.strokeStyle = '#991b1b';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, 3);
      g.bezierCurveTo(-9, -6, -9, -15, 0, -8);
      g.bezierCurveTo(9, -15, 9, -6, 0, 3);
      g.fill();
      g.stroke();
      g.restore();
    });
  } else if (expr === 'shocked') {
    // Mắt trợn tròn đồng tử thu nhỏ cực độ
    eyeX.forEach(ex => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.2;
      g.beginPath();
      g.arc(cx + ex, eyeY, 12, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(cx + ex, eyeY, 3.2, 0, Math.PI * 2);
      g.fill();
    });
  } else if (expr === 'terrified') {
    // Mắt kinh hãi tột độ, đồng tử co giật tí hon
    const jitter = Math.sin(t * 40) * 1.5;
    eyeX.forEach(ex => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.4;
      g.beginPath();
      g.arc(cx + ex + jitter, eyeY, 11, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(cx + ex + jitter + lookDx * 0.3, eyeY + lookDy * 0.3, 3.0, 0, Math.PI * 2);
      g.fill();

      // Vạch mí mắt dưới co giật
      g.strokeStyle = inkCol;
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(cx + ex, eyeY + 12, 7, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    });
  } else if (expr === 'scared') {
    // Mắt sợ hãi rung rẩy
    const jitter = Math.sin(t * 36) * 1.2;
    eyeX.forEach(ex => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.2;
      g.beginPath();
      g.ellipse(cx + ex + jitter, eyeY, 10, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(cx + ex + jitter + lookDx * 0.5, eyeY + lookDy * 0.5, 4.8, 0, Math.PI * 2);
      g.fill();
    });
  } else if (expr === 'determined') {
    // Mắt tập trung cao độ, sắc sảo
    eyeX.forEach(ex => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.0;
      g.beginPath();
      g.arc(cx + ex + lookDx * 0.35, eyeY + lookDy * 0.35, 8.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(cx + ex + lookDx * 0.9, eyeY + lookDy * 0.9, 5.0, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + ex + lookDx * 0.9 + 1.8, eyeY + lookDy * 0.9 - 1.8, 2.0, 0, Math.PI * 2);
      g.fill();
    });
  } else if (expr === 'relief') {
    // Mắt nhắm cong nhẹ nhõm
    g.strokeStyle = inkCol;
    g.lineWidth = 3.4;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(cx + ex, eyeY + 1, 7.5, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    });
  } else if (expr === 'angry') {
    // Mắt tức giận sắc lẹm
    eyeX.forEach(ex => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.0;
      g.beginPath();
      g.arc(cx + ex + lookDx * 0.4, eyeY + lookDy * 0.4, 8.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(cx + ex + lookDx * 0.8, eyeY + lookDy * 0.8, 5.0, 0, Math.PI * 2);
      g.fill();
    });
  } else {
    // Mắt tiêu chuẩn (Neutral / Thinking / Talking)
    eyeX.forEach(ex => {
      const pupilShiftX = expr === 'thinking' ? 2 : lookDx;
      const pupilShiftY = expr === 'thinking' ? -3 : lookDy;

      g.fillStyle = inkCol;
      g.beginPath();
      g.ellipse(cx + ex + pupilShiftX, eyeY + pupilShiftY, 6.2, 8.5, 0, 0, Math.PI * 2);
      g.fill();

      // Đốm sáng phản chiếu (catchlight)
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + ex + pupilShiftX + 1.8, eyeY + pupilShiftY - 2.2, 2.5, 0, Math.PI * 2);
      g.fill();
    });
  }

  // ==========================================
  // 3. LÔNG MÀY (EYEBROWS)
  // ==========================================
  g.strokeStyle = inkCol;
  g.lineWidth = 3.2;
  eyeX.forEach((ex, i) => {
    g.beginPath();
    const bx = cx + ex;
    const by = eyeY - 14;

    if (expr === 'angry') {
      // Chúc nhọn hung dữ: \   /
      const sign = i === 0 ? 1 : -1;
      g.moveTo(bx - 7, by - sign * 3);
      g.lineTo(bx + 7, by + sign * 3);
    } else if (expr === 'determined') {
      // Sắc bén chéo góc kiên định: \ /
      const sign = i === 0 ? 1 : -1;
      g.moveTo(bx - 7, by - sign * 2);
      g.lineTo(bx + 7, by + sign * 2);
    } else if (expr === 'smirk') {
      // Một bên nhướng một bên phẳng
      if (i === 0) {
        g.arc(bx, by - 4, 7, Math.PI * 1.15, Math.PI * 1.85);
      } else {
        g.moveTo(bx - 6, by);
        g.lineTo(bx + 6, by);
      }
    } else if (expr === 'terrified') {
      // Lông mày lượn sóng run rẩy
      const wave = Math.sin(t * 32 + i * 2) * 2;
      g.moveTo(bx - 6, by + wave);
      g.quadraticCurveTo(bx, by - 4 + wave, bx + 6, by - wave);
    } else if (expr === 'sad' || expr === 'crying') {
      // Rủ xuống thương cảm: /   \
      const sign = i === 0 ? -1 : 1;
      g.moveTo(bx - 7, by - sign * 3);
      g.lineTo(bx + 7, by + sign * 3);
    } else if (expr === 'surprised' || expr === 'shocked') {
      // Nhướng cao ngạc nhiên hình cầu vồng
      g.arc(bx, by - 4, 7, Math.PI * 1.15, Math.PI * 1.85);
    } else if (expr === 'thinking') {
      // Một bên nhướng cao, một bên phẳng
      if (i === 1) {
        g.arc(bx, by - 5, 7, Math.PI * 1.15, Math.PI * 1.85);
      } else {
        g.moveTo(bx - 6, by + 1);
        g.lineTo(bx + 6, by + 1);
      }
    } else {
      // Vòm cong tự nhiên bình thường
      g.moveTo(bx - 6, by);
      g.quadraticCurveTo(bx, by - 3.5, bx + 6, by);
    }
    g.stroke();
  });

  // ==========================================
  // 4. KHUÔN MIỆNG (MOUTH)
  // ==========================================
  if (expr === 'happy') {
    // Miệng cười mở vui tươi
    g.fillStyle = '#991b1b';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(mouthX - 10, mouthY - 2);
    g.quadraticCurveTo(mouthX, mouthY + 14, mouthX + 10, mouthY - 2);
    g.closePath();
    g.fill();
    g.stroke();
    // Lưỡi hồng bên trong
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(mouthX, mouthY + 4, 5, 0, Math.PI);
    g.fill();
  } else if (expr === 'laughing') {
    // Miệng cười há to sảng khoái
    g.fillStyle = '#881337';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;
    g.beginPath();
    g.moveTo(mouthX - 13, mouthY - 4);
    g.quadraticCurveTo(mouthX, mouthY + 18, mouthX + 13, mouthY - 4);
    g.closePath();
    g.fill();
    g.stroke();
    // Răng trên trắng
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.rect(mouthX - 8, mouthY - 3, 16, 4);
    g.fill();
  } else if (expr === 'sad') {
    // Miệng buồn mếu u sầu
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(mouthX, mouthY + 8, 9, Math.PI * 1.25, Math.PI * 1.75);
    g.stroke();
  } else if (expr === 'crying') {
    // Miệng há khóc mếu quằn quại
    g.fillStyle = '#991b1b';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(mouthX, mouthY + 2, 10, 0, Math.PI);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (expr === 'angry') {
    // Răng cắn chặt tức giận
    g.fillStyle = '#ffffff';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.0;
    g.beginPath();
    g.roundRect(mouthX - 12, mouthY - 4, 24, 10, 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(mouthX - 12, mouthY + 1);
    g.lineTo(mouthX + 12, mouthY + 1);
    g.moveTo(mouthX - 4, mouthY - 4);
    g.lineTo(mouthX - 4, mouthY + 6);
    g.moveTo(mouthX + 4, mouthY - 4);
    g.lineTo(mouthX + 4, mouthY + 6);
    g.stroke();
  } else if (expr === 'surprised') {
    // Miệng chữ O ngạc nhiên
    g.fillStyle = '#881337';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.0;
    g.beginPath();
    g.ellipse(mouthX, mouthY + 2, 7, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (expr === 'terrified') {
    // Miệng há to hét lên kinh hãi
    g.save();
    g.fillStyle = '#6b1124';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.4;
    g.beginPath();
    g.ellipse(mouthX, mouthY + 3, 11, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.clip();
    // Răng trên bo tròn bên trong
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(mouthX, mouthY - 7, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
    // Lưỡi hồng
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(mouthX, mouthY + 14, 8, 0, Math.PI);
    g.fill();
    g.restore();
  } else if (expr === 'determined') {
    // Miệng mím chặt kiên định, vết khóe miệng
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(mouthX - 8, mouthY);
    g.quadraticCurveTo(mouthX, mouthY + 2, mouthX + 8, mouthY - 1);
    g.stroke();
    g.beginPath();
    g.moveTo(mouthX + 7, mouthY - 3);
    g.lineTo(mouthX + 9, mouthY + 1);
    g.stroke();
  } else if (expr === 'smirk') {
    // Cười nhếch mép
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(mouthX - 6, mouthY + 1);
    g.quadraticCurveTo(mouthX + 2, mouthY + 3, mouthX + 8, mouthY - 3);
    g.stroke();
  } else if (expr === 'relief') {
    // Thở phào nhẹ nhõm
    g.strokeStyle = inkCol;
    g.lineWidth = 3.0;
    g.beginPath();
    g.arc(mouthX, mouthY - 1, 7, 0.2, Math.PI - 0.2);
    g.stroke();
  } else if (expr === 'shocked' || expr === 'scared') {
    // Miệng răng va lập cập hoặc há hốc
    g.fillStyle = '#6b1124';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.ellipse(mouthX, mouthY + 3, 9, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Răng trên
    g.fillStyle = '#ffffff';
    g.fillRect(mouthX - 6, mouthY - 5, 12, 4);
  } else if (expr === 'dizzy') {
    // Miệng lượn sóng chóng mặt
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(mouthX - 10, mouthY);
    g.quadraticCurveTo(mouthX - 5, mouthY + 5, mouthX, mouthY);
    g.quadraticCurveTo(mouthX + 5, mouthY - 5, mouthX + 10, mouthY);
    g.stroke();
  } else if (expr === 'talking') {
    // Miệng nói chuyển động mở/đóng theo nhịp
    const talkCycle = Math.abs(Math.sin((t || 0) * 12 + (o.talk || 0) * 4));
    const openH = 2 + talkCycle * 8;
    g.fillStyle = '#881337';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.0;
    g.beginPath();
    g.ellipse(mouthX, mouthY, 8, openH, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else {
    // Miệng điềm tĩnh mỉm nhẹ
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(mouthX, mouthY - 2, 8, 0.25, Math.PI - 0.25);
    g.stroke();
  }

  // ==========================================
  // 5. COMIC OVERLAY MARKS BÊN TRÊN
  // ==========================================
  if (expr === 'crying') {
    // Dòng nước mắt hoạt hình tuôn trào hai bên má
    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#0284c7';
    g.lineWidth = 2.0;
    const tearDropY = eyeY + 12 + ((t * 80) % 24);
    eyeX.forEach(ex => {
      // Dòng nước
      g.beginPath();
      g.moveTo(cx + ex - 3, eyeY + 6);
      g.lineTo(cx + ex - 2, eyeY + 22);
      g.lineTo(cx + ex + 2, eyeY + 22);
      g.lineTo(cx + ex + 3, eyeY + 6);
      g.closePath();
      g.fill();
      // Giọt rơi
      g.beginPath();
      g.arc(cx + ex, tearDropY, 3, 0, Math.PI * 2);
      g.fill();
    });
  } else if (expr === 'angry') {
    // Dấu gân giận đỏ giật giật trên thái dương
    const pulse = 1.0 + Math.sin(t * 16) * 0.15;
    g.save();
    g.translate(cx + 26, cy - HR * 0.6);
    g.scale(pulse, pulse);
    g.strokeStyle = '#ef4444';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(-6, -6); g.lineTo(6, 6);
    g.moveTo(6, -6); g.lineTo(-6, 6);
    g.stroke();
    g.restore();
  } else if (expr === 'dizzy') {
    // Ngôi sao vàng bay vòng trên đỉnh đầu
    const starAngle = t * 4;
    for (let i = 0; i < 3; i++) {
      const a = starAngle + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * 26;
      const sy = cy - HR - 10 + Math.sin(a) * 8;
      g.fillStyle = '#eab308';
      g.beginPath();
      g.arc(sx, sy, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  } else if (expr === 'scared') {
    // Giọt mồ hôi lạnh to bên thái dương
    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#0284c7';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(cx + 22, cy - HR * 0.3);
    g.quadraticCurveTo(cx + 17, cy - HR * 0.1, cx + 22, cy - HR * 0.05);
    g.quadraticCurveTo(cx + 27, cy - HR * 0.1, cx + 22, cy - HR * 0.3);
    g.fill();
    g.stroke();
  } else if (expr === 'thinking') {
    // Dấu chấm hỏi vàng trên đỉnh đầu
    g.fillStyle = '#eab308';
    g.font = 'bold 16px sans-serif';
    g.fillText('?', cx + 20, cy - HR - 4);
  } else if (expr === 'happy' || expr === 'love_eyes') {
    // Má hồng ngọt ngào
    g.fillStyle = 'rgba(251, 113, 133, 0.45)';
    g.beginPath();
    g.ellipse(cx - 18, eyeY + 12, 6, 4, 0, 0, Math.PI * 2);
    g.ellipse(cx + 18, eyeY + 12, 6, 4, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.restore();
}
