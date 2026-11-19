---
name: 2d-long-form
description: "Make long-form 2D animated YouTube videos (3, 5, 10 or 15 min) for faceless channels in a flat ink-on-paper cartoon style, for four markets: English, Vietnamese, French or German. It asks which market first, pitches 10 video ideas, asks for the length, writes the script in that market's language, then turns the user's uploaded voiceover (in that language) into a finished 1080p MP4 with original characters, motion, music and SFX, all drawn in code. Use it for any animated explainer, story video, money, business, psychology, history or life-lesson video, or a 'faceless channel video' request, even when the user only gives a topic or attaches a voiceover in any of those languages. Always talks to the user in Vietnamese."
---

# 2D Long Form

Turns a topic into a finished, fully animated 16:9 video in five steps: **market → ideas → length → script → voiceover → MP4**. The look: flat cel-shaded round-head puppets with one thick ink outline, moody night lighting or bright day sets, a camera that never stops moving, hand-lettered pop-in labels, rubber stamps, documents sliding across a desk, charts, counters, maps, split screens and a polaroid ending. The user's own voice (or their ElevenLabs voice) drives the timing, and an original music bed and sound effects are mixed under it. Everything is drawn with code (skia-python + ffmpeg): no paid tools and no stock footage.

You don't write drawing code. You write a **`story.json` storyboard** (shot kinds plus fields), and the engine in `engine/` aligns it to the voiceover word by word and renders it.

## Hard rules

- **Always talk to the user in Vietnamese** (every reply, question, idea list, progress update, recording tip and delivery note), whatever the market language is. Address the user as "anh" and yourself as "em".
- **Market language decides the content, not the conversation.** The spoken script, titles, thumbnail text, on-screen labels, chapter cards and the speech model all follow the chosen market (en, vi, fr or de). The conversation stays in Vietnamese.
- **Original characters only.** Copy the *style*, never another channel's characters, logos, thumbnails, series names or videos shot for shot. Real people are generic puppets with a name tag, never a likeness. No brand mascots.
- **Facts:** check the key facts of anything presented as true with a web search before pitching or scripting it. Tell the user which facts were not checked. Never invent statistics for charts or counters.
- **Never edit the voice.** The picture follows the voiceover. Silent chapter cards shift it later in time; they never cut it.
- **Look before the long render.** Render contact sheets of every shot, look at them, fix problems, then do one full render.
- You can't hear audio or watch playback. Verify through alignment numbers, frame checks and loudness readings, and tell the user to watch once for timing.
- Keep the user informed with a task list. The 10-15 min renders take a while, so give progress updates.

## Stage 0: Pick the market (always first)

Before anything else, even when the user already attached a script or a voiceover, ask with **AskUserQuestion** (plain text if that tool is missing): **"Anh muốn làm video cho thị trường nào?"** with exactly four options:

| option | code | script, labels, voice | speech model (setup) |
|---|---|---|---|
| **Tiếng Anh (English)** | `en` | English | Parakeet TDT v2 |
| **Tiếng Việt** | `vi` | Vietnamese | Zipformer Vietnamese |
| **Tiếng Pháp (Français)** | `fr` | French | Parakeet TDT v3 |
| **Tiếng Đức (Deutsch)** | `de` | German | Parakeet TDT v3 |

- If an attached voiceover or script is clearly in another of these languages than the one picked, say so in one line and ask which is right.
- Remember the code: write it to `<P>/lang.txt` as soon as the project folder exists (or pass `--lang <code>` once to any engine command). Every engine command reads it: the speech model, the word-rate estimate and the fonts follow it (Vietnamese uses fonts with full Vietnamese accents).
- If the user later sends a voiceover in a different language, ask whether to switch the market before aligning.

## Stage 1: 10 video ideas (start here unless the user already has a script or voiceover)

- If the user attached a voiceover **and** gave the script text, go straight to Stage 4. With a script but no voiceover, go to Stage 3's delivery step. With a voiceover but no script, ask for the script text (the timing needs it).
- Otherwise read `references/ideas-and-scripts.md` and reply with **exactly 10 numbered ideas** for faceless creators who want views, watch time and monetization **in the chosen market**. Each idea gets: title, thumbnail text, hook line, payoff, why it performs (niche and series potential), best length, and fact status. If the user named a niche or topic, tailor all 10 to it; otherwise mix niches. Verify facts for true-story ideas first.
- Ask them to reply with a number, "thêm ý tưởng", or their own topic.

## Stage 2: Pick the length

As soon as they pick an idea, ask with **AskUserQuestion** (plain text if that tool is missing): **"Video dài bao nhiêu?"** with exactly four options: **3 phút**, **5 phút**, **10 phút**, **15 phút**. Put the idea's best length first, marked "(Khuyên dùng)". If the story can't fill the chosen length honestly, say so in one line and suggest the shorter one, but follow their choice.

## Stage 3: Script

Write it in the market language following `references/ideas-and-scripts.md`: the word count for that language and length (English and French about 150 words per minute, German about 130, Vietnamese about 170 spoken words/syllables per minute), the structure for that length, short spoken sentences, re-hooks every 60-90 s, and numbers written as words in that language.

1. Make a project folder: `~/2d-long-form/<slug>/` (or a folder in the user's working directory when running locally). Write the market code to `lang.txt`. Save the script as `script.txt` (UTF-8), one paragraph per line, with chapter-card titles on their own lines starting with `# `.
2. Run `python3 -m engine sentences <P>` (see Setup for how to run it) to confirm the word count and estimated length for that language. Adjust until you're within ±5 % of the target.
3. Reply (in Vietnamese) with:
   - the **spoken script** in one copyable block, without the `#` chapter lines (that's exactly what they record), in the market language;
   - word count, estimated length, and the chapter card titles;
   - a 3-5 line visual plan (main characters, key scenes, the ending);
   - facts you verified and any you couldn't;
   - recording tips (from the reference file): one voice, no music, read it exactly, mp3/wav/m4a, ElevenLabs settings, a native voice for the market language;
   - the ask: **"Khi nào có file giọng đọc [ngôn ngữ thị trường] thì anh gửi lên, em làm video hoàn chỉnh."**

If they record a changed version, ask for the final text and update `script.txt`.

## Stage 4: Build the video (after the voiceover arrives)

Work through to the end without stopping. Ask only if something can't be resolved (for example, the voiceover doesn't match the script at all, or it is in another language than the market).

### 4.0 Setup (once per session, per market language)
- Find the skill folder: `find / -name SKILL.md -path "*2d-long-form*" 2>/dev/null` (locally, it's the folder this file is in). Call it `<skill>`; treat it as read-only.
- Run `bash <skill>/scripts/setup.sh <lang>` (`en`, `vi`, `fr` or `de`). It installs skia-python, numpy, scipy, soundfile and sherpa-onnx, and downloads that language's offline speech model to `~/models` from GitHub releases (English ~460 MB, French/German ~470 MB, Vietnamese ~70 MB). Hugging Face is often blocked in sandboxes; GitHub works. If the model download fails, the engine falls back to pause detection: say so, because cue timing gets looser.
- Run every command from the skill folder: `cd <skill> && python3 -m engine <command> <P>`. All output goes into the project folder `<P>`.

### 4.1 Voiceover → timing
- Copy the upload to `<P>/voice.<ext>` (mp3, wav or m4a). For several parts, run `python3 -m engine join <P> part1.mp3 part2.mp3 ...`, which writes `voice.wav`.
- Run `python3 -m engine align <P>`. It reports `[lang] ... method=asr matched=NN%`. 85 % or more is normal (Vietnamese often reads 75-90 % because of name spellings); below 70 % usually means the recording differs from `script.txt` (ad-libs, a different draft) or the wrong market language, so check `lang.txt` and ask for the final text. Very short sentences get flagged; that's fine.

### 4.2 Storyboard (`<P>/story.json`)
Read `references/story-format.md` fully, and look at `examples/marshmallow/story.json` (a tested 2:20 video using every shot kind). Then run `python3 -m engine sentences <P>` and write `story.json`:
- `cast`: 2-4 original characters with distinct silhouettes and colours.
- `shots`: cover every sentence number once, in order, about one shot per 3-8 s (3 min ≈ 35 shots, 15 min ≈ 170). Follow the pacing rules at the end of the reference: rotate world shots and graphics, put every number on screen, a closeup after big claims, tags and lower thirds, chapter cards, and a polaroid ending.
- **Every on-screen text is in the market language** (labels, tags, lower thirds, documents, stamps, chapter cards, counters' units, polaroid caption). Keep labels to 1-4 words; German and French words run long, so shorten or use `max_w`.
- Cue mid-shot events with **words from that shot's sentences** (`"at": "fortune"`), written exactly as in the script (accents are fine).
- `mood` to match the topic.
- For 10-15 min videos, write the shots in chunks (for example, one chapter at a time) and run `plan` after each chunk.

### 4.3 Plan check
Run `python3 -m engine plan <P>`. It prints the shot table (times, length, whips) and warnings: uncovered sentences, cue words not found, shots shorter than 6 frames. Fix every warning. Split shots longer than about 10 s, and merge fragments shorter than 1.5 s into a neighbour.

### 4.4 Look check (before the long render)
- Run `python3 -m engine stills <P>`. It writes contact sheets of every shot's mid-frame to `<P>/work/sheet_N.jpg` (24 per sheet). For a closer look: `--shots 3,8,12 --fracs .2,.6,.95`.
- Open and look at every sheet. Common fixes: labels covering a face (move `x`/`y`), text too long (shorten it to 1-4 words), missing or broken accents (check `lang.txt`), characters off frame in wides (`x` between 250 and 1670), the same kind twice in a row (swap one), an empty-looking graphic (add `labels` or a second icon).
- Send the sheet(s) to the user with a one-line summary, then start the render without waiting.

### 4.5 Render
- Run `python3 -m engine render <P>` **in the background** (`run_in_background`, or `nohup ... > <P>/work/render.log 2>&1 &`) and check progress every few minutes. It prints `[done/total] ... ETA`. It uses all CPU cores but one, renders shots in parallel, and **resumes** after an interruption (finished shots are cached, so re-run the same command). If you change one shot, only that shot re-renders.
- **Speed (measured, 8 cores):** 1080p takes about 3-4 minutes of rendering per minute of video, and `--res 720` about 2. Render time scales with cores: on 2 cores, expect about 3-4x that. Before starting, check `nproc` and estimate. If a 1080p render would take more than about 60-90 minutes (for example a 10-15 min video on a 2-4 core sandbox), tell the user the estimate and offer `--res 720` (1280x720: same look, half the time, fine for YouTube), and let them choose. Pass the same `--res` to `render`, `audio`, `final` and `all`. A 720p file gets a `_720p` suffix.
- To fix a few shots after the full render: edit `story.json`, run `render <P> --shots 12,13`, which also re-joins the video.

### 4.6 Sound + final
- `python3 -m engine audio <P>` builds the music bed (original, synthesized from the `mood`, with an arrangement that changes every 8 bars), adds SFX from the shot events (pops on labels, thuds on stamps, whooshes on whips, paper on documents, ticks on counters, footsteps on walks, a boom under chapter cards, a shutter and sting on the polaroid), ducks the music under speech, and masters to about -14 to -15 LUFS. The voice is untouched. It prints the levels: music should read about -18 to -21 dB against the voice during speech (it rises in pauses). Use `--music-db -20` for a quieter bed or `--mood calm` to change the style.
- `python3 -m engine final <P>` muxes `<P>/out/<title>.mp4`.
- Or run everything after the storyboard is written: `python3 -m engine all <P>`.

### 4.7 Verify and deliver
- `ffprobe` the MP4: 1920x1080, 30 fps, with a duration matching the voiceover plus chapter cards plus about 1 s.
- Pull 6-8 frames at cue moments (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 f.jpg`) and look at them: is the label up, did the stamp land, is the mouth moving on dialogue, are the accents drawn correctly.
- Deliver the MP4 (SendUserFile, or the file path) with, in Vietnamese: the market, the length, a few lines on the shots, the facts that weren't checked, and an offer of tweaks ("đổi shot nào thì anh báo số") or the next idea from the list. Remind them to watch once for timing.

## Engine map (for edits beyond story.json)

- `engine/kit.py`: colours, easing, ink shapes, lighting (`night()` multiply darkness with punched light pools), grade and quarter-res bloom, and the puppet `draw_char()` (outfits, hair, hats, expressions, arm poses, walk cycle). Fonts ship in `fonts/` (OFL/Apache) and are picked by market language (`RM_LANG`): Caveat Brush, Kalam and Permanent Marker for en/fr/de; Patrick Hand, Mali and Sedgwick Ave Display for vi.
- `engine/sets.py`: office, home, street, skyline, board, table, void, black and map sets, each with night, dusk and day versions.
- `engine/props.py`: table documents and icons. Add a new icon as `ic_name(c, t, o)` drawn about 300 px wide around (0,0), and register it in `ICONS`.
- `engine/fx.py`: pop labels, stamps, tags, lower thirds, typed cards, bubbles and badges.
- `engine/shots.py`: shot kinds (`KINDS`). A new kind subclasses `Shot`, draws in `world()` (lit), `over()` (unlit overlay) and `screen()` (after the grade).
- `engine/timing.py`: sentence splitting, ASR word timestamps aligned to the script (accent-insensitive matching; model chosen by `RM_LANG`), and the pause-based fallback. `engine/timeline.py`: shot times, cues and silent-card gaps.
- `engine/render.py`: camera, whips, shake, polaroid, parallel segment render, contact sheets. `engine/audio.py`: music, SFX, mix and loudness.
- **Performance rule:** CPU skia is very slow at full-frame gradients, blend modes, colour filters, blur filters and rotated image draws (hundreds of ms per frame). Anything static goes into the per-shot caches built in `Shot.prepare()` (background, light map, glow map). Full-frame effects run in numpy (`finish`, `multiply_into`, `add_into`, `hblur` in `kit.py`). Per-frame drawing should be vector shapes and axis-aligned image blits only. Frame buffers are premultiplied native-format numpy arrays (`np_surface`); other formats trigger a slow conversion.

Style bible (keep it when extending): one uniform near-black ink line (#18161B, 6 px at 1080p) on everything; flat fills with one hard shadow; poses snap with overshoot; every shot slowly pushes in; navy night with warm lamp pools, or a soft cream-paper day; lime and cream hand-lettering with a thick ink stroke; red marker rings and stamps; black chapter cards typed in white handwriting.

---
*2D Long Form. Third-party credits: `CREDITS.md`.*
