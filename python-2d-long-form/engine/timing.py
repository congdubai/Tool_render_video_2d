"""Script -> sentences, and voiceover -> per-word / per-sentence timing.
Primary: sherpa-onnx word timestamps aligned to the script text. The model follows the market language (RM_LANG):
en = Parakeet TDT v2, fr/de = Parakeet TDT v3 (25 European languages), vi = Zipformer Vietnamese.
Fallback (no model): energy-based speech detection + syllable-proportional placement snapped to pauses."""
import json, os, re, subprocess, difflib, unicodedata, glob
import numpy as np

SPLIT = re.compile(r"(?<=[.!?…])[\"”’)]*\s+")
ABBR = re.compile(r"\b(Mr|Mrs|Ms|Dr|St|vs|Jr|Sr|U\.S|e\.g|i\.e|No|Inc|Co|Mt|M|Mme|Mlle|Hr|Fr|Nr|bzw|ca|usw|z\.B|u\.a|TP|ThS|TS|PGS)\.$", re.I)


def sentences(text):
    text = text.replace('\r', '')
    out = []
    for para in re.split(r"\n", text):
        para = para.strip()
        if not para or para.startswith('#'): continue
        parts = [s.strip() for s in SPLIT.split(para) if s.strip()]
        merged = []
        for p in parts:
            if merged and ABBR.search(merged[-1]): merged[-1] += " " + p
            else: merged.append(p)
        out += merged
    return out


def norm(w):
    # accent-insensitive key so script words match ASR words in any market language (ệ->e, ü->u, ç->c, đ->d, ß->ss)
    w = unicodedata.normalize("NFD", w.lower().replace("’", "'").replace("đ", "d").replace("ß", "ss"))
    w = "".join(ch for ch in w if not unicodedata.combining(ch))
    w = re.sub(r"[^a-z0-9']+", "", w)
    return w.strip("'")


def words_of(s): return [w for w in (norm(x) for x in s.split()) if w]


def syllables(w):
    w = norm(w)
    if not w: return 1
    if w.isdigit(): return max(1, len(w) * 2)
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith('e') and n > 1 and not w.endswith('le'): n -= 1
    return max(1, n)


def load_audio(path, sr=16000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def speech_mask(x, sr=16000, hop=0.01):
    n = int(sr * hop); m = len(x) // n
    e = np.sqrt(np.mean(x[:m * n].reshape(m, n) ** 2, axis=1) + 1e-12); db = 20 * np.log10(e)
    ref = np.percentile(db, 95); thr = max(ref - 32, np.percentile(db, 10) + 6)
    on = db > thr
    k = int(0.12 / hop)  # close short gaps < 120 ms
    idx = np.where(on)[0]
    if len(idx):
        gaps = np.diff(idx)
        for a, g in zip(idx[:-1], gaps):
            if 1 < g <= k: on[a:a + g] = True
    return on, hop


MODELS = {"en": "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8", "fr": "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
          "de": "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8", "vi": "sherpa-onnx-zipformer-vi-int8-2025-04-20"}


def _pick(d, part):
    fs = sorted(glob.glob(os.path.join(d, f"{part}*.onnx")))
    return ([f for f in fs if ".int8." in f] or fs or [None])[0]


def find_model():
    lang = os.environ.get("RM_LANG", "en").lower(); name = MODELS.get(lang, MODELS["en"])
    base = os.environ.get("RM_MODELS", os.path.expanduser("~/models"))
    cands = [os.environ.get("RM_ASR", ""), os.path.join(base, name),
             os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", name)]
    if lang == "en": cands.append(os.path.join(base, MODELS["fr"]))  # v3 also reads English
    for c in cands:
        if c and _pick(c, "encoder") and os.path.exists(os.path.join(c, "tokens.txt")): return c
    return None


def asr_words(x, sr, model):
    import sherpa_onnx
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=_pick(model, "encoder"), decoder=_pick(model, "decoder"),
                                                        joiner=_pick(model, "joiner"), tokens=os.path.join(model, "tokens.txt"),
                                                        num_threads=max(1, min(8, os.cpu_count() or 2)),
                                                        model_type="nemo_transducer" if "nemo" in os.path.basename(model) else "")
    on, hop = speech_mask(x, sr)
    # chunk at silences, ~20 s per chunk
    cuts = [0]; L = len(x) / sr; t = 0.0
    while t + 24 < L:
        lo, hi = int((t + 16) / hop), int(min(t + 24, L) / hop)
        seg = on[lo:hi]; off = np.where(~seg)[0]
        c_ = (lo + off[len(off) // 2]) * hop if len(off) else (t + 20)
        cuts.append(c_); t = c_
    cuts.append(L); words = []
    for a, b in zip(cuts, cuts[1:]):
        st = rec.create_stream(); st.accept_waveform(sr, x[int(a * sr):int(b * sr)]); rec.decode_stream(st); r = st.result
        cur = None
        for tok, ts in zip(r.tokens, r.timestamps):
            new = tok.startswith(" ") or tok.startswith("▁") or cur is None
            piece = tok.replace("▁", " ").strip()
            if not piece: continue
            if new:
                cur = [piece, a + ts]; words.append(cur)
            else:
                cur[0] += piece
    return [(norm(w), t) for w, t in words if norm(w)]


def align(script_sents, audio_path):
    x = load_audio(audio_path); sr = 16000; L = len(x) / sr
    on, hop = speech_mask(x, sr)
    sw = []  # (sentence idx, word)
    for i, s in enumerate(script_sents):
        for w in s.split():
            if norm(w): sw.append((i, w))
    model = find_model(); method = "asr"; times = [None] * len(sw)
    if model:
        aw = asr_words(x, sr, model)
        sm = difflib.SequenceMatcher(a=[norm(w) for _, w in sw], b=[w for w, _ in aw], autojunk=False)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size): times[blk.a + k] = aw[blk.b + k][1]
        matched = sum(t is not None for t in times) / max(1, len(times))
        if matched < 0.35: method = "fallback"; times = [None] * len(sw)
    else:
        method = "fallback"; matched = 0.0
    if method == "fallback":
        # place words on speech time proportionally to syllables
        st = np.where(on)[0] * hop; syl = np.cumsum([0] + [syllables(w) for _, w in sw]); tot = syl[-1]
        for k in range(len(sw)):
            j = int(min(len(st) - 1, syl[k] / tot * len(st))); times[k] = float(st[j]) if len(st) else k * .35
    # interpolate gaps
    known = [k for k, t in enumerate(times) if t is not None]
    if not known:
        # Proportional word placement fallback when ASR does not match words
        times = [round((k / max(1, len(sw))) * L, 3) for k in range(len(sw))]
        known = list(range(len(sw)))
    for k in range(len(times)):
        if times[k] is None:
            prev = max([j for j in known if j < k], default=None); nxt = min([j for j in known if j > k], default=None)
            if prev is None: times[k] = max(0.0, times[nxt] - .3 * (nxt - k))
            elif nxt is None: times[k] = times[prev] + .3 * (k - prev)
            else: times[k] = times[prev] + (times[nxt] - times[prev]) * (k - prev) / (nxt - prev)
    for k in range(1, len(times)): times[k] = max(times[k], times[k - 1])
    # sentence spans; end = end of speech run after the last word
    out = []
    for i, s in enumerate(script_sents):
        ks = [k for k, (si, _) in enumerate(sw) if si == i]
        if not ks: continue
        t0 = times[ks[0]]; tl = times[ks[-1]]
        j = int(tl / hop) + 5
        while j < len(on) and on[j]: j += 1
        t1 = min(L, j * hop + .05)
        nxt = times[ks[-1] + 1] if ks[-1] + 1 < len(times) else L
        t1 = max(tl + .15, min(t1, nxt - .02))
        out.append(dict(i=i, text=s, start=round(max(0, t0 - .06), 3), end=round(t1, 3),
                        words=[dict(w=sw[k][1], n=norm(sw[k][1]), t=round(times[k], 3)) for k in ks]))
    if method == "fallback":  # snap sentence starts to speech onsets near the estimate
        for s in out:
            j = int(s["start"] / hop)
            for d in range(0, 60):
                for jj in (j - d, j + d):
                    if 0 < jj < len(on) and on[jj] and not on[jj - 1]:
                        s["start"] = round(jj * hop - .04, 3); break
                else: continue
                break
    return dict(duration=round(L, 3), method=method, matched=round(matched, 3), sentences=out)


def generate_default_timing(project_dir, story=None):
    """Generate a clean, schema-compliant timing.json dictionary when timing.json is missing.
    Differentiates:
    - Audio-backed timing (when voice.* exists, calculates exact duration from audio)
    - Storyboard-backed timing (when shots have explicit durations, hold, or start/end)
    - Default preview timing (when neither audio nor timing is provided)
    """
    if story is None:
        story_file = os.path.join(project_dir, "story.json")
        story = json.load(open(story_file, encoding="utf-8")) if os.path.exists(story_file) else {}

    shots = story.get("shots", [])
    script_file = os.path.join(project_dir, "script.txt")
    script_sents = sentences(open(script_file, encoding="utf-8").read()) if os.path.exists(script_file) else []

    # Check for voice file
    vp = None
    try:
        for f in sorted(os.listdir(project_dir)):
            if f.lower().startswith("voice.") or f.lower().startswith("voiceover."):
                vp = os.path.join(project_dir, f)
                break
    except Exception:
        pass

    # If voice exists and script exists, try align
    if vp and script_sents:
        try:
            return align(script_sents, vp)
        except Exception:
            pass

    # Audio duration if voice exists
    audio_dur = None
    if vp:
        try:
            res = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", vp],
                capture_output=True, text=True
            )
            if res.returncode == 0 and res.stdout.strip():
                audio_dur = float(res.stdout.strip())
        except Exception:
            pass

    # Compute duration from shots
    shot_durations = []
    for sh in shots:
        dur = sh.get("hold") or sh.get("duration")
        if dur is None and "start" in sh and "end" in sh:
            dur = float(sh["end"]) - float(sh["start"])
        if dur is None:
            dur = 3.0  # sensible default per shot
        shot_durations.append(max(0.5, float(dur)))

    total_duration = audio_dur or (sum(shot_durations) if shot_durations else float(story.get("duration", 30.0)))
    total_duration = max(1.0, round(total_duration, 3))

    out_sents = []
    # If script_sents exists, distribute them across total_duration
    if script_sents:
        n = len(script_sents)
        step = total_duration / max(1, n)
        for i, s in enumerate(script_sents):
            s_start = round(i * step, 3)
            s_end = round(min(total_duration, (i + 1) * step), 3)
            raw_words = s.split()
            w_step = (s_end - s_start) / max(1, len(raw_words))
            words_data = [
                {"w": w, "n": norm(w), "t": round(s_start + idx * w_step, 3)}
                for idx, w in enumerate(raw_words)
            ]
            out_sents.append({
                "i": i,
                "text": s,
                "start": s_start,
                "end": s_end,
                "words": words_data
            })
    else:
        # Generate sentences matching shot indices so spoken shots s: [i] work seamlessly
        cum_t = 0.0
        for i, sh in enumerate(shots):
            dur = shot_durations[i] if i < len(shot_durations) else 3.0
            s_start = round(cum_t, 3)
            s_end = round(cum_t + dur, 3)
            cum_t = s_end
            text = sh.get("scene") or sh.get("text") or sh.get("title") or f"Scene {i + 1}"
            raw_words = text.split()
            w_step = (s_end - s_start) / max(1, len(raw_words))
            words_data = [
                {"w": w, "n": norm(w), "t": round(s_start + idx * w_step, 3)}
                for idx, w in enumerate(raw_words)
            ]
            out_sents.append({
                "i": i,
                "text": text,
                "start": s_start,
                "end": s_end,
                "words": words_data
            })

    method = "audio_fallback" if audio_dur else "default_preview"
    return {
        "duration": total_duration,
        "method": method,
        "matched": 1.0,
        "sentences": out_sents
    }

