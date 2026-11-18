# Implementation Plan: HyperFrames + ElevenLabs Thai Tutorial Video

**Date:** 2026-11-18  
**Branch:** `feat/hyperframes-elevenlabs-video-tutorial`  
**Design Doc:** `hyperframes_elevenlabs_tutorial_plan.md`  
**ADR:** `docs/adr/0007-hyperframes-and-elevenlabs-thai-video-tutorial.md`

---

## Bite-Sized Tasks (2–5 Minutes Each)

### Task 1: Copy Real Feature Screenshots & Bundle Thai Fonts into `video-tutorial/assets/`
- Copy `screenshot_01_master_data.png` through `screenshot_05_liff_portal.png` into `video-tutorial/assets/screenshots/`.
- Copy bundled Thai WOFF2 fonts (`@fontsource/kanit` & `@fontsource/sarabun`) into `video-tutorial/assets/fonts/` so headless Chromium renders crisp Thai typography in every video frame.

### Task 2: Write TDD Test & Script Manifest (`video-tutorial/script_th.json` & `video-tutorial/test/pipeline.test.mjs`)
- **RED:** Write automated Node test (`node --test video-tutorial/test/pipeline.test.mjs`) verifying:
  1. `script_th.json` has all 7 scenes covering Intro/Security, all 5 features, and Outro.
  2. `manifest.json` contains valid audio files and durations measured by `ffprobe`.
  3. HyperFrames `index.html` contains valid `data-composition`, `data-width="1920"`, `data-height="1080"`, `data-fps="30"`, and scene mounts matching total duration.
  4. Final rendered MP4 (`video-tutorial/output/water_smart_bill_tutorial_th.mp4`) exists, has video stream `1920x1080` H.264, audio stream AAC, and duration matching the manifest.

### Task 3: Implement ElevenLabs TTS Generator (`video-tutorial/scripts/generate_tts.mjs`)
- Read `process.env.ELEVENLABS_API_KEY` (never hardcoded).
- Call ElevenLabs API (`eleven_multilingual_v2`) for each of the 7 Thai narration segments, with intelligent fallback if outbound proxy blocks or rate-limits a host, and measure exact duration via `ffprobe`.
- Output `video-tutorial/assets/audio/scene_01.mp3` .. `scene_07.mp3` and `video-tutorial/assets/audio/manifest.json`.

### Task 4: Implement HyperFrames HTML Composition & Deterministic Frame Renderer (`video-tutorial/index.html` & `video-tutorial/scripts/render_hyperframes.mjs`)
- Build `video-tutorial/index.html` following HyperFrames HTML composition specification (`data-composition`, `window.__hf_seek(timeSec)` deterministic frame clock, animated spotlight highlights, step callouts, progress bar, and Thai subtitle bar).
- Render deterministic frames via Headless Chromium (`/usr/bin/chromium`) and encode with `ffmpeg` + scene audio tracks into `video-tutorial/output/water_smart_bill_tutorial_th.mp4`.

### Task 5: Verify All Tests Pass, Copy Video & Preview Frames to Artifacts, and Merge to `main`
- Run `node --test video-tutorial/test/pipeline.test.mjs`, `go test -C backend-go ./...`, and `npm --prefix frontend-react test -- --run`.
- Copy `water_smart_bill_tutorial_th.mp4` and preview snapshots to the conversation artifact directory and present them to the user.
- Commit, push `feat/hyperframes-elevenlabs-video-tutorial`, merge into `main`, and push `main` to `origin`.
