"""2D Long Form kit: helpers, lighting, grade, puppet characters.
Flat cel-shaded round-head puppets with one uniform ink line, navy night lighting,
bloom, vignette. Everything is drawn with skia-python."""
import math, os, random, unicodedata
import numpy as np, skia

try:
    from .chibi_rig import draw_chibi_character, resolve_chibi_look, HEAD_CY as CHIBI_HEAD_CY
except ImportError:
    from engine.chibi_rig import draw_chibi_character, resolve_chibi_look, HEAD_CY as CHIBI_HEAD_CY

W, H, FPS = 1920, 1080, 30  # design space: everything is drawn in 1920x1080 coordinates
RES = int(os.environ.get("RM_RES", "1080"))  # output height: 1080 (final) or 720 (2.25x faster)
OW, OH = (1280, 720) if RES == 720 else (1920, 1080)
OS = OW / W  # design -> output scale
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FD = os.environ.get("RM_FONTS", os.path.join(ROOT, "fonts")) + os.sep


def _font(name):
    tf = skia.Typeface.MakeFromFile(FD + name)
    if tf is None: raise SystemExit(f"font missing: {FD + name}")
    return tf


LANG = os.environ.get("RM_LANG", "en").lower()  # market language: en, vi, fr, de
if LANG == "vi":  # the original hand fonts have no Vietnamese glyphs; these OFL fonts do (same roles)
    FONT_HAND = _font("PatrickHand-Regular.ttf")
    KALAM = _font("Mali-Bold.ttf")
    MARKER = _font("SedgwickAveDisplay-Regular.ttf")
else:  # en, fr, de: the original fonts cover their accents
    FONT_HAND = _font("CaveatBrush-Regular.ttf")
    KALAM = _font("Kalam-Bold.ttf")
    MARKER = _font("PermanentMarker-Regular.ttf")
INK = (24, 22, 27); LW = 6.0
GOLD = '#F2C14E'; RED = '#C8242C'; LIME = '#B8F04A'; CREAM = '#FFF6DC'; SKY = '#7FC8F8'; PINK = '#FF6FA0'
NAMED = dict(lime=LIME, cream=CREAM, red=RED, gold=GOLD, sky=SKY, pink=PINK, white='#FFFFFF', green='#5FCB72', orange='#FF9A3C')


# ---------------------------------------------------------------- colour + easing
def C(rgb, a=255): return skia.Color(int(rgb[0]), int(rgb[1]), int(rgb[2]), int(max(0, min(255, a))))
def hx(h, a=255):
    h = NAMED.get(h, h).lstrip('#'); return C((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)), a)
def col(v, a=255): return hx(v, a) if isinstance(v, str) else C(v, a)
def rgb(h):
    h = NAMED.get(h, h).lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
def shade(h, k):  # k<1 darker, k>1 lighter
    r, g, b = rgb(h)
    if k <= 1: r, g, b = r * k, g * k, b * k
    else: r, g, b = r + (255 - r) * (k - 1), g + (255 - g) * (k - 1), b + (255 - b) * (k - 1)
    return '#%02X%02X%02X' % (int(min(255, r)), int(min(255, g)), int(min(255, b)))
def radial(cx, cy, r, colors, pos=None): return skia.GradientShader.MakeRadial(center=(cx, cy), radius=r, colors=colors, positions=pos)
def linear(x0, y0, x1, y1, colors, pos=None): return skia.GradientShader.MakeLinear(points=[(x0, y0), (x1, y1)], colors=colors, positions=pos)
def ease(u): u = min(max(u, 0), 1); return 0.5 - 0.5 * math.cos(math.pi * u)
def ease_out(u): u = min(max(u, 0), 1); return 1 - (1 - u) ** 3
def pop(u):  # 0 -> 1.15 -> 1
    if u <= 0: return 0.0
    if u >= 1: return 1.0
    return 1.15 * ease_out(u / 0.6) if u < 0.6 else 1.15 - 0.15 * ease((u - 0.6) / 0.4)
def back(u, k=1.9):  # snappy overshoot for pose changes
    u = min(max(u, 0.0), 1.0) - 1; return 1 + (k + 1) * u ** 3 + k * u ** 2
def lerp(a, b, k): return a + (b - a) * k
def K(t, t0, d): return min(max((t - t0) / d, 0.0), 1.0)
def blink(t, period=2.7, phase=0.0): return ((t + phase) % period) < 0.1


# ---------------------------------------------------------------- paints + shapes
def fp(v, a=255, blur=0, blend=None):
    p = skia.Paint(AntiAlias=True, Color=col(v, a))
    if blur: p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    if blend: p.setBlendMode(blend)
    return p
def sp(shader, blend=None, blur=0):
    p = skia.Paint(AntiAlias=True); p.setShader(shader)
    if blend: p.setBlendMode(blend)
    if blur: p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    return p
def ink(w=LW, v=INK, a=255):
    p = skia.Paint(AntiAlias=True, Color=col(v, a)); p.setStyle(skia.Paint.kStroke_Style); p.setStrokeWidth(w)
    p.setStrokeCap(skia.Paint.kRound_Cap); p.setStrokeJoin(skia.Paint.kRound_Join); return p
def shape(c, path, fill, w=LW, v=INK):
    c.drawPath(path, fill if isinstance(fill, skia.Paint) else fp(fill))
    if w: c.drawPath(path, ink(w, v))
def rect(c, x0, y0, x1, y1, fill, w=LW, r=0, v=INK):
    p = skia.Path()
    if r: p.addRRect(skia.RRect.MakeRectXY(skia.Rect(x0, y0, x1, y1), r, r))
    else: p.addRect(skia.Rect(x0, y0, x1, y1))
    shape(c, p, fill, w, v); return p
def circ(c, x, y, r, fill, w=LW, v=INK): p = skia.Path(); p.addCircle(x, y, r); shape(c, p, fill, w, v); return p
def oval(c, x0, y0, x1, y1, fill, w=LW, v=INK): p = skia.Path(); p.addOval(skia.Rect(x0, y0, x1, y1)); shape(c, p, fill, w, v); return p
def line(c, x0, y0, x1, y1, w=LW, v=INK, a=255): c.drawLine(x0, y0, x1, y1, ink(w, v, a))
def poly(c, pts, fill, w=LW, v=INK):
    p = skia.Path(); p.moveTo(*pts[0])
    for q in pts[1:]: p.lineTo(*q)
    p.close(); shape(c, p, fill, w, v); return p
def text_w(s, size, font=None): return skia.Font(font or KALAM, size).measureText(unicodedata.normalize("NFC", s))
def label(c, s, x, y, size, color, font=None, align='left', stroke=0, stroke_col=INK, skew=-0.16, alpha=1.0, rot=0.0):
    s = unicodedata.normalize("NFC", s)  # precomposed accents (Vietnamese, French, German)
    f = skia.Font(font or KALAM, size); w = f.measureText(s)
    ox = -w / 2 if align == 'center' else -w if align == 'right' else 0
    c.save(); c.translate(x, y); c.rotate(rot); c.skew(skew, 0)
    if stroke: c.drawString(s, ox, 0, f, ink(stroke, stroke_col, 255 * alpha))
    c.drawString(s, ox, 0, f, fp(color, 255 * alpha)); c.restore(); return w
def fit_size(s, size, max_w, font=None):
    w = text_w(s, size, font); return size if w <= max_w else size * max_w / w
def wrap(s, size, max_w, font=None):
    words, lines, cur = s.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if cur and text_w(t, size, font) > max_w: lines.append(cur); cur = w_
        else: cur = t
    if cur: lines.append(cur)
    return lines


# ---------------------------------------------------------------- lighting + grade
def night(c, lights, ambient='#4C5CA0'):
    """Multiply darkness over everything drawn so far, with soft holes for lights.
    lights: ('pool',x,y,r,a) | ('oval',x,y,rx,ry,a) | ('path',skia.Path,a,blur)"""
    p = skia.Paint(); p.setBlendMode(skia.BlendMode.kMultiply); c.saveLayer(None, p); c.drawPaint(fp(ambient))
    for L in lights:
        if L[0] == 'pool':
            _, x, y, r, a = L
            c.drawCircle(x, y, r, sp(radial(x, y, r, [C((0, 0, 0), 255 * a), C((0, 0, 0), 255 * a * .75), C((0, 0, 0), 0)], [0, .5, 1]), blend=skia.BlendMode.kDstOut))
        elif L[0] == 'oval':
            _, x, y, rx, ry, a = L; c.save(); c.translate(x, y); c.scale(1, ry / rx)
            c.drawCircle(0, 0, rx, sp(radial(0, 0, rx, [C((0, 0, 0), 255 * a), C((0, 0, 0), 255 * a * .7), C((0, 0, 0), 0)], [0, .55, 1]), blend=skia.BlendMode.kDstOut)); c.restore()
        else:
            _, path, a, blur = L; c.drawPath(path, fp((0, 0, 0), 255 * a, blur=blur, blend=skia.BlendMode.kDstOut))
    c.restore()
def add_light(c, x, y, r, v, a):
    c.drawCircle(x, y, r, sp(radial(x, y, r, [col(v, a), col(v, a * .4), col(v, 0)], [0, .5, 1]), blend=skia.BlendMode.kPlus))
def cone_path(x, y, top_w, bot_w, length, lean=0):
    p = skia.Path(); p.moveTo(x - top_w / 2, y); p.lineTo(x + top_w / 2, y); p.lineTo(x + lean + bot_w / 2, y + length); p.lineTo(x + lean - bot_w / 2, y + length); p.close(); return p
def blur_begin(c, sigma):  # depth blur for everything until c.restore()
    p = skia.Paint(); p.setImageFilter(skia.ImageFilters.Blur(sigma, sigma)); c.saveLayer(None, p)
def vignette(c, strength=0.64, inner=.42):
    if strength <= 0: return
    c.drawRect(skia.Rect(0, 0, W, H), sp(radial(W / 2, H / 2, W * .74, [C((0, 0, 0), 0), C((0, 0, 0), 0), C((2, 3, 12), 255 * strength)], [0, inner, 1])))
def _sat(s, contrast, lift):
    lr, lg, lb = 0.2126, 0.7152, 0.0722
    m = [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s), lr * (1 - s), lg * (1 - s) + s, lb * (1 - s), lr * (1 - s), lg * (1 - s), lb * (1 - s) + s]
    out = []
    for r in range(3): out += [m[r * 3 + i] * contrast for i in range(3)] + [0, lift]
    return out + [0, 0, 0, 1, 0]
# ---------------------------------------------------------------- frame buffers + numpy post (fast on every platform)
# Full-screen gradients, blend modes and colour filters are very slow in CPU skia on some builds, so every
# full-frame pass (lighting multiply, glow add, grade, bloom, vignette, whip blur) runs in numpy instead.
# Surfaces are premultiplied native-format (N32) numpy buffers: drawing is zero-copy and image blits stay fast.
N32 = skia.kN32_ColorType
BGR = N32 == skia.kBGRA_8888_ColorType
PIX_FMT = 'bgra' if BGR else 'rgba'
LUM = np.array([0.0722, 0.7152, 0.2126] if BGR else [0.2126, 0.7152, 0.0722], np.float32)
LINEAR = skia.SamplingOptions(skia.FilterMode.kLinear)


def np_surface(w=None, h=None):
    w = OW if w is None else w; h = OH if h is None else h
    a = np.zeros((h, w, 4), np.uint8); return a, skia.Surface(a, colorType=N32, alphaType=skia.kPremul_AlphaType)


def np_image(a): return skia.Image.fromarray(np.ascontiguousarray(a), colorType=N32, alphaType=skia.kPremul_AlphaType)


def multiply_into(buf, m):
    x = buf[..., :3].astype(np.uint16); x *= m[..., :3]; x += 127; x //= 255; buf[..., :3] = x


def add_into(buf, g):
    x = buf[..., :3].astype(np.uint16); x += g[..., :3]; np.minimum(x, 255, out=x); buf[..., :3] = x


_VIG = {}


def _vig_map(strength, inner=.42):
    k = (round(strength, 3), inner)
    if k not in _VIG:
        yy, xx = np.mgrid[0:OH, 0:OW].astype(np.float32); r = np.hypot(xx - OW / 2, yy - OH / 2) / (OW * .74)
        _VIG[k] = (strength * np.clip((r - inner) / (1 - inner), 0, 1))[..., None].astype(np.float32)
    return _VIG[k]


VCOL = (np.array([12, 3, 2] if BGR else [2, 3, 12], np.float32) / 255)
_POST = {}


_LUT = {}


def _lut(contrast, lift):
    k = (contrast, lift)
    if k not in _LUT: _LUT[k] = np.clip((np.arange(256) / 255 * contrast + lift) * 255 + .5, 0, 255).astype(np.uint8)
    return _LUT[k]


def _vig16(strength):
    k = ('v16', round(strength, 3))
    if k not in _VIG: _VIG[k] = np.round((1 - _vig_map(strength)) * 256).astype(np.uint16)
    return _VIG[k]


def finish(buf, bloom=0.40, vig=0.64, contrast=0.97, lift=0.012):
    """Grade (contrast/lift LUT) + quarter-res bloom (screen blend) + vignette, in place, integer math (~90 ms at 1080p)."""
    from scipy.ndimage import gaussian_filter
    if 'small' not in _POST: _POST['small'] = np_surface(OW // 4, OH // 4); _POST['up'] = np_surface(OW, OH)
    if bloom > 0:
        sa, ss = _POST['small']; sc_ = ss.getCanvas(); sc_.save(); sc_.scale(.25, .25); sc_.drawImage(np_image(buf), 0, 0, LINEAR); sc_.restore()
        s = sa[..., :3].astype(np.float32) * (1.7 / 255) - .78; np.clip(s, 0, 1, out=s); s = gaussian_filter(s, (5 * OS, 5 * OS, 0))
        sa[..., :3] = (s * (255 * bloom)).astype(np.uint8); sa[..., 3] = 255
        ua, us = _POST['up']; uc = us.getCanvas(); uc.save(); uc.scale(4, 4); uc.drawImage(np_image(sa), 0, 0, LINEAR); uc.restore()
    x = _lut(contrast, lift)[buf[..., :3]].astype(np.uint16)
    if bloom > 0:
        b = ua[..., :3].astype(np.uint16); xb = x * b; xb += 255; xb >>= 8; x += b; x -= xb  # screen: x + b - x*b/255
    if vig > 0: x *= _vig16(vig); x >>= 8
    np.minimum(x, 255, out=x); buf[..., :3] = x


def hblur(buf, sig):
    """Fast horizontal motion blur for whip pans (box blur ~ gaussian sigma)."""
    k = max(1, int(sig * 1.2 * OS)); x = buf[..., :3].astype(np.float32); w = buf.shape[1]
    pad = np.concatenate([np.repeat(x[:, :1], k + 1, 1), x, np.repeat(x[:, -1:], k, 1)], 1)
    cs = np.cumsum(pad, axis=1); out = (cs[:, 2 * k + 1:] - cs[:, :-2 * k - 1]) / (2 * k + 1)
    buf[..., :3] = np.clip(out[:, :w], 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- puppet character
BODY_TOP, BODY_BOT, HEAD_R = -345, -128, 100
HEAD_CY = BODY_TOP - 74
SHOULDER = (-56, BODY_TOP + 54)
ARM = {  # left arm: (elbow, hand, show_hand); the right arm is mirrored
    'down': ((-90, -235), (-96, -168), True), 'pocket': ((-96, -232), (-70, -176), False),
    'hip': ((-128, -238), (-84, -190), True), 'present': ((-128, -306), (-208, -338), True),
    'gesture': ((-136, -262), (-152, -352), True), 'chin': ((-128, -262), (-62, -322), True),
    'hat': ((-140, -400), (-104, -482), True), 'hold': ((-96, -236), (-44, -214), True),
    'push': ((-120, -270), (-190, -262), True), 'up': ((-138, -392), (-150, -500), True),
    'shrug': ((-132, -246), (-184, -312), True), 'cross': ((-70, -236), (40, -262), True),
    'wave': ((-150, -330), (-176, -446), True), 'head': ((-150, -380), (-86, -470), True),
    'point': ((-150, -300), (-236, -306), True)}
POSES = dict(idle=('down', 'down'), present=('down', 'present'), explain=('gesture', 'down'), think=('down', 'chin'),
             pockets=('pocket', 'pocket'), celebrate=('up', 'up'), shrug=('shrug', 'shrug'), point=('down', 'point'),
             hips=('hip', 'hip'), hold=('hold', 'hold'), tiphat=('down', 'hat'), wave=('down', 'wave'), arms_crossed=('cross', 'cross'),
             facepalm=('down', 'head'), stressed=('head', 'head'), push=('down', 'push'), present_left=('present', 'down'))
EMOTIONS = {  # eyes, mouth, brow, brow_tilt, extras
    'neutral': ('dot', 'smile', 0.0, 0.0, {}), 'calm': ('dot', 'flat', 0.0, 0.0, {}),
    'happy': ('closed', 'open', 0.3, 0.0, {}), 'smile': ('dot', 'smile', 0.2, 0.0, {}),
    'smug': ('half', 'smirk', 0.9, 0.0, {}), 'shocked': ('wide', 'o', 1.0, 0.0, {}),
    'nervous': ('wide', 'flat', 1.0, -0.8, {'sweat': True}), 'sad': ('half', 'flat', 0.0, -0.9, {}),
    'angry': ('dot', 'flat', 0.2, 0.9, {}), 'thinking': ('dot', 'flat', 0.5, -0.3, {'pupil': -1}),
    'excited': ('wide', 'open', 1.0, 0.0, {'sparkle': True}), 'tired': ('half', 'flat', -0.2, -0.5, {}),
    'confident': ('half', 'smile', 0.5, 0.0, {}), 'worried': ('dot', 'o', 0.8, -0.8, {}),
    'embarrassed': ('half', 'flat', 0.0, -0.9, {'sweat': True}), 'greedy': ('half', 'smirk', 0.9, 0.3, {'sparkle': True})}
SKINS = dict(light=('#F1CFA8', '#D6AE84'), fair=('#EBC79C', '#CFA677'), tan=('#E6BE8E', '#C99F70'),
             olive=('#C99C6E', '#A97E52'), brown=('#A8754D', '#8A5C38'), dark=('#7A4E32', '#603B24'))


DEBUG_MARKER = False  # Temporary debug verification marker; set to False after verification


def make_look(d):
    """Fill a cast look with defaults. Keys: skin (preset or hex), outfit suit|hoodie|tshirt|dress|sweater|explorer|soldier,
    color, shirt, tie, bowtie, hair slick|short|bun|long|curly|bald|none, hair_col, glasses, moustache,
    beard, hat fedora|cap|none, hat_col, build slim|medium|athletic."""
    if isinstance(d, str):
        d = {'character': d, 'color': '#2563EB'}
    d = dict(d or {})

    # Unless explicitly requested to use legacy/tall puppet, default to Chibi V9 Character Rig
    if d.get('style') not in ('classic', 'tall', 'legacy'):
        d = resolve_chibi_look(d)
        d['suit'] = d['color']
        d['suit_d'] = shade(d['color'], 0.74)
        return d
    sk = d.get('skin', 'tan')
    if sk in SKINS:
        d.setdefault('skin_d', SKINS[sk][1])
        d['skin'] = SKINS[sk][0]
    else:
        d['skin'] = sk
        d.setdefault('skin_d', shade(sk, .84))

    outfit = d.setdefault('outfit', 'suit')
    is_dress = (outfit == 'dress')

    d.setdefault('color', d.get('suit', '#3B4660'))
    d['suit'] = d['color']
    d.setdefault('suit_d', shade(d['color'], .74))
    d.setdefault('shirt', '#F4EFE2')
    d.setdefault('tie', '#A8232B')
    d.setdefault('hair', 'short')
    d.setdefault('hair_col', '#1C1B22')
    d.setdefault('hat_col', '#2E2E38')
    d.setdefault('hat_band', '#7E1C24')
    if d.get('hat') is True:
        d['hat'] = 'fedora'

    build = d.get('build', 'slim' if is_dress else 'medium')
    d['build'] = build

    # Proportions tailored for balanced 2D cartoon anatomy (eliminates egg belly)
    if is_dress:
        d.setdefault('shoulder_w', 48)
        d.setdefault('chest_w', 47)
        d.setdefault('waist_w', 38)      # graceful feminine taper
        d.setdefault('hip_w', 46)
        d.setdefault('skirt_flare', 30)  # natural A-line flare
        d.setdefault('belly_curve', 0.05)
        d.setdefault('arm_thick', 15.5)
    elif build == 'athletic':
        d.setdefault('shoulder_w', 58)
        d.setdefault('chest_w', 56)
        d.setdefault('waist_w', 44)      # athletic V-taper
        d.setdefault('hip_w', 49)
        d.setdefault('skirt_flare', 0)
        d.setdefault('belly_curve', 0.06)
        d.setdefault('arm_thick', 18.5)
    elif build == 'slim':
        d.setdefault('shoulder_w', 50)
        d.setdefault('chest_w', 48)
        d.setdefault('waist_w', 40)
        d.setdefault('hip_w', 46)
        d.setdefault('skirt_flare', 0)
        d.setdefault('belly_curve', 0.05)
        d.setdefault('arm_thick', 16.0)
    else:  # standard / medium
        d.setdefault('shoulder_w', 54)
        d.setdefault('chest_w', 52)
        d.setdefault('waist_w', 44)      # neat, balanced taper
        d.setdefault('hip_w', 48)
        d.setdefault('skirt_flare', 0)
        d.setdefault('belly_curve', 0.06)
        d.setdefault('arm_thick', 17.5)

    return d


def _arm(spec):  # 'name' or ('from', 'to', k) blended with overshoot
    if isinstance(spec, str): return ARM[spec]
    a, b, k = spec; k = back(k, 1.6); ea, ha, sa = ARM[a]; eb, hb, sb = ARM[b]
    return (lerp(ea[0], eb[0], k), lerp(ea[1], eb[1], k)), (lerp(ha[0], hb[0], k), lerp(ha[1], hb[1], k)), (sb if k > .5 else sa)


def _hair_cap(c, R, face, colr, lw, fringe=-62):
    fs = face * 14; hp = skia.Path(); hp.moveTo(-R - 4, -14)
    hp.arcTo(skia.Rect(-R - 4, -R - 6, R + 4, R + 4), 188, 164, False)
    hp.cubicTo(R - 8, -44, 46 + fs, fringe - 8, fs, fringe); hp.cubicTo(-44 + fs, fringe + 4, -R + 6, -40, -R - 4, -14); hp.close()
    shape(c, hp, colr, lw); return hp


def _seamless_leg(c, hip_x, foot_x, lift, lw):
    """Rounded continuous leg with a soft knee and attached shoe (same draw_char API)."""
    hip_y = BODY_BOT - 13
    foot_y = -lift
    knee_x = hip_x + (foot_x * .47) + (7 if hip_x < 0 else -7)
    knee_y = hip_y + (foot_y - hip_y) * .54 - min(8, lift * .18)
    path = skia.Path(); path.moveTo(hip_x, hip_y)
    path.quadTo(hip_x + foot_x * .12, hip_y + (knee_y - hip_y) * .60, knee_x, knee_y)
    path.quadTo(knee_x + foot_x * .25, knee_y + (foot_y - knee_y) * .60, hip_x + foot_x, foot_y)
    c.drawPath(path, ink(max(11, lw * 2.05)))
    toe_dir = 1 if foot_x >= 0 else -1
    shoe = skia.Path(); shoe.moveTo(hip_x + foot_x - toe_dir * 9, foot_y - 2)
    shoe.quadTo(hip_x + foot_x + toe_dir * 8, foot_y - 10, hip_x + foot_x + toe_dir * 24, foot_y - 3)
    c.drawPath(shoe, ink(max(11, lw * 2.0)))


def _sleeve_samples(sx, sy, ex, ey, hx_, hy_, arm_thick=17.5):
    """Quadratic arm spline sampled into a smoothly tapered sleeve polygon and sample points."""
    ctrl_x = 1.35 * ex - .175 * (sx + hx_)
    ctrl_y = 1.35 * ey - .175 * (sy + hy_)
    samples = []
    for i in range(13):
        t = i / 12
        px = (1-t)**2 * sx + 2*(1-t)*t*ctrl_x + t*t*hx_
        py = (1-t)**2 * sy + 2*(1-t)*t*ctrl_y + t*t*hy_
        tx = 2*(1-t)*(ctrl_x-sx) + 2*t*(hx_-ctrl_x)
        ty = 2*(1-t)*(ctrl_y-sy) + 2*t*(hy_-ctrl_y)
        length = max(1.0, math.hypot(tx, ty))
        nx, ny = -ty / length, tx / length
        width = arm_thick - (arm_thick * 0.42) * t
        samples.append((px, py, nx * width, ny * width))
    sleeve_poly = skia.Path()
    for i, (px, py, ox, oy) in enumerate(samples):
        (sleeve_poly.moveTo if i == 0 else sleeve_poly.lineTo)(px + ox, py + oy)
    for px, py, ox, oy in reversed(samples):
        sleeve_poly.lineTo(px - ox, py - oy)
    sleeve_poly.close()
    return sleeve_poly, samples


def _seamless_arm(c, sx, sy, ex, ey, hx_, hy_, spec, lw, show, arm_thick=17.5):
    """Filled tapered sleeve with continuous elbow, without raw shoulder cross-stroke."""
    sleeve_poly, samples = _sleeve_samples(sx, sy, ex, ey, hx_, hy_, arm_thick)
    c.drawPath(sleeve_poly, fp(spec['suit']))
    arm_stroke = skia.Path()
    arm_stroke.moveTo(samples[1][0] + samples[1][2], samples[1][1] + samples[1][3])
    for i in range(2, len(samples)):
        arm_stroke.lineTo(samples[i][0] + samples[i][2], samples[i][1] + samples[i][3])
    arm_stroke.lineTo(samples[-1][0] - samples[-1][2], samples[-1][1] - samples[-1][3])
    for i in range(len(samples) - 2, 0, -1):
        arm_stroke.lineTo(samples[i][0] - samples[i][2], samples[i][1] - samples[i][3])
    c.drawPath(arm_stroke, ink(lw * .85))
    cuff = skia.Path(); cuff.moveTo(hx_ - samples[-1][2], hy_ - samples[-1][3]); cuff.lineTo(hx_ + samples[-1][2], hy_ + samples[-1][3])
    c.drawPath(cuff, ink(lw * .5, spec['suit_d']))
    if show:
        circ(c, hx_, hy_, arm_thick * 0.65, spec['skin'], lw * .7)


def _build_body_path(outfit, sw, cw, ww, hw, bc, skirt_flare):
    """
    Constructs an organic, well-proportioned torso & dress silhouette with smooth Bezier curves.
    Completely eliminates egg belly and disjointed trapezoid skirts.
    """
    p = skia.Path()
    waist_y = BODY_TOP + 130  # ~ -215 (natural waist level)

    if outfit == 'dress':
        skirt_bot = BODY_BOT + 28   # ~ -100 (graceful knee length)
        skirt_w = ww + skirt_flare  # e.g. 38 + 30 = 68
        p.moveTo(-sw, BODY_TOP + 46)
        p.cubicTo(-sw * 0.9, BODY_TOP + 12, -sw * 0.45, BODY_TOP, 0, BODY_TOP)
        p.cubicTo(sw * 0.45, BODY_TOP, sw * 0.9, BODY_TOP + 12, sw, BODY_TOP + 46)
        p.cubicTo(cw + bc * 4, BODY_TOP + 80, ww + 3, waist_y - 25, ww, waist_y)
        p.cubicTo(ww + 8, waist_y + 40, skirt_w - 4, skirt_bot - 18, skirt_w, skirt_bot)
        p.quadTo(0, skirt_bot + 16, -skirt_w, skirt_bot)
        p.cubicTo(-skirt_w + 4, skirt_bot - 18, -ww - 8, waist_y + 40, -ww, waist_y)
        p.cubicTo(-ww - 3, waist_y - 25, -cw - bc * 4, BODY_TOP + 80, -sw, BODY_TOP + 46)
        p.close()
    else:
        p.moveTo(-sw, BODY_TOP + 46)
        p.cubicTo(-sw * 0.9, BODY_TOP + 12, -sw * 0.45, BODY_TOP, 0, BODY_TOP)
        p.cubicTo(sw * 0.45, BODY_TOP, sw * 0.9, BODY_TOP + 12, sw, BODY_TOP + 46)
        p.cubicTo(cw + bc * 4, BODY_TOP + 85, ww + 2, waist_y - 20, ww, waist_y)
        p.cubicTo(ww + 2, waist_y + 30, hw, BODY_BOT - 16, hw, BODY_BOT)
        p.quadTo(0, BODY_BOT + 8, -hw, BODY_BOT)
        p.cubicTo(-hw, BODY_BOT - 16, -ww - 2, waist_y + 30, -ww, waist_y)
        p.cubicTo(-ww - 2, waist_y - 20, -cw - bc * 4, BODY_TOP + 85, -sw, BODY_TOP + 46)
        p.close()

    return p


# --------------------------- HAIR STYLES ---------------------------

def _draw_hair_short(c, R, face, colr, lw):
    """Sculpted short hair: natural volume, clean sideburns, stylish side-parted fringe."""
    fs = face * 14
    p = skia.Path()
    p.moveTo(-R - 4, 10); p.lineTo(-R - 2, -22)
    p.cubicTo(-R - 6, -R * 0.65, -R * 0.7, -R - 8, 0, -R - 8)
    p.cubicTo(R * 0.65, -R - 10, R + 6, -R * 0.60, R + 4, -22)
    p.lineTo(R + 4, 10); p.lineTo(R - 4, 0)
    part_x = -16 + fs
    p.cubicTo(R - 10, -36, part_x + 36, -56, part_x + 8, -52)
    p.cubicTo(part_x + 2, -50, part_x - 6, -60, part_x - 14, -58)
    p.cubicTo(part_x - 30, -56, -R + 12, -36, -R + 2, 0)
    p.lineTo(-R - 4, 10); p.close()
    shape(c, p, colr, lw)
    return p


def _draw_hair_long_back(c, R, colr, lw):
    """Long hair back layer: flowing locks behind head and shoulders with soft organic taper."""
    p = skia.Path()
    p.moveTo(-R - 12, -20)
    p.cubicTo(-R - 14, -R - 12, R + 14, -R - 12, R + 12, -20)
    p.cubicTo(R + 18, 40, R + 22, 120, R + 14, 190)
    p.quadTo(R * 0.5, 210, 0, 195)
    p.quadTo(-R * 0.5, 210, -R - 14, 190)
    p.cubicTo(-R - 22, 120, -R - 18, 40, -R - 12, -20)
    p.close()
    shape(c, p, colr, lw)


def _draw_hair_long_front(c, R, face, colr, lw):
    """Long hair front layer: soft bangs and face-framing strands."""
    fs = face * 14
    p = skia.Path()
    p.moveTo(-R - 4, 30)
    p.cubicTo(-R - 2, -20, -R * 0.6, -R - 6, 0, -R - 6)
    p.cubicTo(R * 0.6, -R - 6, R + 2, -20, R + 4, 30)
    p.cubicTo(R - 6, 10, R - 8, -25, R - 16, -42)
    part_x = -10 + fs
    p.cubicTo(part_x + 30, -56, part_x + 10, -52, part_x, -50)
    p.cubicTo(part_x - 12, -56, -R + 20, -42, -R + 14, 10)
    p.lineTo(-R - 4, 30); p.close()
    shape(c, p, colr, lw)


def _draw_hair_bun(c, R, face, colr, lw):
    """Sculpted hair bun: sleek hair pulled back on skull, organic sculpted bun & hair tie."""
    fs = face * 14
    bun_y = -R - 26
    bp = skia.Path()
    bp.moveTo(-36, bun_y + 12)
    bp.cubicTo(-46, bun_y - 28, -20, bun_y - 48, 0, bun_y - 48)
    bp.cubicTo(20, bun_y - 48, 46, bun_y - 28, 36, bun_y + 12)
    bp.quadTo(0, bun_y + 18, -36, bun_y + 12); bp.close()
    shape(c, bp, colr, lw)
    c.drawLine(-22, bun_y + 12, 22, bun_y + 12, ink(lw * 0.9, (220, 120, 100)))

    hp = skia.Path()
    hp.moveTo(-R - 4, 8); hp.lineTo(-R - 2, -20)
    hp.cubicTo(-R - 6, -R * 0.6, -R * 0.65, -R - 4, 0, -R - 4)
    hp.cubicTo(R * 0.65, -R - 4, R + 6, -R * 0.6, R + 4, -20)
    hp.lineTo(R + 4, 8); hp.lineTo(R - 4, -2)
    p_x = -8 + fs
    hp.cubicTo(R - 12, -38, p_x + 30, -54, p_x + 4, -50)
    hp.cubicTo(p_x - 10, -54, -R + 14, -38, -R + 2, -2)
    hp.lineTo(-R - 4, 8); hp.close()
    shape(c, hp, colr, lw)


def _draw_hair_curly(c, R, face, colr, lw):
    """Curly hair: organic cloud of soft curling lobes hugging cranium and textured bangs."""
    fs = face * 14
    p = skia.Path()
    p.moveTo(-R - 4, 14)
    p.cubicTo(-R - 16, 0, -R - 22, -25, -R - 16, -45)
    p.cubicTo(-R - 22, -68, -R - 14, -92, -R * 0.7, -R - 14)
    p.cubicTo(-R * 0.5, -R - 26, -R * 0.2, -R - 24, 0, -R - 24)
    p.cubicTo(R * 0.2, -R - 24, R * 0.5, -R - 26, R * 0.7, -R - 14)
    p.cubicTo(R + 14, -92, R + 22, -68, R + 16, -45)
    p.cubicTo(R + 22, -25, R + 16, 0, R + 4, 14)
    p.lineTo(R - 4, 2)
    p.cubicTo(R - 12, -36, 42 + fs, -52, 24 + fs, -46)
    p.cubicTo(10 + fs, -42, 6 + fs, -56, -8 + fs, -52)
    p.cubicTo(-26 + fs, -48, -R + 18, -36, -R + 2, 2)
    p.lineTo(-R - 4, 14); p.close()
    shape(c, p, colr, lw)


def _draw_hair_slick(c, R, face, colr, lw, light=-1):
    """Slick swept-back hair with smooth temple contours and subtle highlight."""
    fs = face * 14
    hp = skia.Path()
    hp.moveTo(-R - 4, 8); hp.lineTo(-R - 2, -20)
    hp.cubicTo(-R - 5, -R * 0.65, -R * 0.65, -R - 6, 0, -R - 6)
    hp.cubicTo(R * 0.65, -R - 6, R + 5, -R * 0.65, R + 4, -20)
    hp.lineTo(R + 4, 8); hp.lineTo(R - 4, 0)
    hp.cubicTo(R - 10, -36, 44 + fs, -56, 4 + fs, -54)
    hp.cubicTo(-36 + fs, -52, -R + 12, -36, -R + 2, 0)
    hp.lineTo(-R - 4, 8); hp.close()
    shape(c, hp, colr, lw)
    shn = skia.Path()
    shn.addArc(skia.Rect(-R + 20, -R + 14, R - 20, R - 14), 210 if light < 0 else 280, 48)
    c.drawPath(shn, ink(lw * 1.2, (100, 105, 125)))


def _draw_hair_bald(c, R, colr, lw):
    """Bald side tufts: soft rounded cartoon hair patches at temples."""
    for sx in (-1, 1):
        tf = skia.Path()
        tf.moveTo(sx * 84, -40)
        tf.cubicTo(sx * 108, -32, sx * 114, -10, sx * 104, 8)
        tf.cubicTo(sx * 112, 20, sx * 98, 30, sx * 86, 32); tf.close()
        shape(c, tf, colr, lw * 0.8)


def draw_chibi_v9(c, x, y, s, spec, face=0.0, eyes='dot', mouth='smile', brow=0.0, brow_tilt=0.0,
                  arms=('down', 'down'), tilt=0.0, bob=0.0, squash=0.0, sweat=-1.0, light=-1,
                  rim=None, hat=None, legs=None, pupil=0.0, sparkle=0.0, debug_marker=None, t=0.0):
    return draw_chibi_character(c, x, y, s, spec, face=face, eyes=eyes, mouth=mouth, brow=brow, brow_tilt=brow_tilt,
                                arms=arms, tilt=tilt, bob=bob, squash=squash, sweat=sweat, light=light, rim=rim,
                                hat=hat, legs=legs, pupil=pupil, sparkle=sparkle, t=t)


def _old_draw_chibi_v9(c, x, y, s, spec, face=0.0, eyes='dot', mouth='smile', brow=0.0, brow_tilt=0.0,
                  arms=('down', 'down'), tilt=0.0, bob=0.0, squash=0.0, sweat=-1.0, light=-1,
                  rim=None, hat=None, legs=None, pupil=0.0, sparkle=0.0, debug_marker=None, t=0.0):
    spec = make_look(spec)
    lw = max(5.2, 4.0 / s)
    ink_col = spec.get('ink', '#191918')

    c.save()
    c.translate(x, y)
    c.scale(s, s)

    # Debug Bounding Box & Label
    if os.environ.get("RM_DEBUG", "1") in ("1", "true", "True"):
        c.drawRect(skia.Rect(-95, -365, 95, 25), ink(3.5 / s, '#00FFAA'))
        c.drawRect(skia.Rect(-95, -408, 120, -365), fp('#0F172A', 220))
        c.drawString("CHIBI V9 RIG", -85, -380, skia.Font(None, 24), fp('#00FFAA'))

    # Flip horizontally if facing left (keeping 3/4 perspective consistent)
    if face < -0.1:
        c.scale(-1, 1)

    # 1. Shadow
    c.drawOval(skia.Rect(-74, -8, 74, 16), fp('#171715', 46))

    # Kinematics from legs & walk cycle
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

    # Lean & bounce
    lean = tilt + (swing * 0.12 if is_walking else 0.0)
    c.translate(0, -bob)
    if squash:
        c.scale(1 + squash * 0.5, 1 - squash)

    # 2. Far Leg (hip at -17, -87)
    c.save()
    c.translate(-17, -87)
    c.rotate(-swing)
    poly(c, [(-20, -4), (16, -4), (24, 53), (-10, 59), (-23, 22)], spec['pants_far'], lw, ink_col)
    c.save()
    c.translate(7, 61 - lift_far)
    c.rotate(swing * 0.25)
    c.scale(0.78, 0.78)
    p_boot_far = skia.Path()
    p_boot_far.moveTo(-17, -5); p_boot_far.lineTo(18, -7); p_boot_far.lineTo(43, 12); p_boot_far.quadTo(48, 22, 32, 25); p_boot_far.lineTo(-23, 25); p_boot_far.quadTo(-32, 23, -31, 15); p_boot_far.close()
    shape(c, p_boot_far, spec['boots_far'], lw, ink_col)
    c.restore()
    c.restore()

    # 3. Far Arm (shoulder at -54, -176, strictly behind backpack!)
    far_arm_ang = -4.0
    if is_walking:
        forward_far = 0.5 + 0.5 * (-swing / 28.0 if swing != 0 else 0)
        far_arm_ang = -3.0 - 16.0 * forward_far
    elif arms[0] not in ('down',):
        far_arm_ang = -25.0

    c.save()
    c.rotate(lean, -5, -162)
    c.save()
    c.translate(-54, -176)
    c.rotate(far_arm_ang)
    p_sleeve_far = skia.Path()
    p_sleeve_far.moveTo(-5, -2); p_sleeve_far.quadTo(3, -7, 9, 0); p_sleeve_far.quadTo(15, 11, 13, 28); p_sleeve_far.lineTo(9, 68); p_sleeve_far.quadTo(5, 74, -3, 72)
    p_sleeve_far.lineTo(-10, 67); p_sleeve_far.quadTo(-12, 52, -12, 32); p_sleeve_far.lineTo(-13, 12); p_sleeve_far.quadTo(-12, 2, -5, -2); p_sleeve_far.close()
    shape(c, p_sleeve_far, spec['sleeve_far'], lw * 0.85, ink_col)
    p_hand_far = skia.Path()
    p_hand_far.moveTo(-4, 69); p_hand_far.quadTo(3, 68, 9, 66); p_hand_far.lineTo(10, 83); p_hand_far.quadTo(7, 90, 0, 90); p_hand_far.quadTo(-8, 89, -9, 82); p_hand_far.lineTo(-9, 71); p_hand_far.close()
    shape(c, p_hand_far, spec['skin'], lw * 0.6, ink_col)
    c.restore() # far arm
    c.restore() # lean

    # 4. Backpack (rear left, snug against torso back)
    if spec.get('show_backpack', True):
        p_bp = skia.Path()
        p_bp.moveTo(-54, -183); p_bp.quadTo(-88, -186, -90, -158); p_bp.lineTo(-89, -107); p_bp.quadTo(-71, -96, -53, -113); p_bp.close()
        shape(c, p_bp, spec['backpack'], lw * 1.1, ink_col)
        p_bps = skia.Path()
        p_bps.moveTo(-72, -166); p_bps.quadTo(-80, -141, -73, -119)
        c.drawPath(p_bps, ink(lw * 1.1, spec['backpack_stripe']))

    # 5. Near Leg (hip at 17, -87)
    c.save()
    c.translate(17, -87)
    c.rotate(swing)
    poly(c, [(-18, -4), (20, -4), (24, 54), (-13, 60), (-23, 24)], spec['pants_near'], lw, ink_col)
    c.save()
    c.translate(7, 62 - lift_near)
    c.rotate(-swing * 0.25)
    c.scale(0.78, 0.78)
    p_boot_near = skia.Path()
    p_boot_near.moveTo(-17, -5); p_boot_near.lineTo(18, -7); p_boot_near.lineTo(45, 12); p_boot_near.quadTo(49, 22, 33, 25); p_boot_near.lineTo(-24, 25); p_boot_near.quadTo(-33, 23, -32, 15); p_boot_near.close()
    shape(c, p_boot_near, spec['boots'], lw, ink_col)
    c.restore()
    c.restore()

    # 6. Torso Group
    c.save()
    c.rotate(lean, -5, -162)

    # Torso body
    p_torso = skia.Path()
    p_torso.moveTo(-48, -189); p_torso.quadTo(-11, -207, 35, -187); p_torso.lineTo(50, -91); p_torso.quadTo(-2, -73, -48, -92); p_torso.close()
    shape(c, p_torso, spec['color'], lw * 1.25, ink_col)

    # Side seam & horizontal pocket lines
    p_seam = skia.Path()
    p_seam.moveTo(-30, -185); p_seam.quadTo(-22, -144, -27, -98)
    c.drawPath(p_seam, ink(lw, spec['jacket_seam']))
    line(c, -22, -152, 41, -140, lw, spec['jacket_seam'])
    line(c, -20, -113, 43, -111, lw, spec['jacket_seam'])

    # Chest pocket
    poly(c, [(7, -146), (34, -141), (34, -108), (7, -109)], spec['pocket'], lw * 0.7, ink_col)

    # Backpack strap on rear shoulder
    if spec.get('show_backpack', True):
        p_strap = skia.Path()
        p_strap.moveTo(-37, -183); p_strap.quadTo(-20, -172, -19, -149); p_strap.lineTo(-18, -115)
        c.drawPath(p_strap, ink(lw * 1.8, ink_col))
        c.drawPath(p_strap, ink(lw, spec['backpack_strap']))

    # 7. Near Arm (in front of torso)
    near_arm_ang = 6.0
    if is_walking:
        near_arm_ang = swing * 0.46
    else:
        a1 = arms[1] if isinstance(arms, (tuple, list)) else 'down'
        if isinstance(a1, tuple): a1 = a1[0]
        if a1 in ('wave', 'salute', 'hi'):
            near_arm_ang = -105.0 + math.sin(t * 14.0) * 22.0
        elif a1 in ('point', 'reach'):
            near_arm_ang = -72.0
        elif a1 in ('chin', 'think'):
            near_arm_ang = -65.0
        elif a1 in ('arms_crossed', 'fold'):
            near_arm_ang = -35.0

    c.save()
    c.translate(34, -180)
    c.rotate(near_arm_ang)
    poly(c, [(-12, -5), (18, -4), (18, 51), (-8, 56), (-21, 14)], spec['sleeve_near'], lw, ink_col)
    p_hand_near = skia.Path()
    p_hand_near.moveTo(-8, 52); p_hand_near.lineTo(17, 50); p_hand_near.lineTo(18, 67); p_hand_near.quadTo(7, 80, -8, 70); p_hand_near.close()
    shape(c, p_hand_near, spec['skin'], lw * 0.85, ink_col)
    c.restore()

    # 8. Head (pivot at 1, -201)
    head_ang = -lean * 0.4
    c.save()
    c.translate(1, -201)
    c.rotate(head_ang)

    # Round head silhouette
    p_head = skia.Path()
    p_head.moveTo(-58, -99); p_head.quadTo(-79, -56, -56, -16); p_head.quadTo(-27, 24, 27, 11)
    p_head.quadTo(79, -2, 83, -52); p_head.quadTo(82, -99, 38, -112); p_head.quadTo(-13, -131, -58, -99); p_head.close()
    shape(c, p_head, spec['skin'], lw * 1.25, ink_col)

    # Eyes: Oval black 3/4
    if eyes == 'closed':
        line(c, 19, -54, 35, -54, lw * 0.85, ink_col)
        line(c, 54, -53, 69, -53, lw * 0.85, ink_col)
    else:
        ry = 17 if pupil <= 0 else 19
        c.drawOval(skia.Rect(21, -53 - ry, 35, -53 + ry), fp(ink_col))
        c.drawOval(skia.Rect(55, -51 - ry, 69, -51 + ry), fp(ink_col))

    # Mouth
    if mouth == 'open':
        p_m = skia.Path()
        p_m.moveTo(62, -16); p_m.quadTo(73, -4, 82, -15); p_m.quadTo(73, -21, 62, -16); p_m.close()
        c.drawPath(p_m, fp(ink_col))
    elif mouth in ('mid', 'o'):
        c.drawOval(skia.Rect(66, -18, 78, -10), fp(ink_col))
    elif mouth in ('fear', 'shock', 'gasp', 'worried'):
        c.drawOval(skia.Rect(65, -20, 79, -8), fp(ink_col))
        c.drawOval(skia.Rect(65, -20, 79, -8), ink(lw * 0.5, ink_col))
    else:
        p_m = skia.Path()
        p_m.moveTo(65, -14); p_m.quadTo(74, -9, 80, -15)
        c.drawPath(p_m, ink(lw * 0.65, ink_col))

    # Helmet dome & brim
    p_helm = skia.Path()
    p_helm.moveTo(-66, -81); p_helm.quadTo(-69, -159, -3, -163); p_helm.quadTo(64, -166, 77, -91); p_helm.lineTo(75, -72); p_helm.quadTo(5, -85, -68, -71); p_helm.close()
    shape(c, p_helm, spec['hair_col'], lw * 1.25, ink_col)

    p_brim = skia.Path()
    p_brim.moveTo(-87, -76); p_brim.quadTo(-15, -101, 91, -76); p_brim.quadTo(91, -58, 53, -53); p_brim.lineTo(-69, -58); p_brim.quadTo(-87, -61, -87, -76); p_brim.close()
    shape(c, p_brim, spec['hair_col'], lw * 1.1, ink_col)

    # Highlight line
    p_hi = skia.Path()
    p_hi.moveTo(-40, -141); p_hi.quadTo(-1, -159, 36, -138)
    c.drawPath(p_hi, ink(lw * 0.7, '#666869', 140))

    c.restore() # head
    c.restore() # torso group
    c.restore() # root


def draw_char(c, x, y, s, spec, face=0.0, eyes='dot', mouth='smile', brow=0.0, brow_tilt=0.0, arms=('down', 'down'),
              tilt=0.0, bob=0.0, squash=0.0, sweat=-1.0, light=-1, rim=None, hat=None, legs=None, pupil=0.0, sparkle=0.0,
              debug_marker=None, t=0.0):
    """x,y = feet. s=1 -> head radius 100 px. Balanced body silhouette, seamless shoulders, sculpted hair."""
    spec = make_look(spec)
    if spec.get('style') not in ('classic', 'tall', 'legacy'):
        return draw_chibi_v9(c, x, y, s, spec, face=face, eyes=eyes, mouth=mouth, brow=brow, brow_tilt=brow_tilt,
                             arms=arms, tilt=tilt, bob=bob, squash=squash, sweat=sweat, light=light, rim=rim,
                             hat=hat, legs=legs, pupil=pupil, sparkle=sparkle, debug_marker=debug_marker, t=t)
    lw = max(5.2, 4.0 / s); R = HEAD_R; outfit = spec.get('outfit', 'suit')
    hat = spec.get('hat') if hat is None else hat

    sw = spec['shoulder_w']
    cw = spec['chest_w']
    ww = spec['waist_w']
    hw = spec['hip_w']
    bc = spec['belly_curve']
    skirt_flare = spec['skirt_flare']
    arm_thick = spec['arm_thick']
    hair = spec.get('hair', 'short')

    c.save(); c.translate(x, y); c.scale(s, s)

    # 1. Legs
    for (hx0, fx, lift) in (legs or ((-22, 0, 0), (22, 0, 0))):
        _seamless_leg(c, hx0, fx, lift, lw)

    c.translate(0, -bob); c.scale(1 + squash * 0.6, 1 - squash)

    # 2. Long hair back layer
    if hair == 'long':
        c.save(); c.translate(0, HEAD_CY); c.rotate(tilt)
        _draw_hair_long_back(c, R, spec['hair_col'], lw)
        c.restore()

    # 3. Sculpted body silhouette path
    body_path = _build_body_path(outfit, sw, cw, ww, hw, bc, skirt_flare)

    # 4. Arms and shoulders
    arm_data = []
    crossing_arms = []
    union_sleeves = []

    for side, a in ((-1, arms[0]), (1, arms[1])):
        e, h, show = _arm(a); m = 1 if side < 0 else -1
        sx = -sw * m
        sy = BODY_TOP + 48
        ex, ey = e[0] * m, e[1]
        hx_, hy_ = h[0] * m, h[1]

        # Dynamic shoulder elevation when arms are raised
        if ey < BODY_TOP + 50:
            lift = max(0.0, min(22.0, (BODY_TOP + 50 - ey) * 0.25))
            sy -= lift
            sx += (-3 if side < 0 else 3) * (lift / 22.0)

        sleeve_poly, samples = _sleeve_samples(sx, sy, ex, ey, hx_, hy_, arm_thick=arm_thick)
        inward_reach = (hx_ - ex) * m
        in_torso = (abs(hx_) < ww + 15 or abs(ex) < sw + 10)
        is_crossing = (inward_reach > 18 and in_torso)

        info = dict(side=side, m=m, sx=sx, sy=sy, ex=ex, ey=ey, hx=hx_, hy=hy_,
                    poly=sleeve_poly, samples=samples, show=show, is_crossing=is_crossing)
        arm_data.append(info)
        if is_crossing: crossing_arms.append(info)
        else: union_sleeves.append(sleeve_poly)

    # Composite garment silhouette (torso + sleeves)
    suit_silhouette = skia.Path(body_path)
    for sl in union_sleeves:
        u = skia.Op(suit_silhouette, sl, skia.PathOp.kUnion_PathOp)
        if u and not u.isEmpty(): suit_silhouette = u

    # For crossing arms, union their shoulder root polygon so shoulder is seamless
    for arm in crossing_arms:
        samples = arm['samples']
        sh_poly = skia.Path()
        sh_poly.moveTo(samples[0][0] + samples[0][2], samples[0][1] + samples[0][3])
        sh_poly.lineTo(samples[2][0] + samples[2][2], samples[2][1] + samples[2][3])
        sh_poly.lineTo(samples[2][0] - samples[2][2], samples[2][1] - samples[2][3])
        sh_poly.lineTo(samples[0][0] - samples[0][2], samples[0][1] - samples[0][3])
        sh_poly.close()
        u = skia.Op(suit_silhouette, sh_poly, skia.PathOp.kUnion_PathOp)
        if u and not u.isEmpty(): suit_silhouette = u

    # 5. Fill base garment
    c.drawPath(suit_silhouette, fp(spec['suit']))

    # 6. Torso inner details clipped to body
    c.save(); c.clipPath(body_path, doAntiAlias=True)
    sh = skia.Path(body_path); sh.offset(light * 14, -4)
    c.drawPath(skia.Op(body_path, sh, skia.PathOp.kDifference_PathOp), fp(spec['suit_d']))

    if outfit == 'suit':
        v = skia.Path(); v.moveTo(-sw * 0.48, BODY_TOP - 4); v.lineTo(0, BODY_TOP + 96); v.lineTo(sw * 0.48, BODY_TOP - 4); v.close()
        c.drawPath(v, fp(spec['shirt']))
        if spec.get('bowtie'):
            by = BODY_TOP + 40; bt = skia.Path()
            bt.moveTo(0, by); bt.lineTo(-22, by - 12); bt.lineTo(-22, by + 12); bt.close()
            bt.moveTo(0, by); bt.lineTo(22, by - 12); bt.lineTo(22, by + 12); bt.close()
            shape(c, bt, spec['tie'], lw * 0.75); circ(c, 0, by, 5, spec['tie'], lw * 0.7)
        elif spec.get('tie') not in (None, 'none'):
            poly(c, [(-9, BODY_TOP + 24), (9, BODY_TOP + 24), (12, BODY_TOP + 82), (0, BODY_TOP + 98), (-12, BODY_TOP + 82)], spec['tie'], lw * 0.75)
        for sx_i in (-1, 1):
            lp = skia.Path(); lp.moveTo(sx_i * (sw * 0.52), BODY_TOP - 2); lp.lineTo(sx_i * 2, BODY_TOP + 98); lp.lineTo(sx_i * 2, BODY_BOT)
            c.drawPath(lp, ink(lw * 0.75))
            c.drawLine(sx_i * 18, BODY_TOP + 56, sx_i * (sw * 0.65), BODY_TOP + 44, ink(lw * 0.6))
    elif outfit == 'hoodie':
        hood = skia.Path(); hood.moveTo(-sw * 0.85, BODY_TOP - 2); hood.quadTo(0, BODY_TOP + 42, sw * 0.85, BODY_TOP - 2)
        c.drawPath(hood, ink(lw * 0.8))
        for sx_i in (-1, 1): c.drawLine(sx_i * 14, BODY_TOP + 18, sx_i * 16, BODY_TOP + 80, ink(lw * 0.55, spec['shirt']))
        pk = skia.Path(); pk.moveTo(-ww * 0.75, BODY_BOT - 6); pk.lineTo(-ww * 0.60, BODY_BOT - 58); pk.lineTo(ww * 0.60, BODY_BOT - 58); pk.lineTo(ww * 0.75, BODY_BOT - 6)
        c.drawPath(pk, ink(lw * 0.6))
    elif outfit == 'dress':
        nk = skia.Path(); nk.addArc(skia.Rect(-26, BODY_TOP - 16, 26, BODY_TOP + 32), 15, 150); c.drawPath(nk, ink(lw * 0.68))
    elif outfit in ('tshirt', 'sweater'):
        nk = skia.Path(); nk.addArc(skia.Rect(-30, BODY_TOP - 28, 30, BODY_TOP + 26), 20, 140); c.drawPath(nk, ink(lw * 0.7))
        if outfit == 'sweater':
            for yy in (BODY_BOT - 20,): c.drawLine(-hw, yy, hw, yy, ink(lw * 0.6))
    if spec.get('hanky'):
        poly(c, [(28, BODY_TOP + 96), (48, BODY_TOP + 92), (44, BODY_TOP + 76), (38, BODY_TOP + 86), (30, BODY_TOP + 76)], spec['hanky'], lw * 0.55)
    c.restore()

    # 7. Outer outline of composite garment
    c.drawPath(suit_silhouette, ink(lw))

    # 8. Foreground crossing arms
    for arm in crossing_arms:
        c.drawPath(arm['poly'], fp(spec['suit']))
        samples = arm['samples']
        arm_stroke = skia.Path()
        arm_stroke.moveTo(samples[2][0] + samples[2][2], samples[2][1] + samples[2][3])
        for i in range(3, len(samples)):
            arm_stroke.lineTo(samples[i][0] + samples[i][2], samples[i][1] + samples[i][3])
        arm_stroke.lineTo(samples[-1][0] - samples[-1][2], samples[-1][1] - samples[-1][3])
        for i in range(len(samples) - 2, 1, -1):
            arm_stroke.lineTo(samples[i][0] - samples[i][2], samples[i][1] - samples[i][3])
        c.drawPath(arm_stroke, ink(lw * 0.85))

    # 9. Cuffs and hands
    for arm in arm_data:
        samples = arm['samples']
        hx_i, hy_i = arm['hx'], arm['hy']
        cuff = skia.Path()
        cuff.moveTo(hx_i - samples[-1][2], hy_i - samples[-1][3]); cuff.lineTo(hx_i + samples[-1][2], hy_i + samples[-1][3])
        c.drawPath(cuff, ink(lw * 0.5, spec['suit_d']))
        if arm['show']:
            circ(c, hx_i, hy_i, arm_thick * 0.65, spec['skin'], lw * 0.7)

    # 10. Head & Face
    c.save(); c.translate(0, HEAD_CY); c.rotate(tilt)
    head = skia.Path(); head.addCircle(0, 0, R)
    c.drawPath(head, fp(spec['skin'])); c.save(); c.clipPath(head, doAntiAlias=True)
    lit = skia.Path(head); lit.offset(light * 7, -17); c.drawPath(skia.Op(head, lit, skia.PathOp.kDifference_PathOp), fp(spec['skin_d']))
    if rim:
        rm = skia.Path(head); rm.offset(-light * 11, 4); c.drawPath(skia.Op(head, rm, skia.PathOp.kDifference_PathOp), fp(rim, 215))
    c.restore()

    if hair == 'short':
        _draw_hair_short(c, R, face, spec['hair_col'], lw)
    elif hair == 'long':
        _draw_hair_long_front(c, R, face, spec['hair_col'], lw)
    elif hair == 'bun':
        _draw_hair_bun(c, R, face, spec['hair_col'], lw)
    elif hair == 'curly':
        _draw_hair_curly(c, R, face, spec['hair_col'], lw)
    elif hair == 'slick':
        _draw_hair_slick(c, R, face, spec['hair_col'], lw, light=light)
    elif hair == 'bald':
        _draw_hair_bald(c, R, spec.get('hair_col', '#8A8A92'), lw)

    c.drawPath(head, ink(lw))

    if hat == 'fedora':
        crown = skia.Path(); crown.moveTo(-R + 6, -56); crown.cubicTo(-R - 2, -R - 82, R + 2, -R - 82, R - 6, -56); crown.close()
        shape(c, crown, spec['hat_col'], lw); c.save(); c.clipPath(crown, doAntiAlias=True)
        c.drawRect(skia.Rect(-R, -86, R, -56), fp(spec['hat_band'])); c.drawLine(-R, -86, R, -86, ink(lw * 0.7)); c.restore()
        c.drawPath(crown, ink(lw)); oval(c, -R - 40, -70, R + 40, -40, spec['hat_col'], lw)
    elif hat == 'cap':
        cp = skia.Path(); cp.moveTo(-R - 2, -40); cp.arcTo(skia.Rect(-R - 2, -R - 10, R + 2, R), 182, 176, False); cp.close(); shape(c, cp, spec['hat_col'], lw)
        d = 1 if face >= 0 else -1; br = skia.Path(); br.moveTo(d * 10, -44); br.quadTo(d * (R + 70), -52, d * (R + 76), -30); br.lineTo(d * 10, -34); br.close(); shape(c, br, spec['hat_col'], lw)

    fx = face * 40; eyy = -6
    for ex0 in (-30, 30):
        ex = ex0 + fx; far = (face > 0 and ex0 > 0) or (face < 0 and ex0 < 0); sq = 1 - 0.3 * abs(face) if far else 1.0
        if eyes == 'wide':
            oval(c, ex - 17 * sq, eyy - 17, ex + 17 * sq, eyy + 17, '#FBFBF7', lw * 0.7)
            c.drawOval(skia.Rect(ex - 5.5 * sq + pupil * 6, eyy - 5.5, ex + 5.5 * sq + pupil * 6, eyy + 5.5), fp(INK))
        elif eyes == 'closed':
            e = skia.Path(); e.moveTo(ex - 11 * sq, eyy); e.quadTo(ex, eyy + 9, ex + 11 * sq, eyy); c.drawPath(e, ink(lw * 0.8))
        elif eyes == 'half':
            c.save(); c.clipRect(skia.Rect(ex - 20, eyy - 3, ex + 20, eyy + 20)); c.drawOval(skia.Rect(ex - 6.5 * sq, eyy - 9, ex + 6.5 * sq, eyy + 9), fp(INK)); c.restore()
            c.drawLine(ex - 13 * sq, eyy - 4, ex + 13 * sq, eyy - 4, ink(lw * 0.8))
        else:
            py = -4 if pupil < 0 and eyes == 'dot' and abs(pupil) > 0.5 else 0
            c.drawOval(skia.Rect(ex - 5.5 * sq, eyy - 8 + py, ex + 5.5 * sq, eyy + 8 + py), fp(INK)); c.drawCircle(ex + 1.5, eyy - 3 + py, 1.8, fp((255, 255, 255), 220))
        inner = 1 if ex0 < 0 else -1; by = eyy - 29 - brow * 9
        c.drawLine(ex - 13 * sq, by + (brow_tilt * 7 if inner < 0 else -brow_tilt * 7),
                   ex + 13 * sq, by + (brow_tilt * 7 if inner > 0 else -brow_tilt * 7), ink(lw * 0.78))

    if spec.get('glasses'):
        for ex0 in (-30, 30):
            ex = ex0 + fx; far = (face > 0 and ex0 > 0) or (face < 0 and ex0 < 0); sq = 1 - 0.3 * abs(face) if far else 1.0
            g = skia.Path(); g.addOval(skia.Rect(ex - 24 * sq, eyy - 24, ex + 24 * sq, eyy + 24)); c.drawPath(g, fp((225, 240, 255), 55)); c.drawPath(g, ink(lw * 0.7))
        c.drawLine(fx - 7, eyy - 3, fx + 7, eyy - 3, ink(lw * 0.7))

    mx, my = face * 34, 42
    if spec.get('beard'):
        bd = skia.Path(); bd.moveTo(-R + 6, 6); bd.quadTo(-R + 4, R - 4, mx, R + 18); bd.quadTo(R - 4, R - 4, R - 6, 6)
        bd.quadTo(R * 0.5, 40, mx + 26, 30); bd.quadTo(mx, 22, mx - 26, 30); bd.quadTo(-R * 0.5, 40, -R + 6, 6); bd.close()
        shape(c, bd, spec['hair_col'], lw * 0.8)

    if spec.get('moustache'):
        mu = skia.Path(); mu.moveTo(mx, my - 20)
        mu.cubicTo(mx - 12, my - 28, mx - 30, my - 22, mx - 40, my - 30); mu.cubicTo(mx - 30, my - 10, mx - 12, my - 12, mx, my - 15)
        mu.cubicTo(mx + 12, my - 12, mx + 30, my - 10, mx + 40, my - 30); mu.cubicTo(mx + 30, my - 22, mx + 12, my - 28, mx, my - 20); mu.close()
        c.drawPath(mu, fp(spec['hair_col']))

    if mouth == 'smile': m = skia.Path(); m.moveTo(mx - 17, my - 2); m.quadTo(mx, my + 13, mx + 17, my - 2); c.drawPath(m, ink(lw * 0.82))
    elif mouth == 'smirk':
        d = 1 if face >= 0 else -1; m = skia.Path(); m.moveTo(mx - 15 * d, my + 3); m.quadTo(mx + 4 * d, my + 12, mx + 20 * d, my - 6); c.drawPath(m, ink(lw * 0.82))
    elif mouth == 'flat': c.drawLine(mx - 12, my + 2, mx + 12, my + 2, ink(lw * 0.82))
    elif mouth == 'o': oval(c, mx - 8, my - 9, mx + 8, my + 11, '#5A1A1E', lw * 0.75)
    elif mouth == 'mid': oval(c, mx - 12, my - 4, mx + 12, my + 10, '#5A1A1E', lw * 0.75)
    elif mouth == 'open':
        mp = skia.Path(); mp.moveTo(mx - 20, my - 5); mp.lineTo(mx + 20, my - 5); mp.cubicTo(mx + 19, my + 24, mx - 19, my + 24, mx - 20, my - 5); mp.close()
        c.drawPath(mp, fp('#5A1A1E')); c.save(); c.clipPath(mp, doAntiAlias=True)
        c.drawRect(skia.Rect(mx - 22, my - 6, mx + 22, my + 2), fp('#FAFAF4')); c.drawOval(skia.Rect(mx - 11, my + 9, mx + 11, my + 26), fp('#D05860')); c.restore()
        c.drawPath(mp, ink(lw * 0.7))

    if sparkle > 0:
        k = pop(sparkle) * (1 if sparkle < 1 else max(0, 2 - sparkle)); sx_, sy_ = mx + 26 * (1 if face >= 0 else -1), my - 8; st = skia.Path()
        for i in range(8):
            r_ = (20 if i % 2 == 0 else 5) * k; a = i * math.pi / 4; (st.moveTo if i == 0 else st.lineTo)(sx_ + r_ * math.cos(a), sy_ + r_ * math.sin(a))
        st.close(); c.drawPath(st, fp('#FFFFFF'))

    if sweat >= 0:
        sx0, sy0 = (-1 if face > 0 else 1) * 62, -66 + 30 * (sweat % 1.0)
        d = skia.Path(); d.moveTo(sx0, sy0 - 19); d.cubicTo(sx0 + 12, sy0 - 3, sx0 + 11, sy0 + 10, sx0, sy0 + 10); d.cubicTo(sx0 - 11, sy0 + 10, sx0 - 12, sy0 - 3, sx0, sy0 - 19); d.close()
        shape(c, d, '#8FC8EE', lw * 0.7)

    c.restore()

    # Temporary verification debug marker
    use_dbg = DEBUG_MARKER if debug_marker is None else debug_marker
    if use_dbg:
        dbg_p = skia.Paint(Color=skia.Color(0, 240, 120), AntiAlias=True)
        c.drawCircle(0, BODY_TOP + 30, 8, dbg_p)
        dbg_ink = ink(lw * 0.6, (0, 60, 20))
        c.drawCircle(0, BODY_TOP + 30, 8, dbg_ink)

    c.restore()


def walk_legs(phase, stride=46, lift=20):  # legs=walk_legs((t-t0)*11) with bob=7*abs(sin(phase))
    a = math.sin(phase)
    return ((-10, a * stride, max(0, math.cos(phase)) * lift), (10, -a * stride, max(0, -math.cos(phase)) * lift))
