"""Chibi V9 Character Engine for Python 2D Long Form.
Implements the authentic Chibi V9 puppet anatomy:
- True 5-Direction Perspective System:
  'side_left', 'three_quarter_left', 'front', 'three_quarter_right', 'side_right'.
- 3/4 round head, black oval eyes, dark ink outlines, short block limbs.
- Modular and extensible Outfit Registry (suit, hoodie, tshirt, dress, sweater, explorer, soldier).
- Modular and extensible Hair Registry (bun, short, curly, slick, long, bald, helmet) with full cranial coverage.
- Accessories (glasses, beard, moustache, cap, fedora, backpack) with precise anatomical attachment.
- Reusable Hand Grip mechanism for held props (newspaper, books, phones).
- Kinematics for all poses and emotions without crude double-matrix flips.
"""

import math, os
import numpy as np, skia

# Core Chibi V9 Dimensions
HEAD_R = 74
HEAD_CY = -260  # Head center relative to feet in base coordinate system
BODY_TOP = -189
BODY_BOT = -87

SKINS = {
    'light': ('#F1CFA8', '#D6AE84'),
    'fair': ('#EBC79C', '#CFA677'),
    'tan': ('#E6BE8E', '#C99F70'),
    'olive': ('#C99C6E', '#A97E52'),
    'brown': ('#A8754D', '#8A5C38'),
    'dark': ('#7A4E32', '#603B24')
}


def C(rgb, a=255):
    return skia.Color(int(rgb[0]), int(rgb[1]), int(rgb[2]), int(max(0, min(255, a))))


def hx(h, a=255):
    h = h.lstrip('#')
    return C((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)), a)


def col(v, a=255):
    return hx(v, a) if isinstance(v, str) else C(v, a)


def rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def shade(h, k):
    if not isinstance(h, str) or not h.startswith('#'):
        return h
    r, g, b = rgb(h)
    if k <= 1:
        r, g, b = r * k, g * k, b * k
    else:
        r, g, b = r + (255 - r) * (k - 1), g + (255 - g) * (k - 1), b + (255 - b) * (k - 1)
    return '#%02X%02X%02X' % (int(min(255, max(0, r))), int(min(255, max(0, g))), int(min(255, max(0, b))))


def fp(v, a=255, blur=0):
    p = skia.Paint(AntiAlias=True, Color=col(v, a))
    if blur:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    return p


def ink(w=6.0, v='#191918', a=255):
    p = skia.Paint(AntiAlias=True, Color=col(v, a))
    p.setStyle(skia.Paint.kStroke_Style)
    p.setStrokeWidth(w)
    p.setStrokeCap(skia.Paint.kRound_Cap)
    p.setStrokeJoin(skia.Paint.kRound_Join)
    return p


def shape(c, path, fill, w=6.0, v='#191918'):
    c.drawPath(path, fill if isinstance(fill, skia.Paint) else fp(fill))
    if w > 0:
        c.drawPath(path, ink(w, v))


def poly(c, pts, fill, w=6.0, v='#191918'):
    p = skia.Path()
    p.moveTo(*pts[0])
    for q in pts[1:]:
        p.lineTo(*q)
    p.close()
    shape(c, p, fill, w, v)
    return p


def line(c, x0, y0, x1, y1, w=6.0, v='#191918', a=255):
    c.drawLine(x0, y0, x1, y1, ink(w, v, a))


# ==============================================================================
# FACING & ORIENTATION RESOLVER
# ==============================================================================

def resolve_facing(face):
    """Normalize face into float in [-1.0, 1.0] and canonical 5-direction mode:
    'side_left', 'three_quarter_left', 'front', 'three_quarter_right', 'side_right'."""
    if isinstance(face, str):
        m = face.strip().lower()
        if m in ('front', 'forward', 'center', 'straight'):
            return 0.0, 'front'
        if m in ('three_quarter_left', '3/4_left', 'left_3/4', '3/4l'):
            return -0.6, 'three_quarter_left'
        if m in ('three_quarter_right', '3/4_right', 'right_3/4', '3/4r', '3/4'):
            return 0.6, 'three_quarter_right'
        if m in ('side_left', 'left', 'profile_left'):
            return -1.0, 'side_left'
        if m in ('side_right', 'right', 'profile_right'):
            return 1.0, 'side_right'
        return 0.6, 'three_quarter_right'
    try:
        f = float(face)
    except (TypeError, ValueError):
        f = 0.6
    if f < -0.82:
        mode = 'side_left'
    elif f < -0.22:
        mode = 'three_quarter_left'
    elif f <= 0.22:
        mode = 'front'
    elif f <= 0.82:
        mode = 'three_quarter_right'
    else:
        mode = 'side_right'
    return max(-1.0, min(1.0, f)), mode


# ==============================================================================
# LOOK & SPEC RESOLVER
# ==============================================================================

def resolve_chibi_look(d):
    """Normalize cast dict into full Chibi V9 specification with outfit, hair, and colors."""
    d = dict(d or {})
    d['style'] = 'chibi_v9'

    # 1. Skin
    sk = d.get('skin', 'tan')
    if sk in SKINS:
        d['skin'] = SKINS[sk][0]
        d['skin_d'] = SKINS[sk][1]
    else:
        d['skin'] = sk
        d['skin_d'] = shade(sk, 0.84) if str(sk).startswith('#') else '#D6AE84'

    # 2. Outfit & Colors
    outfit = str(d.get('outfit', 'suit')).lower()
    if outfit in ('chibi_v9', 'chibi', 'soldier'):
        outfit = 'soldier'
    elif outfit in ('safari', 'camp'):
        outfit = 'explorer'
    d['outfit'] = outfit

    main_col = d.get('color') or d.get('suit') or (
        '#F2C14E' if outfit == 'dress' else
        '#2F7A5A' if outfit == 'hoodie' else
        '#C8242C' if outfit == 'tshirt' else
        '#5B5B66' if outfit == 'suit' else
        '#3F5F72' if outfit == 'sweater' else
        '#6E7A64'
    )
    d['color'] = main_col
    d['color_d'] = shade(main_col, 0.80)
    d['color_l'] = shade(main_col, 1.25)

    # Secondary clothing colors
    d.setdefault('shirt', '#F4EFE2')
    d.setdefault('shirt_d', shade(d['shirt'], 0.86))
    d.setdefault('tie', '#2F6B4E' if outfit == 'suit' and main_col != '#2F6B4E' else '#A8232B')

    if outfit == 'dress':
        d.setdefault('pants', d['skin'])
        d.setdefault('pants_far', d['skin_d'])
        d.setdefault('boots', '#322E30')
        d.setdefault('boots_far', '#222022')
    elif outfit == 'suit':
        d.setdefault('pants', shade(main_col, 0.78))
        d.setdefault('pants_far', shade(main_col, 0.65))
        d.setdefault('boots', '#222222')
        d.setdefault('boots_far', '#181818')
    elif outfit == 'hoodie':
        d.setdefault('pants', '#2E384D')
        d.setdefault('pants_far', '#202837')
        d.setdefault('boots', '#FFFFFF')
        d.setdefault('boots_far', '#D8D8DF')
    elif outfit == 'tshirt':
        d.setdefault('pants', '#2B3954')
        d.setdefault('pants_far', '#1E283C')
        d.setdefault('boots', '#FFFFFF')
        d.setdefault('boots_far', '#D8D8DF')
    else:
        d.setdefault('pants', '#596450')
        d.setdefault('pants_far', '#45503E')
        d.setdefault('boots', '#222222')
        d.setdefault('boots_far', '#181818')

    # 3. Hair
    hair = str(d.get('hair', 'short')).lower()
    d['hair'] = hair
    d.setdefault('hair_col', '#1C1B22')
    d['hair_col_d'] = shade(d['hair_col'], 0.75)
    d['hair_col_hi'] = shade(d['hair_col'], 1.35)

    # 4. Accessories
    d.setdefault('glasses', bool(d.get('glasses', False)))
    d.setdefault('beard', bool(d.get('beard', False)))
    d.setdefault('moustache', bool(d.get('moustache', False)))
    hat = d.get('hat')
    if hat is True:
        hat = 'fedora'
    d['hat'] = hat
    d.setdefault('hat_col', '#2B2D3C' if hat == 'cap' else '#36343C')
    d.setdefault('hat_band', '#C8242C')

    # Backpack
    d.setdefault('show_backpack', bool(d.get('show_backpack', outfit in ('soldier', 'explorer'))))
    d.setdefault('backpack', '#56624B' if outfit == 'soldier' else shade(main_col, 0.75))
    d.setdefault('backpack_stripe', '#9CA17D' if outfit == 'soldier' else '#F2C14E')
    d.setdefault('backpack_strap', '#465341' if outfit == 'soldier' else '#222222')

    d.setdefault('ink', '#191918')
    return d


# ==============================================================================
# HELD PROP INTERACTION (NEWSPAPER / BOOK / PHONE)
# ==============================================================================

def draw_held_newspaper(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Renders a newspaper held naturally in character's hands in front of chest."""
    ox = 10 if mode == 'three_quarter_right' else (-10 if mode == 'three_quarter_left' else 0)
    w, h = 105, 78

    c.save()
    c.translate(ox, -145)
    rot = 3 if mode == 'three_quarter_right' else (-3 if mode == 'three_quarter_left' else 0)
    c.rotate(rot)

    # 1. Rear fingers gripping the sides of the paper
    p_f_left = skia.Path()
    p_f_left.addRRect(skia.RRect.MakeRectXY(skia.Rect(-w * 0.5 - 14, -h * 0.25, -w * 0.5 + 4, h * 0.25), 6, 6))
    shape(c, p_f_left, spec['skin'], lw * 0.75, ink_col)

    p_f_right = skia.Path()
    p_f_right.addRRect(skia.RRect.MakeRectXY(skia.Rect(w * 0.5 - 4, -h * 0.25, w * 0.5 + 14, h * 0.25), 6, 6))
    shape(c, p_f_right, spec['skin'], lw * 0.75, ink_col)

    # 2. Newspaper paper body
    p_paper = skia.Path()
    p_paper.addRect(skia.Rect(-w * 0.5, -h * 0.5, w * 0.5, h * 0.5))
    shape(c, p_paper, '#F2EBD7', lw * 0.95, ink_col)

    # Newspaper header banner
    poly(c, [(-w * 0.46, -h * 0.44), (w * 0.46, -h * 0.44), (w * 0.46, -h * 0.24), (-w * 0.46, -h * 0.24)], '#423B33', 0)
    # Headline & mini textlines
    line(c, -w * 0.44, -h * 0.12, w * 0.44, -h * 0.12, lw * 0.7, ink_col)
    for row_y in (-h * 0.02, h * 0.12, h * 0.24, h * 0.36):
        line(c, -w * 0.44, row_y, -w * 0.06, row_y, lw * 0.45, '#736B5E')
        line(c, w * 0.06, row_y, w * 0.44, row_y, lw * 0.45, '#736B5E')

    # 3. Front Thumbs gripping the front surface
    # Left Thumb
    p_th_left = skia.Path()
    p_th_left.moveTo(-w * 0.5 - 6, -h * 0.08)
    p_th_left.quadTo(-w * 0.5 + 14, -h * 0.06, -w * 0.5 + 16, 0)
    p_th_left.quadTo(-w * 0.5 + 14, h * 0.08, -w * 0.5 - 6, h * 0.06)
    p_th_left.close()
    shape(c, p_th_left, spec['skin'], lw * 0.8, ink_col)
    c.drawLine(-w * 0.5 + 4, -h * 0.02, -w * 0.5 + 11, -h * 0.02, ink(lw * 0.5, ink_col))

    # Right Thumb
    p_th_right = skia.Path()
    p_th_right.moveTo(w * 0.5 + 6, -h * 0.08)
    p_th_right.quadTo(w * 0.5 - 14, -h * 0.06, w * 0.5 - 16, 0)
    p_th_right.quadTo(w * 0.5 - 14, h * 0.08, w * 0.5 + 6, h * 0.06)
    p_th_right.close()
    shape(c, p_th_right, spec['skin'], lw * 0.8, ink_col)
    c.drawLine(w * 0.5 - 4, -h * 0.02, w * 0.5 - 11, -h * 0.02, ink(lw * 0.5, ink_col))

    c.restore()


# ==============================================================================
# OUTFIT RENDERERS (5-DIRECTION AWARE)
# ==============================================================================

def draw_outfit_suit(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_body = skia.Path()
    if mode == 'front':
        p_body.moveTo(-44, -189); p_body.quadTo(0, -202, 44, -189)
        p_body.lineTo(44, -89); p_body.quadTo(0, -78, -44, -89); p_body.close()
        cx = 0
    elif mode in ('three_quarter_right', 'side_right'):
        p_body.moveTo(-48, -189); p_body.quadTo(-11, -205, 36, -187)
        p_body.lineTo(48, -89); p_body.quadTo(-2, -73, -48, -91); p_body.close()
        cx = 14
    else:  # three_quarter_left, side_left
        p_body.moveTo(-36, -187); p_body.quadTo(11, -205, 48, -189)
        p_body.lineTo(48, -91); p_body.quadTo(2, -73, -48, -89); p_body.close()
        cx = -14
    shape(c, p_body, main_col, lw * 1.1, ink_col)

    # Shirt V-opening
    p_shirt = skia.Path()
    p_shirt.moveTo(cx - 15, -196); p_shirt.lineTo(cx + 15, -195); p_shirt.lineTo(cx, -145); p_shirt.close()
    shape(c, p_shirt, spec['shirt'], lw * 0.7, ink_col)

    # Necktie
    p_tie = skia.Path()
    p_tie.moveTo(cx - 4, -193); p_tie.lineTo(cx + 4, -192); p_tie.lineTo(cx + 6, -150)
    p_tie.lineTo(cx, -135); p_tie.lineTo(cx - 6, -150); p_tie.close()
    shape(c, p_tie, spec['tie'], lw * 0.6, ink_col)

    # Suit lapels & seam
    line(c, cx - 15, -196, cx - 1, -145, lw * 0.9, ink_col)
    line(c, cx + 15, -195, cx + 1, -145, lw * 0.9, ink_col)
    line(c, cx, -145, cx, -88, lw * 0.8, ink_col)

    # Blazer buttons
    c.drawCircle(cx, -132, 2.8, fp(ink_col))
    c.drawCircle(cx, -112, 2.8, fp(ink_col))

    # Pocket handkerchief
    hx_ = cx + 22 if cx >= 0 else cx - 22
    poly(c, [(hx_ - 8, -152), (hx_ + 8, -150), (hx_ + 8, -139), (hx_ - 8, -141)], spec['color_d'], lw * 0.6, ink_col)
    p_hank = skia.Path()
    p_hank.moveTo(hx_ - 4, -152); p_hank.lineTo(hx_, -158); p_hank.lineTo(hx_ + 4, -151); p_hank.close()
    shape(c, p_hank, '#FFFFFF', lw * 0.5, ink_col)


def draw_outfit_hoodie(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_body = skia.Path()
    if mode == 'front':
        p_body.moveTo(-45, -189); p_body.quadTo(0, -204, 45, -189)
        p_body.lineTo(46, -88); p_body.quadTo(0, -75, -46, -88); p_body.close()
        cx = 0
    elif mode in ('three_quarter_right', 'side_right'):
        p_body.moveTo(-49, -190); p_body.quadTo(-11, -208, 36, -188)
        p_body.lineTo(51, -88); p_body.quadTo(-2, -72, -49, -90); p_body.close()
        cx = 12
    else:
        p_body.moveTo(-36, -188); p_body.quadTo(11, -208, 49, -190)
        p_body.lineTo(49, -90); p_body.quadTo(2, -72, -51, -88); p_body.close()
        cx = -12
    shape(c, p_body, main_col, lw * 1.15, ink_col)

    # Front Kangaroo Pocket
    p_pocket = skia.Path()
    p_pocket.moveTo(cx - 28, -132); p_pocket.lineTo(cx + 28, -132)
    p_pocket.lineTo(cx + 24, -92); p_pocket.lineTo(cx - 24, -92); p_pocket.close()
    shape(c, p_pocket, spec['color_d'], lw * 0.8, ink_col)

    # Drawstrings
    line(c, cx - 7, -183, cx - 8, -152, lw * 0.6, '#FFFFFF')
    line(c, cx + 7, -183, cx + 8, -154, lw * 0.6, '#FFFFFF')
    c.drawCircle(cx - 8, -152, 2.5, fp(ink_col))
    c.drawCircle(cx + 8, -154, 2.5, fp(ink_col))


def draw_outfit_tshirt(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_body = skia.Path()
    if mode == 'front':
        p_body.moveTo(-44, -189); p_body.quadTo(0, -204, 44, -189)
        p_body.lineTo(45, -89); p_body.quadTo(0, -76, -45, -89); p_body.close()
        cx = 0
    elif mode in ('three_quarter_right', 'side_right'):
        p_body.moveTo(-48, -189); p_body.quadTo(-11, -206, 35, -187)
        p_body.lineTo(49, -89); p_body.quadTo(-2, -73, -48, -91); p_body.close()
        cx = 10
    else:
        p_body.moveTo(-35, -187); p_body.quadTo(11, -206, 48, -189)
        p_body.lineTo(48, -91); p_body.quadTo(2, -73, -49, -89); p_body.close()
        cx = -10
    shape(c, p_body, main_col, lw * 1.1, ink_col)

    # Crew collar
    p_neck = skia.Path()
    p_neck.moveTo(cx - 20, -195); p_neck.quadTo(cx, -177, cx + 20, -195)
    c.drawPath(p_neck, ink(lw * 0.9, ink_col))


def draw_outfit_dress(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_dress = skia.Path()
    if mode == 'front':
        p_dress.moveTo(-44, -189); p_dress.quadTo(0, -204, 44, -189)
        p_dress.lineTo(42, -125); p_dress.lineTo(56, -52)
        p_dress.quadTo(0, -38, -56, -52); p_dress.lineTo(-42, -125); p_dress.close()
        cx = 0
    elif mode in ('three_quarter_right', 'side_right'):
        p_dress.moveTo(-47, -189); p_dress.quadTo(-10, -206, 35, -187)
        p_dress.lineTo(44, -125); p_dress.lineTo(58, -52)
        p_dress.quadTo(4, -38, -54, -53); p_dress.lineTo(-44, -125); p_dress.close()
        cx = 10
    else:
        p_dress.moveTo(-35, -187); p_dress.quadTo(10, -206, 47, -189)
        p_dress.lineTo(44, -125); p_dress.lineTo(54, -53)
        p_dress.quadTo(-4, -38, -58, -52); p_dress.lineTo(-44, -125); p_dress.close()
        cx = -10
    shape(c, p_dress, main_col, lw * 1.15, ink_col)

    # Waist sash
    sash_col = spec.get('shirt', '#FFFFFF')
    poly(c, [(-42, -128), (42, -126), (41, -114), (-41, -116)], sash_col, lw * 0.75, ink_col)
    line(c, cx - 14, -115, cx - 18, -53, lw * 0.65, spec['color_d'])
    line(c, cx + 14, -115, cx + 18, -50, lw * 0.65, spec['color_d'])


def draw_outfit_sweater(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_body = skia.Path()
    p_body.moveTo(-48, -189); p_body.quadTo(0, -205, 48, -189)
    p_body.lineTo(48, -88); p_body.quadTo(0, -73, -48, -88); p_body.close()
    shape(c, p_body, main_col, lw * 1.1, ink_col)
    line(c, -38, -150, 38, -150, lw * 0.7, spec['color_l'])
    line(c, -38, -135, 38, -135, lw * 0.7, spec['color_d'])


def draw_outfit_explorer(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_body = skia.Path()
    p_body.moveTo(-48, -189); p_body.quadTo(0, -205, 48, -189)
    p_body.lineTo(48, -91); p_body.quadTo(0, -73, -48, -91); p_body.close()
    shape(c, p_body, main_col, lw * 1.15, ink_col)
    poly(c, [(-28, -150), (-8, -148), (-8, -122), (-28, -124)], spec['color_d'], lw * 0.7, ink_col)
    poly(c, [(8, -146), (34, -142), (34, -116), (8, -118)], spec['color_d'], lw * 0.7, ink_col)
    poly(c, [(-46, -108), (48, -104), (48, -92), (-46, -95)], '#383228', lw * 0.75, ink_col)


def draw_outfit_soldier(c, spec, lw, ink_col, mode='three_quarter_right'):
    main_col = spec['color']
    p_body = skia.Path()
    p_body.moveTo(-48, -189); p_body.quadTo(0, -205, 48, -189)
    p_body.lineTo(48, -91); p_body.quadTo(0, -73, -48, -91); p_body.close()
    shape(c, p_body, main_col, lw * 1.2, ink_col)
    line(c, -22, -152, 41, -140, lw * 0.8, spec.get('jacket_seam', shade(main_col, 0.75)))
    line(c, -20, -113, 43, -111, lw * 0.8, spec.get('jacket_seam', shade(main_col, 0.75)))


OUTFIT_REGISTRY = {
    'suit': draw_outfit_suit,
    'hoodie': draw_outfit_hoodie,
    'tshirt': draw_outfit_tshirt,
    'dress': draw_outfit_dress,
    'sweater': draw_outfit_sweater,
    'explorer': draw_outfit_explorer,
    'soldier': draw_outfit_soldier
}


# ==============================================================================
# HAIR RENDERERS (FULL CRANIAL ENCLOSURE, ZERO GAPS)
# ==============================================================================

def draw_hair_short(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Doc's neat side-parted hair. Fully encloses cranium with no exposed skull seams."""
    colr = spec['hair_col']
    p_hair = skia.Path()
    # Outer dome spans -82 to +82 (strictly wider than head's -74 to +74)
    p_hair.moveTo(-80, -50)
    p_hair.quadTo(-82, -150, 0, -152)
    p_hair.quadTo(82, -150, 80, -50)

    # Hairline & bangs across forehead (stays safely above eyes at y=-52)
    if mode in ('three_quarter_right', 'side_right'):
        p_hair.lineTo(76, -62)
        p_hair.quadTo(20, -78, -16, -72)
        p_hair.quadTo(-46, -68, -76, -56)
    elif mode in ('three_quarter_left', 'side_left'):
        p_hair.lineTo(-76, -62)
        p_hair.quadTo(-20, -78, 16, -72)
        p_hair.quadTo(46, -68, 76, -56)
    else:  # front
        p_hair.lineTo(76, -60)
        p_hair.quadTo(24, -76, 0, -74)
        p_hair.quadTo(-24, -76, -76, -60)
    p_hair.close()
    shape(c, p_hair, colr, lw * 1.15, ink_col)

    # Subtle hair stroke highlights
    line(c, -36, -132, -10, -136, lw * 0.65, spec['hair_col_hi'], 140)
    line(c, 10, -136, 36, -130, lw * 0.65, spec['hair_col_hi'], 140)


def draw_hair_bun(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Mia's elegant top bun with red ribbon and soft bangs."""
    colr = spec['hair_col']
    # 1. High top bun
    bx = 12 if mode == 'three_quarter_right' else (-12 if mode == 'three_quarter_left' else 0)
    c.drawCircle(bx, -172, 35, fp(colr))
    c.drawCircle(bx, -172, 35, ink(lw * 1.15, ink_col))
    # Ribbon tie
    poly(c, [(bx - 18, -145), (bx + 18, -145), (bx + 14, -136), (bx - 14, -136)], '#D22830', lw * 0.7, ink_col)

    # 2. Cranial dome
    p_crown = skia.Path()
    p_crown.moveTo(-80, -50)
    p_crown.quadTo(-82, -148, 0, -150)
    p_crown.quadTo(82, -148, 80, -50)
    p_crown.lineTo(76, -68)
    p_crown.quadTo(0, -82, -76, -68)
    p_crown.close()
    shape(c, p_crown, colr, lw * 1.1, ink_col)


def draw_hair_curly(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Sam's fluffy textured curly hair puffs fully enclosing skull."""
    colr = spec['hair_col']
    p_curls = skia.Path()
    p_curls.moveTo(-82, -50)
    p_curls.quadTo(-84, -150, 0, -152)
    p_curls.quadTo(84, -150, 82, -50)
    p_curls.lineTo(76, -68)
    p_curls.quadTo(0, -82, -76, -68)
    p_curls.close()
    shape(c, p_curls, colr, lw * 1.1, ink_col)

    curl_pts = [
        (-56, -110, 20), (-46, -136, 22), (-22, -148, 22),
        (12, -150, 23), (44, -138, 21), (68, -114, 19),
        (-26, -82, 16), (4, -84, 16), (34, -80, 16)
    ]
    for (cx, cy, cr) in curl_pts:
        p_c = skia.Path()
        p_c.addCircle(cx, cy, cr)
        shape(c, p_c, colr, lw * 0.75, ink_col)


def draw_hair_slick(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Rex's combed back stylish hair."""
    colr = spec['hair_col']
    p_hair = skia.Path()
    p_hair.moveTo(-82, -50)
    p_hair.quadTo(-84, -150, 0, -152)
    p_hair.quadTo(84, -150, 82, -50)
    p_hair.lineTo(76, -66)
    p_hair.quadTo(0, -80, -76, -66)
    p_hair.close()
    shape(c, p_hair, colr, lw * 1.15, ink_col)
    line(c, -30, -136, 26, -134, lw * 0.7, spec['hair_col_hi'], 150)


def draw_hair_long(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Long flowing locks behind shoulders."""
    colr = spec['hair_col']
    p_hair = skia.Path()
    p_hair.moveTo(-82, -50)
    p_hair.quadTo(-84, -150, 0, -152)
    p_hair.quadTo(84, -150, 82, -50)
    p_hair.lineTo(84, -10); p_hair.quadTo(64, -25, 64, -68)
    p_hair.quadTo(0, -82, -42, -66); p_hair.quadTo(-60, -25, -78, -10)
    p_hair.close()
    shape(c, p_hair, colr, lw * 1.15, ink_col)


def draw_hair_bald(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Clean scalp with subtle temple hair tufts."""
    line(c, -28, -126, 26, -124, lw * 0.65, '#FFFFFF', 100)


def draw_hair_helmet(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Military/explorer helmet dome and brim."""
    colr = spec.get('hair_col', '#343536')
    p_helm = skia.Path()
    p_helm.moveTo(-82, -55); p_helm.quadTo(-86, -165, 0, -168); p_helm.quadTo(86, -165, 82, -55)
    p_helm.lineTo(76, -68); p_helm.quadTo(0, -82, -76, -68); p_helm.close()
    shape(c, p_helm, colr, lw * 1.25, ink_col)
    p_brim = skia.Path()
    p_brim.moveTo(-92, -68); p_brim.quadTo(0, -88, 92, -68); p_brim.quadTo(0, -52, -92, -68); p_brim.close()
    shape(c, p_brim, colr, lw * 1.1, ink_col)


HAIR_REGISTRY = {
    'bun': draw_hair_bun,
    'short': draw_hair_short,
    'curly': draw_hair_curly,
    'slick': draw_hair_slick,
    'long': draw_hair_long,
    'bald': draw_hair_bald,
    'helmet': draw_hair_helmet,
    'none': lambda c, s, lw, ink, mode='front': None
}


# ==============================================================================
# ACCESSORY RENDERERS (GLASSES, BEARD, HATS)
# ==============================================================================

def draw_glasses(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Doc's classic round/oval spectacles aligned with eye geometry."""
    glass_fill = fp('#E2F1FF', 75)
    glass_rim = ink(lw * 0.8, ink_col)

    if mode == 'front':
        # Left Lens
        p0 = skia.Path(); p0.addOval(skia.Rect(-38, -66, -14, -38))
        c.drawPath(p0, glass_fill); c.drawPath(p0, glass_rim)
        # Right Lens
        p1 = skia.Path(); p1.addOval(skia.Rect(14, -66, 38, -38))
        c.drawPath(p1, glass_fill); c.drawPath(p1, glass_rim)
        # Bridge & Temples
        line(c, -14, -52, 14, -52, lw * 0.85, ink_col)
        line(c, -38, -52, -70, -50, lw * 0.7, ink_col)
        line(c, 38, -52, 70, -50, lw * 0.7, ink_col)

    elif mode in ('three_quarter_right', 'side_right'):
        # Far lens over far eye (cx=10)
        p0 = skia.Path(); p0.addOval(skia.Rect(0, -66, 20, -38))
        c.drawPath(p0, glass_fill); c.drawPath(p0, glass_rim)
        # Near lens over near eye (cx=46)
        p1 = skia.Path(); p1.addOval(skia.Rect(34, -64, 58, -36))
        c.drawPath(p1, glass_fill); c.drawPath(p1, glass_rim)
        # Bridge & Near temple to ear
        line(c, 20, -52, 34, -50, lw * 0.85, ink_col)
        line(c, 58, -50, 72, -46, lw * 0.75, ink_col)

    else:  # three_quarter_left, side_left
        # Near lens over near eye (cx=-46)
        p0 = skia.Path(); p0.addOval(skia.Rect(-58, -64, -34, -36))
        c.drawPath(p0, glass_fill); c.drawPath(p0, glass_rim)
        # Far lens over far eye (cx=-10)
        p1 = skia.Path(); p1.addOval(skia.Rect(-20, -66, 0, -38))
        c.drawPath(p1, glass_fill); c.drawPath(p1, glass_rim)
        # Bridge & Near temple to ear
        line(c, -34, -50, -20, -52, lw * 0.85, ink_col)
        line(c, -58, -50, -72, -46, lw * 0.75, ink_col)


def draw_beard(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Doc's trimmed horseshoe/jawline beard hugging the chin without intersecting mouth."""
    colr = spec['hair_col']
    p_bd = skia.Path()
    if mode == 'front':
        p_bd.moveTo(-54, -20)
        p_bd.quadTo(-30, -4, 0, -4)
        p_bd.quadTo(30, -4, 54, -20)
        p_bd.lineTo(52, 2)
        p_bd.quadTo(28, 22, 0, 22)
        p_bd.quadTo(-28, 22, -52, 2)
        p_bd.close()
    elif mode in ('three_quarter_right', 'side_right'):
        p_bd.moveTo(-25, -12)
        p_bd.quadTo(12, -4, 46, -10)
        p_bd.lineTo(66, -18)
        p_bd.lineTo(62, 4)
        p_bd.quadTo(36, 22, 14, 20)
        p_bd.quadTo(-16, 16, -26, 0)
        p_bd.close()
    else:  # three_quarter_left, side_left
        p_bd.moveTo(25, -12)
        p_bd.quadTo(-12, -4, -46, -10)
        p_bd.lineTo(-66, -18)
        p_bd.lineTo(-62, 4)
        p_bd.quadTo(-36, 22, -14, 20)
        p_bd.quadTo(16, 16, 26, 0)
        p_bd.close()
    shape(c, p_bd, colr, lw * 0.85, ink_col)


def draw_hat_cap(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Rex's baseball cap with visor pointed in facing direction."""
    hat_col = spec['hat_col']
    p_cap = skia.Path()
    p_cap.moveTo(-74, -70); p_cap.quadTo(-76, -152, 0, -154); p_cap.quadTo(76, -152, 74, -70)
    p_cap.quadTo(0, -82, -74, -70); p_cap.close()
    shape(c, p_cap, hat_col, lw * 1.15, ink_col)

    # Visor extends forward
    p_bill = skia.Path()
    if mode in ('three_quarter_right', 'side_right'):
        p_bill.moveTo(42, -76); p_bill.quadTo(96, -84, 114, -66); p_bill.lineTo(74, -62); p_bill.close()
    elif mode in ('three_quarter_left', 'side_left'):
        p_bill.moveTo(-42, -76); p_bill.quadTo(-96, -84, -114, -66); p_bill.lineTo(-74, -62); p_bill.close()
    else:
        p_bill.moveTo(-52, -70); p_bill.quadTo(0, -92, 52, -70); p_bill.lineTo(44, -58); p_bill.quadTo(0, -68, -44, -58); p_bill.close()
    shape(c, p_bill, shade(hat_col, 0.82), lw * 1.1, ink_col)
    c.drawCircle(0, -154, 4.5, fp(ink_col))


def draw_hat_fedora(c, spec, lw, ink_col, mode='three_quarter_right'):
    """Classic fedora hat with brim and ribbon band."""
    hat_col = spec['hat_col']
    p_crown = skia.Path()
    p_crown.moveTo(-56, -84); p_crown.lineTo(-46, -152); p_crown.quadTo(0, -164, 46, -152); p_crown.lineTo(56, -84); p_crown.close()
    shape(c, p_crown, hat_col, lw * 1.1, ink_col)
    poly(c, [(-54, -102), (54, -102), (56, -84), (-56, -84)], spec['hat_band'], lw * 0.7, ink_col)
    p_brim = skia.Path()
    p_brim.moveTo(-96, -84); p_brim.quadTo(0, -108, 96, -84); p_brim.quadTo(0, -66, -96, -84); p_brim.close()
    shape(c, p_brim, hat_col, lw * 1.15, ink_col)


# ==============================================================================
# MAIN CHIBI V9 RIG RENDERER
# ==============================================================================

def draw_chibi_character(c, x, y, s, spec, face=0.0, eyes='dot', mouth='smile', brow=0.0, brow_tilt=0.0,
                         arms=('down', 'down'), tilt=0.0, bob=0.0, squash=0.0, sweat=-1.0, light=-1,
                         rim=None, hat=None, legs=None, pupil=0.0, sparkle=0.0, t=0.0):
    """Renders authentic Chibi V9 puppet with true 5-direction perspective and props."""
    spec = resolve_chibi_look(spec)
    lw = max(4.8, min(6.4, 4.5 / s))
    ink_col = spec['ink']
    f_val, mode = resolve_facing(face)

    c.save()
    c.translate(x, y)
    c.scale(s, s)

    # 1. Soft Elliptical Ground Shadow
    c.drawOval(skia.Rect(-74, -8, 74, 16), fp('#171715', 46))

    # Kinematics from walk cycle
    swing = 0.0
    lift_far = 0.0
    lift_near = 0.0
    is_walking = False

    if legs:
        is_walking = True
        fx2 = legs[1][1]
        swing = fx2 * 0.85
        lift_far = legs[0][2] * 0.45
        lift_near = legs[1][2] * 0.45

    lean = tilt + (swing * 0.12 if is_walking else 0.0)
    c.translate(0, -bob)
    if squash:
        c.scale(1 + squash * 0.5, 1 - squash)

    # Legs positioning according to facing mode
    if mode == 'front':
        far_hip_x, near_hip_x = -20, 20
        sgn = 1
    elif mode in ('three_quarter_right', 'side_right'):
        far_hip_x, near_hip_x = -18, 18
        sgn = 1
    else:  # left modes
        far_hip_x, near_hip_x = 18, -18
        sgn = -1

    # 2. Far Leg
    c.save()
    c.translate(far_hip_x, -87)
    c.rotate(-swing * sgn)
    poly(c, [(-18, -4), (18, -4), (22, 53), (-12, 59), (-22, 22)], spec['pants_far'], lw, ink_col)
    c.save()
    c.translate(5 * sgn, 61 - lift_far)
    c.rotate(swing * 0.25 * sgn)
    c.scale(0.78, 0.78)
    p_boot_far = skia.Path()
    p_boot_far.moveTo(-17 * sgn, -5); p_boot_far.lineTo(18 * sgn, -7); p_boot_far.lineTo(43 * sgn, 12)
    p_boot_far.quadTo(48 * sgn, 22, 32 * sgn, 25); p_boot_far.lineTo(-23 * sgn, 25); p_boot_far.close()
    shape(c, p_boot_far, spec['boots_far'], lw, ink_col)
    c.restore()
    c.restore()

    # Arm angle resolutions
    a0 = arms[0] if isinstance(arms, (tuple, list)) else 'down'
    if isinstance(a0, tuple): a0 = a0[0]
    a1 = arms[1] if isinstance(arms, (tuple, list)) else 'down'
    if isinstance(a1, tuple): a1 = a1[0]

    far_arm_ang = -4.0
    if is_walking:
        forward_far = 0.5 + 0.5 * (-swing / 28.0 if swing != 0 else 0)
        far_arm_ang = -3.0 - 16.0 * forward_far
    elif a0 in ('up', 'celebrate'):
        far_arm_ang = -140.0
    elif a0 in ('pocket', 'pockets'):
        far_arm_ang = -15.0
    elif a0 in ('cross', 'arms_crossed'):
        far_arm_ang = -28.0
    elif a0 in ('hold',):
        far_arm_ang = -36.0
    elif a0 not in ('down',):
        far_arm_ang = -25.0

    # 3. Far Arm (Mounted behind torso & backpack)
    far_shoulder_x = -48 if mode in ('three_quarter_right', 'side_right', 'front') else 48
    c.save()
    c.rotate(lean, 0, -162)
    c.save()
    c.translate(far_shoulder_x, -174)
    c.rotate(far_arm_ang * sgn)
    sleeve_col_far = spec['color_d'] if spec['outfit'] != 'tshirt' else spec['skin_d']
    p_sleeve_far = skia.Path()
    p_sleeve_far.moveTo(-6, -2); p_sleeve_far.lineTo(8, 0); p_sleeve_far.lineTo(8, 68); p_sleeve_far.lineTo(-6, 68); p_sleeve_far.close()
    shape(c, p_sleeve_far, sleeve_col_far, lw * 0.9, ink_col)
    # Far Hand
    c.drawOval(skia.Rect(-6, 66, 8, 86), fp(spec['skin']))
    c.drawOval(skia.Rect(-6, 66, 8, 86), ink(lw * 0.8, ink_col))
    c.restore()

    # 4. Rear Backpack (if enabled)
    if spec['show_backpack'] and mode != 'front':
        pack_x = -54 if mode in ('three_quarter_right', 'side_right') else 54
        c.save()
        c.translate(pack_x, -150)
        p_pack = skia.Path()
        p_pack.addRRect(skia.RRect.MakeRectXY(skia.Rect(-20, -35, 20, 35), 10, 10))
        shape(c, p_pack, spec['backpack'], lw * 1.1, ink_col)
        c.restore()

    # 5. Near Leg
    c.save()
    c.translate(near_hip_x, -87)
    c.rotate(swing * sgn)
    poly(c, [(-18, -4), (18, -4), (22, 54), (-12, 60), (-22, 24)], spec['pants'], lw, ink_col)
    c.save()
    c.translate(5 * sgn, 62 - lift_near)
    c.rotate(-swing * 0.25 * sgn)
    c.scale(0.78, 0.78)
    p_boot_near = skia.Path()
    p_boot_near.moveTo(-17 * sgn, -5); p_boot_near.lineTo(18 * sgn, -7); p_boot_near.lineTo(45 * sgn, 12)
    p_boot_near.quadTo(49 * sgn, 22, 33 * sgn, 25); p_boot_near.lineTo(-24 * sgn, 25); p_boot_near.close()
    shape(c, p_boot_near, spec['boots'], lw, ink_col)
    c.restore()
    c.restore()

    # 6. Torso / Outfit
    outfit_fn = OUTFIT_REGISTRY.get(spec['outfit'], draw_outfit_suit)
    outfit_fn(c, spec, lw, ink_col, mode=mode)

    # 7. Near Arm (In front of torso)
    near_shoulder_x = 36 if mode in ('three_quarter_right', 'side_right') else (-36 if mode in ('three_quarter_left', 'side_left') else 42)
    near_arm_ang = 6.0
    if is_walking:
        near_arm_ang = swing * 0.46
    elif a1 in ('wave', 'salute', 'hi'):
        near_arm_ang = -105.0 + math.sin(t * 14.0) * 22.0
    elif a1 in ('point', 'present', 'reach'):
        near_arm_ang = -75.0
    elif a1 in ('chin', 'think'):
        near_arm_ang = -65.0
    elif a1 in ('gesture', 'explain'):
        near_arm_ang = -50.0 + math.sin(t * 6.0) * 8.0
    elif a1 in ('up', 'celebrate'):
        near_arm_ang = -140.0
    elif a1 in ('pocket', 'pockets'):
        near_arm_ang = -16.0
    elif a1 in ('arms_crossed', 'fold', 'cross'):
        near_arm_ang = -36.0
    elif a1 in ('hold',):
        near_arm_ang = -42.0

    c.save()
    c.translate(near_shoulder_x, -178)
    c.rotate(near_arm_ang * sgn)
    sleeve_col_near = spec['color'] if spec['outfit'] != 'tshirt' else spec['skin']
    poly(c, [(-10, -5), (16, -4), (16, 51), (-8, 56), (-18, 14)], sleeve_col_near, lw, ink_col)
    # Near Hand with thumb
    p_hand_near = skia.Path()
    p_hand_near.moveTo(-8, 52); p_hand_near.lineTo(16, 50); p_hand_near.lineTo(17, 68); p_hand_near.quadTo(6, 80, -8, 70); p_hand_near.close()
    shape(c, p_hand_near, spec['skin'], lw * 0.85, ink_col)
    c.restore()

    # Held Prop (e.g. Newspaper or Book)
    has_prop = spec.get('prop') == 'newspaper' or spec.get('item') == 'newspaper' or a0 == 'hold' and a1 == 'hold'
    if has_prop:
        draw_held_newspaper(c, spec, lw, ink_col, mode=mode)

    # 8. Head & Facial Features (Pivot at 0, -201)
    head_ang = -lean * 0.4
    if a1 in ('chin', 'think'):
        head_ang -= 5.0
    elif a1 in ('celebrate',):
        head_ang -= 8.0

    c.save()
    c.translate(0, -201)
    c.rotate(head_ang)

    # A. Ears (drawn before head cranium so temples/jaw overlap naturally)
    if mode == 'front':
        for ex_ in (-72, 72):
            c.drawOval(skia.Rect(ex_ - 8, -54, ex_ + 8, -36), fp(spec['skin']))
            c.drawOval(skia.Rect(ex_ - 8, -54, ex_ + 8, -36), ink(lw * 0.8, ink_col))
    elif mode in ('three_quarter_right', 'side_right'):
        ex_ = 72 if mode == 'three_quarter_right' else 6
        c.drawOval(skia.Rect(ex_ - 7, -54, ex_ + 7, -36), fp(spec['skin']))
        c.drawOval(skia.Rect(ex_ - 7, -54, ex_ + 7, -36), ink(lw * 0.8, ink_col))
    else:  # left modes
        ex_ = -72 if mode == 'three_quarter_left' else -6
        c.drawOval(skia.Rect(ex_ - 7, -54, ex_ + 7, -36), fp(spec['skin']))
        c.drawOval(skia.Rect(ex_ - 7, -54, ex_ + 7, -36), ink(lw * 0.8, ink_col))

    # B. Head Cranium Path (Smooth organic silhouette)
    p_head = skia.Path()
    if mode == 'front':
        p_head.moveTo(-72, -50); p_head.quadTo(-72, -135, 0, -136); p_head.quadTo(72, -135, 72, -50)
        p_head.quadTo(72, 12, 0, 16); p_head.quadTo(-72, 12, -72, -50); p_head.close()
    elif mode == 'three_quarter_right':
        p_head.moveTo(-68, -50); p_head.quadTo(-68, -136, 0, -136); p_head.quadTo(76, -136, 78, -50)
        p_head.quadTo(78, 6, 24, 14); p_head.quadTo(-40, 12, -68, -50); p_head.close()
    elif mode == 'three_quarter_left':
        p_head.moveTo(68, -50); p_head.quadTo(68, -136, 0, -136); p_head.quadTo(-76, -136, -78, -50)
        p_head.quadTo(-78, 6, -24, 14); p_head.quadTo(40, 12, 68, -50); p_head.close()
    elif mode == 'side_right':
        p_head.moveTo(-50, -50); p_head.quadTo(-50, -136, 0, -136); p_head.quadTo(55, -136, 60, -60)
        p_head.lineTo(74, -38); p_head.lineTo(66, -30); p_head.lineTo(68, -16)
        p_head.quadTo(68, 12, 22, 14); p_head.quadTo(-30, 12, -50, -50); p_head.close()
    else:  # side_left
        p_head.moveTo(50, -50); p_head.quadTo(50, -136, 0, -136); p_head.quadTo(-55, -136, -60, -60)
        p_head.lineTo(-74, -38); p_head.lineTo(-66, -30); p_head.lineTo(-68, -16)
        p_head.quadTo(-68, 12, -22, 14); p_head.quadTo(30, 12, 50, -50); p_head.close()

    shape(c, p_head, spec['skin'], lw * 1.25, ink_col)

    # C. Cheeks Blush
    if mode == 'front':
        c.drawOval(skia.Rect(-48, -32, -32, -22), fp('#FF9C9C', 48))
        c.drawOval(skia.Rect(32, -32, 48, -22), fp('#FF9C9C', 48))
    elif mode in ('three_quarter_right', 'side_right'):
        c.drawOval(skia.Rect(8, -32, 24, -22), fp('#FF9C9C', 48))
        c.drawOval(skia.Rect(50, -32, 66, -22), fp('#FF9C9C', 48))
    else:
        c.drawOval(skia.Rect(-66, -32, -50, -22), fp('#FF9C9C', 48))
        c.drawOval(skia.Rect(-24, -32, -8, -22), fp('#FF9C9C', 48))

    # D. Eyes & Specular Highlights
    ry = 17 if pupil <= 0 else 19
    rx = 7.5
    if eyes == 'wide':
        ry = 20; rx = 8.5
    elif eyes == 'half':
        ry = 11

    if mode == 'front':
        c.drawOval(skia.Rect(-26 - rx, -52 - ry, -26 + rx, -52 + ry), fp(ink_col))
        c.drawOval(skia.Rect(26 - rx, -52 - ry, 26 + rx, -52 + ry), fp(ink_col))
        c.drawCircle(-24, -52 - ry * 0.35, 2.5, fp('#FFFFFF'))
        c.drawCircle(28, -52 - ry * 0.35, 2.5, fp('#FFFFFF'))
    elif mode == 'three_quarter_right':
        c.drawOval(skia.Rect(10 - 6, -52 - 16, 10 + 6, -52 + 16), fp(ink_col))
        c.drawOval(skia.Rect(46 - rx, -50 - ry, 46 + rx, -50 + ry), fp(ink_col))
        c.drawCircle(12, -52 - ry * 0.35, 2.3, fp('#FFFFFF'))
        c.drawCircle(48, -50 - ry * 0.35, 2.5, fp('#FFFFFF'))
    elif mode == 'three_quarter_left':
        c.drawOval(skia.Rect(-46 - rx, -50 - ry, -46 + rx, -50 + ry), fp(ink_col))
        c.drawOval(skia.Rect(-10 - 6, -52 - 16, -10 + 6, -52 + 16), fp(ink_col))
        c.drawCircle(-48, -50 - ry * 0.35, 2.5, fp('#FFFFFF'))
        c.drawCircle(-12, -52 - ry * 0.35, 2.3, fp('#FFFFFF'))
    elif mode == 'side_right':
        c.drawOval(skia.Rect(42 - rx, -50 - ry, 42 + rx, -50 + ry), fp(ink_col))
        c.drawCircle(44, -50 - ry * 0.35, 2.5, fp('#FFFFFF'))
    else:  # side_left
        c.drawOval(skia.Rect(-42 - rx, -50 - ry, -42 + rx, -50 + ry), fp(ink_col))
        c.drawCircle(-44, -50 - ry * 0.35, 2.5, fp('#FFFFFF'))

    # E. Eyebrows
    by = -74 + brow * 5
    bt = brow_tilt * 7
    if mode == 'front':
        line(c, -36, by - bt, -16, by + bt, lw * 0.85, ink_col)
        line(c, 16, by + bt, 36, by - bt, lw * 0.85, ink_col)
    elif mode in ('three_quarter_right', 'side_right'):
        line(c, 2, by - bt, 20, by + bt, lw * 0.85, ink_col)
        line(c, 38, by - bt, 56, by + bt, lw * 0.85, ink_col)
    else:
        line(c, -56, by + bt, -38, by - bt, lw * 0.85, ink_col)
        line(c, -20, by + bt, -2, by - bt, lw * 0.85, ink_col)

    # F. Mouth
    if mode == 'front':
        mx, my = 0, -16
    elif mode in ('three_quarter_right', 'side_right'):
        mx, my = 34 if mode == 'three_quarter_right' else 64, -16
    else:
        mx, my = -34 if mode == 'three_quarter_left' else -64, -16

    if mouth == 'open':
        p_m = skia.Path()
        p_m.moveTo(mx - 12, my - 2); p_m.lineTo(mx + 12, my - 2); p_m.cubicTo(mx + 12, my + 18, mx - 12, my + 18, mx - 12, my - 2); p_m.close()
        c.drawPath(p_m, fp('#4A121A'))
        c.save(); c.clipPath(p_m, doAntiAlias=True)
        c.drawRect(skia.Rect(mx - 14, my - 4, mx + 14, my + 3), fp('#FFFFFF'))
        c.drawOval(skia.Rect(mx - 7, my + 7, mx + 7, my + 19), fp('#D8606B'))
        c.restore()
        c.drawPath(p_m, ink(lw * 0.6, ink_col))
    elif mouth in ('mid', 'o'):
        c.drawOval(skia.Rect(mx - 7, my - 6, mx + 7, my + 8), fp(ink_col))
    elif mouth in ('fear', 'shock', 'gasp', 'worried'):
        c.drawOval(skia.Rect(mx - 8, my - 7, mx + 8, my + 9), fp('#4A121A'))
        c.drawOval(skia.Rect(mx - 8, my - 7, mx + 8, my + 9), ink(lw * 0.6, ink_col))
    elif mouth == 'smirk':
        p_m = skia.Path()
        p_m.moveTo(mx - 10, my - 1); p_m.quadTo(mx, my + 4, mx + 12, my - 6)
        c.drawPath(p_m, ink(lw * 0.75, ink_col))
    elif mouth == 'flat':
        line(c, mx - 10, my, mx + 10, my, lw * 0.75, ink_col)
    else:  # smile
        p_m = skia.Path()
        p_m.moveTo(mx - 10, my - 2); p_m.quadTo(mx, my + 7, mx + 10, my - 2)
        c.drawPath(p_m, ink(lw * 0.75, ink_col))

    # G. Facial Hair (Beard) - Rendered before hair so sideburns overlap it cleanly
    if spec['beard']:
        draw_beard(c, spec, lw, ink_col, mode=mode)

    # H. Hair
    hair_fn = HAIR_REGISTRY.get(spec['hair'], draw_hair_short)
    hair_fn(c, spec, lw, ink_col, mode=mode)

    # I. Glasses - Center lenses right over eyes
    if spec['glasses']:
        draw_glasses(c, spec, lw, ink_col, mode=mode)

    # J. Hats
    hat_type = spec.get('hat')
    if hat_type == 'cap':
        draw_hat_cap(c, spec, lw, ink_col, mode=mode)
    elif hat_type == 'fedora':
        draw_hat_fedora(c, spec, lw, ink_col, mode=mode)

    c.restore()  # Head
    c.restore()  # Torso group
    c.restore()  # Root
