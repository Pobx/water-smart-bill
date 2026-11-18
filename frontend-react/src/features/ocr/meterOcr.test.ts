import { describe, expect, it } from 'vitest'
import { extractMeterReadingFromHint } from './meterOcr'

describe('Hybrid Meter OCR Digit Extractor', () => {
  it('extracts meter digits from OCR string or filename hint and flags lower-than-previous warning', () => {
    const okRes = extractMeterReadingFromHint('meter_00148.jpg', 120)
    expect(okRes.reading).toBe(148)
    expect(okRes.digits).toBe('00148')
    expect(okRes.warning).toBeUndefined()

    const warnRes = extractMeterReadingFromHint('00095', 120)
    expect(warnRes.reading).toBe(95)
    expect(warnRes.warning).toContain('น้อยกว่าเลขครั้งก่อน')
  })
})
