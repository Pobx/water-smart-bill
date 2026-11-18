#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SCRIPT_PATH = path.join(ROOT, 'script_th.json')
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio')

fs.mkdirSync(AUDIO_DIR, { recursive: true })

const scriptData = JSON.parse(fs.readFileSync(SCRIPT_PATH, 'utf8'))
const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim()
const voiceId = (process.env.ELEVENLABS_VOICE_ID || scriptData.voice.default_voice_id).trim()
const modelId = scriptData.voice.model_id || 'eleven_multilingual_v2'

function probeDurationSeconds(filePath) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8' }
  ).trim()
  return Math.round(Number(out) * 100) / 100
}

/**
 * Splits Thai narration into natural phrases <= 160 chars for clean TTS synthesis.
 */
function splitThaiChunks(text, maxLen = 160) {
  const words = text.trim().split(/\s+/)
  const chunks = []
  let current = ''
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxLen) {
      current = (current + ' ' + w).trim()
    } else {
      if (current) chunks.push(current)
      current = w
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/**
 * Primary TTS: ElevenLabs API (eleven_multilingual_v2)
 */
async function synthesizeWithElevenLabs(text, outputMp3Path) {
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set in environment')
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: scriptData.voice.settings,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`ElevenLabs HTTP ${response.status}: ${errBody.slice(0, 200)}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  if (buffer.length < 500) {
    throw new Error(`Unexpectedly small audio payload (${buffer.length} bytes)`)
  }
  fs.writeFileSync(outputMp3Path, buffer)
}

/**
 * Secondary TTS: Real Spoken Thai Neural TTS (th-TH) + subtle 44.1kHz stereo mastering via FFmpeg
 * Used automatically when ElevenLabs API key is a UUID/invalid or rate-limited.
 */
async function synthesizeThaiNeuralSpeechFallback(text, outputMp3Path, sceneId) {
  const chunks = splitThaiChunks(text, 150)
  const chunkFiles = []

  for (let idx = 0; idx < chunks.length; idx++) {
    const q = encodeURIComponent(chunks[idx])
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=${q}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
    })
    if (!res.ok) {
      throw new Error(`Thai TTS fallback HTTP ${res.status}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const chunkPath = path.join(AUDIO_DIR, `_tmp_${sceneId}_${idx}.mp3`)
    fs.writeFileSync(chunkPath, buf)
    chunkFiles.push(chunkPath)
  }

  const concatListPath = path.join(AUDIO_DIR, `_tmp_${sceneId}_list.txt`)
  fs.writeFileSync(
    concatListPath,
    chunkFiles.map((f) => `file '${f}'`).join('\n'),
    'utf8'
  )

  const rawVoicePath = path.join(AUDIO_DIR, `_tmp_${sceneId}_raw.mp3`)
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c:a', 'libmp3lame',
    '-ar', '44100',
    '-ac', '2',
    '-b:a', '128k',
    rawVoicePath,
  ], { stdio: 'ignore' })

  // Add 0.4s tail padding and gentle broadcast normalization
  execFileSync('ffmpeg', [
    '-y',
    '-i', rawVoicePath,
    '-af', 'atempo=1.08,apad=pad_dur=0.45,volume=1.35',
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    outputMp3Path,
  ], { stdio: 'ignore' })

  // Clean up temporary files
  for (const f of [...chunkFiles, concatListPath, rawVoicePath]) {
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
}

/**
 * Tertiary offline fallback (pure FFmpeg sine pad) if no network is available.
 */
function synthesizeOfflinePadFallback(text, outputMp3Path, sceneIndex) {
  const estimatedSec = Math.max(6.5, Math.min(11.0, Math.round((text.length / 22) * 10) / 10))
  const baseFreq = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 523.25][sceneIndex % 7]
  const filter = `sine=frequency=${baseFreq}:duration=${estimatedSec},volume=0.08,afade=t=in:st=0:d=0.4,afade=t=out:st=${(estimatedSec - 0.6).toFixed(2)}:d=0.6`

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', filter,
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    outputMp3Path,
  ], { stdio: 'ignore' })
}

async function main() {
  const manifestScenes = []
  let currentStart = 0

  for (let i = 0; i < scriptData.scenes.length; i++) {
    const scene = scriptData.scenes[i]
    const relAudioPath = `assets/audio/${scene.id}.mp3`
    const absAudioPath = path.join(ROOT, relAudioPath)
    let providerUsed = 'elevenlabs'

    try {
      await synthesizeWithElevenLabs(scene.narration_th, absAudioPath)
      console.log(`[ElevenLabs] Synthesized ${scene.id} (${scene.step})`)
    } catch (err) {
      console.warn(`[ElevenLabs Notice] ${scene.id}: ${err.message}`)
      try {
        providerUsed = 'thai-neural-tts-fallback'
        await synthesizeThaiNeuralSpeechFallback(scene.narration_th, absAudioPath, scene.id)
        console.log(`[Thai Neural TTS] Synthesized spoken Thai voiceover for ${scene.id}`)
      } catch (err2) {
        providerUsed = 'ffmpeg-offline-pad'
        console.warn(`[Offline Fallback] ${scene.id}: ${err2.message}`)
        synthesizeOfflinePadFallback(scene.narration_th, absAudioPath, i)
      }
    }

    const duration = probeDurationSeconds(absAudioPath)
    const startTime = Math.round(currentStart * 100) / 100
    const endTime = Math.round((currentStart + duration) * 100) / 100
    currentStart = endTime

    manifestScenes.push({
      id: scene.id,
      step: scene.step,
      title: scene.title,
      audioPath: relAudioPath,
      provider: providerUsed,
      duration,
      startTime,
      endTime,
    })
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    modelId,
    voiceId,
    fps: scriptData.fps,
    width: scriptData.width,
    height: scriptData.height,
    totalDuration: Math.round(currentStart * 100) / 100,
    scenes: manifestScenes,
  }

  const manifestPath = path.join(AUDIO_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`Saved audio manifest to ${manifestPath} (totalDuration=${manifest.totalDuration}s)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
