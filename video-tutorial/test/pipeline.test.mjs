import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

test('1. Thai Script Manifest has all 7 scenes covering all 5 features + intro/outro', () => {
  const scriptPath = path.join(ROOT, 'script_th.json')
  assert.ok(fs.existsSync(scriptPath), 'script_th.json must exist')
  const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'))

  assert.equal(script.width, 1920)
  assert.equal(script.height, 1080)
  assert.equal(script.fps, 30)
  assert.equal(script.scenes.length, 7, 'Must have 7 scenes')

  for (const scene of script.scenes) {
    assert.ok(scene.id, 'Scene must have id')
    assert.ok(scene.narration_th.length > 20, `Scene ${scene.id} must have Thai narration`)
    assert.ok(scene.subtitle_th.length > 20, `Scene ${scene.id} must have Thai subtitle`)
    const imgPath = path.join(ROOT, scene.screenshot)
    assert.ok(fs.existsSync(imgPath), `Screenshot ${scene.screenshot} must exist`)
  }
})

test('2. Audio Manifest & Scene Audio files exist with valid ffprobe durations', () => {
  const manifestPath = path.join(ROOT, 'assets', 'audio', 'manifest.json')
  assert.ok(fs.existsSync(manifestPath), 'assets/audio/manifest.json must exist')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  assert.equal(manifest.scenes.length, 7, 'Audio manifest must contain 7 scenes')
  assert.ok(manifest.totalDuration > 30, 'Total tutorial audio duration must be > 30s')

  for (const item of manifest.scenes) {
    const audioFile = path.join(ROOT, item.audioPath)
    assert.ok(fs.existsSync(audioFile), `Audio file ${item.audioPath} must exist`)
    const stat = fs.statSync(audioFile)
    assert.ok(stat.size > 1000, `Audio file ${item.audioPath} must be non-empty`)
    assert.ok(item.duration > 3, `Scene ${item.id} duration (${item.duration}s) must be > 3s`)
  }
})

test('3. HyperFrames HTML compositions exist and declare valid data-* attributes', () => {
  const indexHtmlPath = path.join(ROOT, 'index.html')
  assert.ok(fs.existsSync(indexHtmlPath), 'HyperFrames root index.html must exist')
  const html = fs.readFileSync(indexHtmlPath, 'utf8')

  assert.match(html, /data-composition="water-smart-bill-tutorial"/)
  assert.match(html, /data-width="1920"/)
  assert.match(html, /data-height="1080"/)
  assert.match(html, /data-fps="30"/)
  assert.match(html, /window\.__hf_seek/)

  for (let i = 1; i <= 7; i++) {
    const id = `scene_0${i}`
    const subComp = path.join(ROOT, 'compositions', `${id}.html`)
    assert.ok(fs.existsSync(subComp), `Sub-composition compositions/${id}.html must exist`)
  }
})

test('4. Rendered MP4 video exists with 1920x1080 H.264 video and AAC audio streams', () => {
  const mp4Path = path.join(ROOT, 'output', 'water_smart_bill_tutorial_th.mp4')
  assert.ok(fs.existsSync(mp4Path), 'Rendered MP4 file must exist')

  const probeJson = execFileSync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', mp4Path],
    { encoding: 'utf8' }
  )
  const info = JSON.parse(probeJson)
  const videoStream = info.streams.find((s) => s.codec_type === 'video')
  const audioStream = info.streams.find((s) => s.codec_type === 'audio')

  assert.ok(videoStream, 'MP4 must have a video stream')
  assert.ok(audioStream, 'MP4 must have an audio stream')
  assert.equal(videoStream.width, 1920)
  assert.equal(videoStream.height, 1080)
  assert.ok(Number(info.format.duration) > 30, 'Video duration must be > 30 seconds')
})
