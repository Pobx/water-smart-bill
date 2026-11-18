import { useState } from 'react'
import type { InvoiceItem, WaterMeterItem } from '@/shared/types/waterSmartBill'

export function useLiffPortal(meters: WaterMeterItem[]) {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([
    {
      id: 1,
      inv_no: 'INV-2569-11-0001',
      period_name: '11/2569',
      meter_id: 1,
      meternumber: 'HSG-0001',
      homeowner_name: 'นายสมหมาย ใจดี',
      house_no: '101/1',
      zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ',
      lastmeter: 105,
      currentmeter: 120,
      water_used: 15,
      paid: 85,
      reserve_meter: 10,
      vat: 6.65,
      totalpaid: 101.65,
      reading_photo_url: '',
      ocr_text: '00120',
      ocr_confidence: 98.2,
      status: 'invoice',
      recorded_at: '2026-11-18 08:30',
    },
    {
      id: 2,
      inv_no: 'INV-2569-10-0002',
      period_name: '10/2569',
      meter_id: 2,
      meternumber: 'HSG-0002',
      homeowner_name: 'นางมาลี ศรีสุข',
      house_no: '205/4',
      zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้',
      lastmeter: 75,
      currentmeter: 85,
      water_used: 10,
      paid: 50,
      reserve_meter: 10,
      vat: 4.2,
      totalpaid: 64.2,
      reading_photo_url: '',
      ocr_text: '00085',
      ocr_confidence: 99.0,
      status: 'paid',
      recorded_at: '2026-10-25 09:15',
    },
  ])
  const [liffSelectedMeterNo, setLiffSelectedMeterNo] = useState('HSG-0001')

  const liffInvoices = invoices.filter((i) => i.meternumber === liffSelectedMeterNo)
  const liffMeter = meters.find((m) => m.meternumber === liffSelectedMeterNo) ?? meters[0]

  return {
    invoices,
    setInvoices,
    liffSelectedMeterNo,
    setLiffSelectedMeterNo,
    liffInvoices,
    liffMeter,
  }
}
