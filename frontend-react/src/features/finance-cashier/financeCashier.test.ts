import { describe, it, expect } from 'vitest'
import { financeCashierApi } from './financeCashierApi'
import type { WaterInvoiceItem } from '@/shared/types/waterSmartBill'

describe('Finance & Cashier Slice Domain and Utilities', () => {
  const sampleInvoices: WaterInvoiceItem[] = [
    {
      id: 1,
      inv_no: 'INV-2569-11-0001',
      period_name: 'งวด พฤศจิกายน 2569',
      meter_id: 1,
      meternumber: 'HSG-0001',
      homeowner_name: 'นายสมหมาย ใจดี',
      house_no: '12/1',
      zone_name: 'หมู่ 1 บ้านหนองน้ำใส',
      lastmeter: 100,
      currentmeter: 120,
      water_used: 20,
      paid: 140,
      reserve_meter: 10,
      vat: 10.5,
      totalpaid: 160.5,
      reading_photo_url: '',
      ocr_text: '',
      ocr_confidence: 98,
      status: 'invoice',
      recorded_at: '2026-11-18T10:00:00Z',
    },
    {
      id: 2,
      inv_no: 'INV-2569-11-0002',
      period_name: 'งวด พฤศจิกายน 2569',
      meter_id: 2,
      meternumber: 'HSG-0002',
      homeowner_name: 'นางสมศรี มีสุข',
      house_no: '12/2',
      zone_name: 'หมู่ 1 บ้านหนองน้ำใส',
      lastmeter: 50,
      currentmeter: 65,
      water_used: 15,
      paid: 105,
      reserve_meter: 10,
      vat: 8.05,
      totalpaid: 123.05,
      reading_photo_url: '',
      ocr_text: '',
      ocr_confidence: 96,
      status: 'paid',
      payment_method: 'cash',
      receipt_no: 'RC-256911-0002',
      paid_at: '2026-11-18T11:00:00Z',
      recorded_at: '2026-11-18T10:05:00Z',
    },
  ]

  it('correctly filters invoices by status and search query', () => {
    const unpaid = sampleInvoices.filter((inv) => inv.status !== 'paid')
    const paid = sampleInvoices.filter((inv) => inv.status === 'paid')
    expect(unpaid).toHaveLength(1)
    expect(paid).toHaveLength(1)

    const searchHouse = sampleInvoices.filter((inv) =>
      inv.house_no.toLowerCase().includes('12/1')
    )
    expect(searchHouse).toHaveLength(1)
    expect(searchHouse[0].homeowner_name).toBe('นายสมหมาย ใจดี')
  })

  it('computes exact cash change with floating-point precision', () => {
    const totalDue = 160.5
    const cashReceived = 200
    const change = Math.max(0, Math.round((cashReceived - totalDue) * 100) / 100)
    expect(change).toBe(39.5)
  })

  it('exports API methods with valid endpoint signatures', () => {
    expect(typeof financeCashierApi.listInvoices).toBe('function')
    expect(typeof financeCashierApi.payInvoice).toBe('function')
    expect(typeof financeCashierApi.getCollectionReport).toBe('function')
    expect(typeof financeCashierApi.downloadCollectionReportCSV).toBe('function')
  })
})
