import { describe, expect, it } from 'vitest'
import {
  extractMeterReadingFromHint,
  validateMeterImageFile,
} from './meterOcr'

describe('Hybrid Meter OCR Digit Extractor & Image Validation', () => {
  it('extracts meter digits from OCR string or filename hint and flags lower-than-previous warning', () => {
    const okRes = extractMeterReadingFromHint('meter_00148.jpg', 120)
    expect(okRes.reading).toBe(148)
    expect(okRes.digits).toBe('00148')
    expect(okRes.warning).toBeUndefined()

    const warnRes = extractMeterReadingFromHint('00095', 120)
    expect(warnRes.reading).toBe(95)
    expect(warnRes.warning).toContain('น้อยกว่าเลขครั้งก่อน')
  })

  it('validates uploaded meter image MIME types and file size (hunt-file-upload)', () => {
    const validJpg = new File(['dummy'], 'meter_00150.jpg', { type: 'image/jpeg' })
    expect(validateMeterImageFile(validJpg).valid).toBe(true)

    const validPng = new File(['dummy'], 'meter_00150.png', { type: 'image/png' })
    expect(validateMeterImageFile(validPng).valid).toBe(true)

    const invalidSvg = new File(['<svg><script>alert(1)</script></svg>'], 'evil.svg', {
      type: 'image/svg+xml',
    })
    const svgResult = validateMeterImageFile(invalidSvg)
    expect(svgResult.valid).toBe(false)
    expect(svgResult.error).toContain('รองรับเฉพาะไฟล์ภาพ')

    const tooLarge = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', {
      type: 'image/jpeg',
    })
    const sizeResult = validateMeterImageFile(tooLarge)
    expect(sizeResult.valid).toBe(false)
    expect(sizeResult.error).toContain('5 MB')
  })
})
