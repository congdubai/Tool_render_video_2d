"""Comprehensive test suite for Character Geometry, Orientation, and Prop Interaction.
Generates all 5 mandatory visual test deliverables at 1280x720 resolution and short MP4 motion video.
"""
import os, sys, math, subprocess
import skia
import numpy as np

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine.kit import *
from engine.props import draw_hand_grip, doc_hand_grip, DOCS
from engine.chibi_rig import draw_chibi_character, resolve_chibi_look, resolve_facing

OUT_DIR = os.path.abspath("../output_videos")
os.makedirs(OUT_DIR, exist_ok=True)

# Shared Styling Helpers
SEGOE = skia.Typeface('Segoe UI')
TITLE_FONT = skia.Font(SEGOE, 28)
SUB_FONT = skia.Font(SEGOE, 20)
TAG_FONT = skia.Font(SEGOE, 16)
P_TITLE = skia.Paint(Color=skia.Color(240, 240, 245), AntiAlias=True)
P_SUB = skia.Paint(Color=skia.Color(160, 165, 180), AntiAlias=True)
P_BG = skia.Paint(Color=skia.Color(20, 22, 28))
P_PANEL = skia.Paint(Color=skia.Color(30, 33, 42))
P_BORDER = skia.Paint(Color=skia.Color(50, 55, 70), Style=skia.Paint.kStroke_Style, StrokeWidth=2.0, AntiAlias=True)


def draw_header(c, title, subtitle):
    c.drawString(title, 40, 48, TITLE_FONT, P_TITLE)
    c.drawString(subtitle, 40, 78, SUB_FONT, P_SUB)
    c.drawLine(40, 96, 1240, 96, P_BORDER)


# ==============================================================================
# TEST 1: NEWSPAPER HAND GRIP (TABLE CLOSEUP + FULL BODY HOLD)
# ==============================================================================
def render_test1():
    surf = skia.Surface(1280, 720)
    c = surf.getCanvas()
    c.clear(skia.Color(20, 22, 28))
    draw_header(c, "TEST 1: BÀN TAY CẦM TỜ BÁO (REUSABLE HAND GRIP)",
                "Cơ chế hand_grip mép giấy: ngón cái nằm trước, 4 ngón nằm sau, cổ tay nối tự nhiên")

    # Panel A: Table Closeup (Left side: 40 to 620)
    c.save()
    c.translate(330, 410)
    c.scale(0.85, 0.85)
    c.rotate(-5)

    # Hand grip behind
    doc_hand_grip(c, 'newspaper', side='left', suit_col='#5B5B66', skin_col='#E6BE8E', layer='rear')
    # Newspaper
    item_spec = {"type": "newspaper", "title": "SCIENCE WEEKLY", "text": "EFFECT MUCH SMALLER"}
    DOCS['newspaper'](c, item_spec, 1.0)
    # Hand grip front
    doc_hand_grip(c, 'newspaper', side='left', suit_col='#5B5B66', skin_col='#E6BE8E', layer='front')
    c.restore()

    # Panel A Label
    c.drawRect(skia.Rect(50, 115, 610, 160), P_PANEL)
    c.drawRect(skia.Rect(50, 115, 610, 160), P_BORDER)
    c.drawString("A. Cảnh bàn (Table): Ngón cái nằm đè trên mép báo, 4 ngón quặp phía sau", 65, 145, TAG_FONT, P_TITLE)

    # Panel B: Full Body Character Holding Newspaper (Right side: 660 to 1240)
    c.drawRect(skia.Rect(670, 115, 1230, 160), P_PANEL)
    c.drawRect(skia.Rect(670, 115, 1230, 160), P_BORDER)
    c.drawString("B. Nhân vật toàn thân: Hai tay nắm mép báo trước ngực, khớp ngón tự nhiên", 685, 145, TAG_FONT, P_TITLE)

    doc_look = resolve_chibi_look({
        'outfit': 'suit', 'color': '#5B5B66', 'hair': 'short', 'hair_col': '#222226',
        'glasses': True, 'beard': True, 'prop': 'newspaper'
    })
    c.save()
    c.translate(950, 640)
    draw_chibi_character(c, 0, 0, 1.45, doc_look, face=0.4, arms=('hold', 'hold'), eyes='dot', mouth='smile')
    c.restore()

    out_path = os.path.join(OUT_DIR, "test1_newspaper_hand_grip.png")
    surf.makeImageSnapshot().save(out_path, skia.kPNG)
    print("Saved:", out_path)


# ==============================================================================
# TEST 2: 3/4 LEFT AND 3/4 RIGHT PERSPECTIVES
# ==============================================================================
def render_test2():
    surf = skia.Surface(1280, 720)
    c = surf.getCanvas()
    c.clear(skia.Color(20, 22, 28))
    draw_header(c, "TEST 2: NHÂN VẬT GÓC NHÌN 3/4 TRÁI VÀ PHẢI",
                "Phối cảnh 3/4 thật: mắt xa nhỏ, mắt gần rộng, tai gần rõ, vai xa thu nhỏ, không bóp méo 2D")

    # Character 1: Mia (Dress) in 3/4 Left vs 3/4 Right
    mia_look = resolve_chibi_look({'outfit': 'dress', 'color': '#F2C14E', 'hair': 'bun', 'hair_col': '#2A201A'})
    doc_look = resolve_chibi_look({'outfit': 'suit', 'color': '#3A4D6B', 'hair': 'short', 'glasses': True, 'beard': True})

    # Left Column: Three Quarter Left (face = -0.6)
    c.save()
    c.translate(240, 620)
    draw_chibi_character(c, 0, 0, 1.5, mia_look, face=-0.6, arms=('explain', 'explain'))
    c.restore()

    c.save()
    c.translate(480, 620)
    draw_chibi_character(c, 0, 0, 1.5, doc_look, face=-0.6, arms=('think', 'think'))
    c.restore()

    c.drawRect(skia.Rect(60, 115, 600, 160), P_PANEL)
    c.drawRect(skia.Rect(60, 115, 600, 160), P_BORDER)
    c.drawString("GÓC 3/4 TRÁI (face = -0.6): Mắt gần bên trái, tai trái rõ, vai trái hướng tới", 80, 145, TAG_FONT, P_TITLE)

    # Right Column: Three Quarter Right (face = +0.6)
    c.save()
    c.translate(800, 620)
    draw_chibi_character(c, 0, 0, 1.5, mia_look, face=0.6, arms=('explain', 'explain'))
    c.restore()

    c.save()
    c.translate(1040, 620)
    draw_chibi_character(c, 0, 0, 1.5, doc_look, face=0.6, arms=('think', 'think'))
    c.restore()

    c.drawRect(skia.Rect(680, 115, 1220, 160), P_PANEL)
    c.drawRect(skia.Rect(680, 115, 1220, 160), P_BORDER)
    c.drawString("GÓC 3/4 PHẢI (face = +0.6): Mắt gần bên phải, tai phải rõ, vai phải hướng tới", 700, 145, TAG_FONT, P_TITLE)

    out_path = os.path.join(OUT_DIR, "test2_three_quarter_left_right.png")
    surf.makeImageSnapshot().save(out_path, skia.kPNG)
    print("Saved:", out_path)


# ==============================================================================
# TEST 3: WALK AND TURN ANIMATION (VIDEO + FRAME SHEET)
# ==============================================================================
def render_test3():
    fps = 30
    duration = 4.0  # 4 seconds
    total_frames = int(fps * duration)
    sam_look = resolve_chibi_look({'outfit': 'hoodie', 'color': '#2F7A5A', 'hair': 'curly', 'hair_col': '#1C1B22'})

    vid_path = os.path.join(OUT_DIR, "test3_walk_and_turn.mp4")
    p = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
        "-s", "1280x720", "-r", str(fps), "-i", "-",
        "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", vid_path
    ], stdin=subprocess.PIPE)

    keyframe_indices = [5, 30, 55, 65, 85, 110]
    captured_frames = []

    for f in range(total_frames):
        t = f / fps
        surf = skia.Surface(1280, 720)
        c = surf.getCanvas()
        c.clear(skia.Color(24, 26, 32))

        # Background street pavement & grid lines
        c.drawLine(0, 580, 1280, 580, ink(4, '#383D4C'))
        for gx in range(0, 1300, 120):
            c.drawLine(gx, 580, gx - 40, 720, ink(2, '#2C303E'))

        # Animation Phases:
        # Phase 1: 0.0s - 1.8s (Walk Right: x = 200 -> 880, face = 0.65)
        # Phase 2: 1.8s - 2.2s (Turn Around: face smoothly lerps 0.65 -> -0.65)
        # Phase 3: 2.2s - 4.0s (Walk Left: x = 880 -> 200, face = -0.65)
        if t < 1.8:
            u = t / 1.8
            x = 240 + u * (880 - 240)
            face = 0.65
            ph = t * 14.0
            status_text = f"ĐI SANG PHẢI (t={t:.2f}s, face=+0.65)"
        elif t < 2.2:
            x = 880
            turn_u = (t - 1.8) / 0.4
            face = 0.65 - turn_u * 1.30  # +0.65 to -0.65
            ph = 0.0
            status_text = f"QUAY ĐẦU (t={t:.2f}s, face={face:+.2f})"
        else:
            u = (t - 2.2) / 1.8
            x = 880 - u * (880 - 240)
            face = -0.65
            ph = (t - 2.2) * 14.0
            status_text = f"ĐI SANG TRÁI (t={t:.2f}s, face=-0.65)"

        is_walk = (t < 1.8 or t > 2.2)
        legs = None
        if is_walk:
            # walk legs kinematics
            swing = math.sin(ph) * 24.0
            legs = ((-18, -swing, max(0, -swing)), (18, swing, max(0, swing)))

        draw_header(c, "TEST 3: ĐI TỪ TRÁI SANG PHẢI RỒI QUAY ĐẦU",
                    "Nhân vật nhìn đúng hướng khi di chuyển: đi phải nhìn phải, đi trái nhìn trái, quay đầu mượt")

        c.drawRect(skia.Rect(50, 115, 650, 160), P_PANEL)
        c.drawRect(skia.Rect(50, 115, 650, 160), P_BORDER)
        c.drawString(status_text, 65, 145, TAG_FONT, P_TITLE)

        c.save()
        c.translate(x, 580)
        draw_chibi_character(c, 0, 0, 1.4, sam_look, face=face, legs=legs, t=t)
        c.restore()

        buf = surf.makeImageSnapshot().tobytes()
        p.stdin.write(buf)

        if f in keyframe_indices:
            captured_frames.append((f, t, surf.makeImageSnapshot()))

    p.stdin.close()
    p.wait()
    print("Saved video:", vid_path)

    # Make 6-frame contact sheet
    sheet_surf = skia.Surface(1280, 720)
    sc = sheet_surf.getCanvas()
    sc.clear(skia.Color(20, 22, 28))
    draw_header(sc, "TEST 3: BẢNG TIẾP XÚC CHUYỂN ĐỘNG (WALK & TURN SHEET)",
                "Trích xuất 6 frame: Đi sang phải -> Quay đầu chuyển góc nhìn -> Đi sang trái")

    tw, th = 380, 214
    cols = 3
    for idx, (kf, kt, img) in enumerate(captured_frames[:6]):
        col_i = idx % cols
        row_i = idx // cols
        px = 45 + col_i * (tw + 28)
        py = 120 + row_i * (th + 52)
        sc.drawImageRect(img, skia.Rect(px, py, px + tw, py + th), skia.SamplingOptions(skia.FilterMode.kLinear))
        sc.drawRect(skia.Rect(px, py, px + tw, py + th), P_BORDER)
        sc.drawString(f"Frame {kf} ({kt:.2f}s)", px + 10, py + th + 28, TAG_FONT, P_TITLE)

    sheet_out = os.path.join(OUT_DIR, "test3_walk_and_turn_sheet.png")
    sheet_surf.makeImageSnapshot().save(sheet_out, skia.kPNG)
    print("Saved sheet:", sheet_out)


# ==============================================================================
# TEST 4: PROFESSOR DOC HAIR, HEAD, GLASSES & BEARD DETAILS
# ==============================================================================
def render_test4():
    surf = skia.Surface(1280, 720)
    c = surf.getCanvas()
    c.clear(skia.Color(20, 22, 28))
    draw_header(c, "TEST 4: ÔNG GIÁO SƯ (TÓC, ĐẦU, KÍNH & RÂU KHÔNG LỖI HÌNH HỌC)",
                "Kiểm tra 3 mức zoom: Tóc bao trọn vòm sọ (không hở da), kính nối tai, râu ôm cằm không cắt môi")

    doc_look = resolve_chibi_look({
        'outfit': 'suit', 'color': '#3A4D6B', 'hair': 'short', 'hair_col': '#222226',
        'glasses': True, 'beard': True
    })

    # Zoom 1: Full Body (s = 1.0)
    c.drawRect(skia.Rect(40, 115, 380, 680), P_PANEL)
    c.drawRect(skia.Rect(40, 115, 380, 680), P_BORDER)
    c.drawString("1. TỶ LỆ TOÀN THÂN (1.0x)", 55, 145, TAG_FONT, P_TITLE)
    c.save()
    c.translate(210, 620)
    draw_chibi_character(c, 0, 0, 1.25, doc_look, face=0.55, arms=('explain', 'explain'))
    c.restore()

    # Zoom 2: Bust / Medium (s = 1.6)
    c.drawRect(skia.Rect(420, 115, 780, 680), P_PANEL)
    c.drawRect(skia.Rect(420, 115, 780, 680), P_BORDER)
    c.drawString("2. CẬN CẢNH NGỰC (1.6x)", 435, 145, TAG_FONT, P_TITLE)
    c.save()
    c.translate(600, 640)
    draw_chibi_character(c, 0, 0, 1.9, doc_look, face=0.55, arms=('point', 'point'))
    c.restore()

    # Zoom 3: Macro Portrait Closeup (s = 2.4)
    c.drawRect(skia.Rect(820, 115, 1240, 680), P_PANEL)
    c.drawRect(skia.Rect(820, 115, 1240, 680), P_BORDER)
    c.drawString("3. ĐẶC TẢ CHI TIẾT ĐẦU (2.4x)", 835, 145, TAG_FONT, P_TITLE)
    c.save()
    c.translate(1030, 840)
    draw_chibi_character(c, 0, 0, 2.7, doc_look, face=0.55, arms=('think', 'think'))
    c.restore()

    out_path = os.path.join(OUT_DIR, "test4_professor_doc_details.png")
    surf.makeImageSnapshot().save(out_path, skia.kPNG)
    print("Saved:", out_path)


# ==============================================================================
# TEST 5: GROUP IN 5 DIFFERENT FACING DIRECTIONS
# ==============================================================================
def render_test5():
    surf = skia.Surface(1280, 720)
    c = surf.getCanvas()
    c.clear(skia.Color(20, 22, 28))
    draw_header(c, "TEST 5: NHÓM NHÂN VẬT Ở 5 HƯỚNG NHÌN KHÁC NHAU",
                "Chuẩn hóa 5 góc nhìn: Nghiêng trái (-1.0) -> 3/4 Trái (-0.6) -> Chính diện (0.0) -> 3/4 Phải (+0.6) -> Nghiêng phải (+1.0)")

    characters = [
        ("1. NGHIÊNG TRÁI (-1.0)", -1.0, 140, resolve_chibi_look({'outfit': 'soldier', 'color': '#6E7A64', 'hair': 'short'})),
        ("2. 3/4 TRÁI (-0.6)", -0.6, 390, resolve_chibi_look({'outfit': 'hoodie', 'color': '#2F7A5A', 'hair': 'curly'})),
        ("3. CHÍNH DIỆN (0.0)", 0.0, 640, resolve_chibi_look({'outfit': 'dress', 'color': '#F2C14E', 'hair': 'bun'})),
        ("4. 3/4 PHẢI (+0.6)", 0.6, 890, resolve_chibi_look({'outfit': 'suit', 'color': '#3A4D6B', 'hair': 'short', 'glasses': True, 'beard': True})),
        ("5. NGHIÊNG PHẢI (+1.0)", 1.0, 1140, resolve_chibi_look({'outfit': 'tshirt', 'color': '#C8242C', 'hair': 'slick', 'hat': 'cap'}))
    ]

    for label, face_dir, cx, look in characters:
        c.drawRect(skia.Rect(cx - 110, 115, cx + 110, 155), P_PANEL)
        c.drawRect(skia.Rect(cx - 110, 115, cx + 110, 155), P_BORDER)
        c.drawString(label, cx - 95, 142, skia.Font(SEGOE, 14), P_TITLE)

        c.save()
        c.translate(cx, 620)
        draw_chibi_character(c, 0, 0, 1.45, look, face=face_dir, arms=('explain' if abs(face_dir) < 0.8 else 'down', 'down'))
        c.restore()

    out_path = os.path.join(OUT_DIR, "test5_group_facing_directions.png")
    surf.makeImageSnapshot().save(out_path, skia.kPNG)
    print("Saved:", out_path)


if __name__ == "__main__":
    print("Running 5 Mandatory Character Geometry & Orientation Tests...")
    render_test1()
    render_test2()
    render_test3()
    render_test4()
    render_test5()
    print("ALL 5 TESTS COMPLETED SUCCESSFULLY!")
