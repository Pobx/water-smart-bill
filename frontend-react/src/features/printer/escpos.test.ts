import { describe, expect, it } from 'vitest'
import { buildEscPosReceiptBytes, formatThermalReceiptText } from './escpos'

describe('Bluetooth ESC/POS Thermal Receipt Builder', () => {
  const sampleBill = {
    orgName: 'องค์การบริหารส่วนตำบลห้องแซง',
    invNo: 'INV-2569-11-0001',
    periodName: '11/2569',
    meterNumber: 'HSG-0001',
    homeownerName: 'นายสมหมาย ใจดี',
    houseNo: '101/1 หมู่ที่ 1',
    lastMeter: 120,
    currentMeter: 135,
    waterUsed: 15,
    waterCharge: 85,
    reserveFee: 10,
    vat: 6.65,
    totalPaid: 101.65,
    status: 'invoice',
    recordedAt: '2026-11-18 10:30',
  }

  it('formats 58mm thermal receipt text with meter reading and total payable', () => {
    const text = formatThermalReceiptText(sampleBill)
    expect(text).toContain('องค์การบริหารส่วนตำบลห้องแซง')
    expect(text).toContain('INV-2569-11-0001')
    expect(text).toContain('HSG-0001')
    expect(text).toContain('101.65')
  })

  it('encodes ESC/POS initialization (0x1B 0x40) and cut/feed commands into Uint8Array', () => {
    const bytes = buildEscPosReceiptBytes(sampleBill)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes[0]).toBe(0x1b) // ESC
    expect(bytes[1]).toBe(0x40) // @ (Initialize printer)
    expect(bytes.length).toBeGreaterThan(50)
  })
})
