#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SCRIPT_PATH = path.join(ROOT, 'script_th.json')
const MANIFEST_PATH = path.join(ROOT, 'assets', 'audio', 'manifest.json')
const COMP_DIR = path.join(ROOT, 'compositions')
const SNAPSHOT_DIR = path.join(ROOT, 'output', 'snapshots')
const OUTPUT_DIR = path.join(ROOT, 'output')

fs.mkdirSync(COMP_DIR, { recursive: true })
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const scriptData = JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf8'))
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

const scenesMerged = scriptData.scenes.map((s) => {
  const m = manifest.scenes.find((item) => item.id === s.id)
  return {
    ...s,
    duration: m ? m.duration : 10,
    startTime: m ? m.startTime : 0,
    endTime: m ? m.endTime : 10,
    audioPath: m ? m.audioPath : `assets/audio/${s.id}.mp3`,
  }
})

// 1. Generate sub-compositions in compositions/scene_01..07.html
for (const scene of scenesMerged) {
  const subHtml = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>${scene.id} — ${scene.title}</title>
</head>
<body>
  <div
    id="${scene.id}"
    data-composition="${scene.id}"
    data-width="1920"
    data-height="1080"
    data-fps="30"
    data-start="${scene.startTime}"
    data-duration="${scene.duration}"
    data-audio="../${scene.audioPath}"
  >
    <h1>${scene.title}</h1>
    <p>${scene.subtitle_th}</p>
  </div>
</body>
</html>
`
  fs.writeFileSync(path.join(COMP_DIR, `${scene.id}.html`), subHtml, 'utf8')
}

// 2. Generate root HyperFrames composition in video-tutorial/index.html
const indexHtml = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>${scriptData.title}</title>
  <style>
    @font-face {
      font-family: 'KanitLocal';
      src: url('/assets/fonts/kanit-thai-400-normal.woff2') format('woff2'),
           url('/assets/fonts/kanit-latin-400-normal.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'KanitLocal';
      src: url('/assets/fonts/kanit-thai-600-normal.woff2') format('woff2'),
           url('/assets/fonts/kanit-latin-600-normal.woff2') format('woff2');
      font-weight: 600;
      font-style: normal;
    }
    @font-face {
      font-family: 'KanitLocal';
      src: url('/assets/fonts/kanit-thai-700-normal.woff2') format('woff2'),
           url('/assets/fonts/kanit-latin-700-normal.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
    }
    @font-face {
      font-family: 'SarabunLocal';
      src: url('/assets/fonts/sarabun-thai-400-normal.woff2') format('woff2'),
           url('/assets/fonts/sarabun-latin-400-normal.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'SarabunLocal';
      src: url('/assets/fonts/sarabun-thai-700-normal.woff2') format('woff2'),
           url('/assets/fonts/sarabun-latin-700-normal.woff2') format('woff2');
      font-weight: 700;
      font-style: normal;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: #070d19;
      font-family: 'KanitLocal', 'SarabunLocal', sans-serif;
      color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }

    #stage {
      position: relative;
      width: 1920px;
      height: 1080px;
      background:
        radial-gradient(circle at 12% 15%, rgba(14, 165, 233, 0.22), transparent 42%),
        radial-gradient(circle at 88% 82%, rgba(16, 185, 129, 0.18), transparent 45%),
        linear-gradient(135deg, #070d19 0%, #0f172a 55%, #091526 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 28px 48px 26px 48px;
    }

    /* Top Broadcast Header */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 82px;
      padding: 0 28px;
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(56, 189, 248, 0.28);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    }

    .brand-left {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .logo-badge {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, #0284c7, #10b981);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      box-shadow: 0 4px 16px rgba(14, 165, 233, 0.45);
    }

    .step-pill {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.2);
      border: 1px solid rgba(56, 189, 248, 0.5);
      color: #38bdf8;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.6px;
      margin-bottom: 3px;
    }

    .scene-title {
      font-size: 27px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }

    .feature-tag {
      padding: 10px 20px;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.14);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-size: 17px;
      font-weight: 600;
    }

    /* Main Viewport Container */
    .viewport-wrap {
      position: relative;
      width: 1824px;
      height: 780px;
      margin: 0 auto;
      border-radius: 22px;
      overflow: hidden;
      background: #f8fafc;
      border: 2px solid rgba(148, 163, 184, 0.25);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    }

    .screenshot-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      transform-origin: center top;
      transition: transform 0.35s ease;
    }

    /* Dynamic Callout Highlight Box */
    .highlight-box {
      position: absolute;
      border: 4px solid #0ea5e9;
      border-radius: 18px;
      background: rgba(14, 165, 233, 0.08);
      box-shadow:
        0 0 0 4px rgba(14, 165, 233, 0.28),
        0 16px 40px rgba(2, 132, 199, 0.35);
      pointer-events: none;
    }

    .highlight-label {
      position: absolute;
      top: -44px;
      left: 0;
      background: linear-gradient(90deg, #0284c7, #0d9488);
      color: #ffffff;
      padding: 6px 18px;
      border-radius: 10px;
      font-size: 18px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }

    /* Bottom Subtitle & Timeline Bar */
    .bottom-bar {
      height: 122px;
      border-radius: 20px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.24);
      padding: 16px 32px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }

    .subtitle-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .voice-wave {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 14px;
      border-radius: 12px;
      background: rgba(14, 165, 233, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #38bdf8;
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
    }

    .subtitle-text {
      font-size: 24px;
      font-weight: 600;
      color: #f8fafc;
      line-height: 1.35;
    }

    .progress-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .progress-track {
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: rgba(51, 65, 85, 0.8);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #38bdf8, #10b981);
      width: 0%;
    }

    .time-badge {
      font-size: 15px;
      font-weight: 600;
      color: #94a3b8;
      min-width: 145px;
      text-align: right;
    }
  </style>
</head>
<body>
  <div
    id="stage"
    data-composition="water-smart-bill-tutorial"
    data-width="1920"
    data-height="1080"
    data-fps="30"
    data-duration="${manifest.totalDuration}"
  >
    <!-- Top Header -->
    <div class="top-bar">
      <div class="brand-left">
        <div class="logo-badge">💧</div>
        <div>
          <span id="ui-step" class="step-pill">INTRO</span>
          <div id="ui-title" class="scene-title">Water Smart Bill</div>
        </div>
      </div>
      <div id="ui-tag" class="feature-tag">SAO Smart Water Platform</div>
    </div>

    <!-- Center Screenshot & Animated Highlight -->
    <div class="viewport-wrap">
      <img id="ui-screenshot" class="screenshot-img" src="/assets/screenshots/screenshot_01_master_data.png" alt="Screen" />
      <div id="ui-highlight" class="highlight-box" style="display:none;">
        <div id="ui-highlight-label" class="highlight-label">Highlight</div>
      </div>
    </div>

    <!-- Bottom Subtitle & Progress -->
    <div class="bottom-bar">
      <div class="subtitle-row">
        <div class="voice-wave">🔊 พากย์ไทย (TH)</div>
        <div id="ui-subtitle" class="subtitle-text">กำลังโหลดคำบรรยาย...</div>
      </div>
      <div class="progress-row">
        <div class="progress-track">
          <div id="ui-progress" class="progress-fill"></div>
        </div>
        <div id="ui-time" class="time-badge">00:00 / 02:33</div>
      </div>
    </div>
  </div>

  <script>
    const SCENES = ${JSON.stringify(scenesMerged, null, 2)};
    const TOTAL_DURATION = ${manifest.totalDuration};

    function formatMMSS(sec) {
      const s = Math.max(0, Math.floor(sec));
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      return mm + ':' + ss;
    }

    // Deterministic HyperFrames seek clock
    window.__hf_seek = function(timeSec) {
      const clamped = Math.max(0, Math.min(TOTAL_DURATION, Number(timeSec) || 0));
      let activeScene = SCENES[0];
      for (const sc of SCENES) {
        if (clamped >= sc.startTime && clamped <= sc.endTime + 0.05) {
          activeScene = sc;
          break;
        }
      }

      const localTime = Math.max(0, clamped - activeScene.startTime);
      const localProgress = Math.min(1, localTime / Math.max(0.1, activeScene.duration));

      document.getElementById('ui-step').textContent = activeScene.step;
      document.getElementById('ui-title').textContent = activeScene.title;
      document.getElementById('ui-tag').textContent = activeScene.featureTag;
      document.getElementById('ui-screenshot').src = '/' + activeScene.screenshot;
      document.getElementById('ui-subtitle').textContent = activeScene.subtitle_th;

      // Subtle zoom effect during scene
      const scale = 1.0 + (Math.sin(localProgress * Math.PI) * 0.015);
      document.getElementById('ui-screenshot').style.transform = 'scale(' + scale.toFixed(4) + ')';

      // Highlight switching (Highlight 1 in first half, Highlight 2 in second half)
      const hlEl = document.getElementById('ui-highlight');
      const hlLabel = document.getElementById('ui-highlight-label');
      if (activeScene.highlights && activeScene.highlights.length > 0) {
        const hlIndex = (activeScene.highlights.length > 1 && localProgress >= 0.5) ? 1 : 0;
        const hl = activeScene.highlights[hlIndex];
        hlEl.style.display = 'block';
        hlEl.style.left = hl.x + 'px';
        hlEl.style.top = hl.y + 'px';
        hlEl.style.width = hl.w + 'px';
        hlEl.style.height = hl.h + 'px';
        hlLabel.textContent = '✨ ' + hl.label;
      } else {
        hlEl.style.display = 'none';
      }

      const overallPct = Math.min(100, (clamped / TOTAL_DURATION) * 100);
      document.getElementById('ui-progress').style.width = overallPct.toFixed(2) + '%';
      document.getElementById('ui-time').textContent = formatMMSS(clamped) + ' / ' + formatMMSS(TOTAL_DURATION);
    };

    // Check URL ?t= parameter on load for deterministic headless frame capture
    const params = new URLSearchParams(window.location.search);
    const initialT = parseFloat(params.get('t') || '0');
    window.__hf_seek(initialT);
  </script>
</body>
</html>
`

fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml, 'utf8')
console.log('Generated HyperFrames index.html and 7 scene compositions.')

// 3. Start a local static HTTP server to serve video-tutorial/ for Headless Chromium frame capture
function startStaticServer(rootDir, port = 18923) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.json': 'application/json',
  }
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`)
    let pathname = decodeURIComponent(parsedUrl.pathname)
    if (pathname === '/') pathname = '/index.html'
    const filePath = path.join(rootDir, pathname)
    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

function captureFramePng(url, outPngPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/chromium', [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--screenshot=${outPngPath}`,
      '--window-size=1920,1080',
      url,
    ], { stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outPngPath)) {
        resolve()
      } else {
        reject(new Error(`Chromium exited with code ${code} for ${url}`))
      }
    })
  })
}

async function renderVideo() {
  const port = 18923
  const server = await startStaticServer(ROOT, port)
  console.log(`Static HyperFrames server listening on http://127.0.0.1:${port}`)

  const segmentMp4Paths = []

  try {
    for (let i = 0; i < scenesMerged.length; i++) {
      const sc = scenesMerged[i]
      // Capture 2 deterministic keyframe states per scene (First half highlight + Second half highlight)
      const t1 = (sc.startTime + sc.duration * 0.25).toFixed(2)
      const t2 = (sc.startTime + sc.duration * 0.75).toFixed(2)

      const snap1 = path.join(SNAPSHOT_DIR, `${sc.id}_part1.png`)
      const snap2 = path.join(SNAPSHOT_DIR, `${sc.id}_part2.png`)

      console.log(`Capturing HyperFrames snapshots for ${sc.id} at t=${t1}s and t=${t2}s...`)
      await captureFramePng(`http://127.0.0.1:${port}/index.html?t=${t1}`, snap1)
      await captureFramePng(`http://127.0.0.1:${port}/index.html?t=${t2}`, snap2)

      // Also save primary scene snapshot for documentation preview
      fs.copyFileSync(snap1, path.join(SNAPSHOT_DIR, `${sc.id}.png`))

      const halfDur = (sc.duration / 2).toFixed(3)
      const segMp4 = path.join(SNAPSHOT_DIR, `${sc.id}.mp4`)
      const absAudio = path.join(ROOT, sc.audioPath)

      // Encode 1920x1080 @ 30fps segment with smooth crossfade between highlight 1 and highlight 2 + Thai narration audio
      execFileSync('ffmpeg', [
        '-y',
        '-loop', '1', '-t', halfDur, '-r', '30', '-i', snap1,
        '-loop', '1', '-t', halfDur, '-r', '30', '-i', snap2,
        '-i', absAudio,
        '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]',
        '-map', '[v]',
        '-map', '2:a',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-shortest',
        segMp4,
      ], { stdio: 'ignore' })

      segmentMp4Paths.push(segMp4)
      console.log(`Encoded segment ${sc.id}.mp4 (${sc.duration}s)`)
    }

    // Concatenate all 7 scene MP4s into the master tutorial MP4
    const concatListFile = path.join(SNAPSHOT_DIR, 'segments_list.txt')
    fs.writeFileSync(
      concatListFile,
      segmentMp4Paths.map((p) => `file '${p}'`).join('\n'),
      'utf8'
    )

    const finalMp4 = path.join(OUTPUT_DIR, 'water_smart_bill_tutorial_th.mp4')
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListFile,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      finalMp4,
    ], { stdio: 'ignore' })

    console.log(`Successfully rendered master video: ${finalMp4}`)
  } finally {
    server.close()
  }
}

renderVideo().catch((err) => {
  console.error(err)
  process.exit(1)
})
