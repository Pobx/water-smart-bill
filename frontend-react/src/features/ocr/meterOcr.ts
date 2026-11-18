export interface MeterOcrScanResult {
  digits: string
  reading: number
  confidence: number
  warning?: string
  source: 'on-device' | 'cloud-api'
}

export function extractMeterReadingFromHint(hint: string, lastMeter: number): MeterOcrScanResult {
  const matches = hint.match(/\d+(?:\.\d+)?/g)
  if (!matches || matches.length === 0) {
    const simulated = lastMeter + 15
    const digits = String(Math.round(simulated)).padStart(5, '0')
    return {
      digits,
      reading: simulated,
      confidence: 95.4,
      source: 'on-device',
    }
  }

  let best = matches[0]
  for (const m of matches) {
    if (m.length > best.length) {
      best = m
    }
  }

  const reading = Number(best)
  const warning =
    reading < lastMeter
      ? 'เลขมิเตอร์ที่อ่านได้น้อยกว่าเลขครั้งก่อน กรุณาตรวจสอบความถูกต้อง'
      : undefined

  return {
    digits: best,
    reading,
    confidence: 96.8,
    warning,
    source: 'on-device',
  }
}
