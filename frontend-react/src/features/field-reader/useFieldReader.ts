import React, { useState } from 'react'
import {
  calculateProgressiveWaterBill,
  type RateTier,
} from '@/features/billing/utils/waterBillCalculator'
import {
  enqueueOfflineReading,
  getOfflineQueue,
  markReadingsSynced,
  type OfflineReadingRecord,
} from '@/features/offline/offlineStore'
import { type ThermalBillPayload } from '@/features/printer/escpos'
import { extractMeterReadingFromHint } from '@/features/ocr/meterOcr'
import type { InvoiceItem, OrganizationInfo, WaterMeterItem } from '@/shared/types/waterSmartBill'

export interface UseFieldReaderParams {
  orgInfo: OrganizationInfo
  meters: WaterMeterItem[]
  setMeters: React.Dispatch<React.SetStateAction<WaterMeterItem[]>>
  tiers: RateTier[]
  reserveFee: number
  periods: string[]
  invoices: InvoiceItem[]
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceItem[]>>
}

export function useFieldReader({
  orgInfo,
  meters,
  setMeters,
  tiers,
  reserveFee,
  periods,
  invoices,
  setInvoices,
}: UseFieldReaderParams) {
  const [isOfflineMode, setIsOfflineMode] = useState(true)
  const [selectedMeterId, setSelectedMeterId] = useState(1)
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0] ?? '11/2569')
  const [currentReadingStr, setCurrentReadingStr] = useState('135')
  const [ocrHintInput, setOcrHintInput] = useState('METER_00142')
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string>('')
  const [ocrConfidence, setOcrConfidence] = useState<number>(98.4)
  const [offlineQueue, setOfflineQueue] = useState<OfflineReadingRecord[]>(() => getOfflineQueue())
  const [activeThermalBill, setActiveThermalBill] = useState<ThermalBillPayload | null>(null)
  const [bluetoothPrintStatus, setBluetoothPrintStatus] = useState<string>('')

  const activeMeter = meters.find((m) => m.meter_id === selectedMeterId) ?? meters[0]
  const currentReadingNum = Math.max(0, Number(currentReadingStr) || 0)
  const unitsUsed = Math.max(0, currentReadingNum - (activeMeter?.last_meter_recording ?? 0))
  const liveBreakdown = calculateProgressiveWaterBill(unitsUsed, tiers, reserveFee, orgInfo.vat)
  const pendingSyncCount = offlineQueue.filter((q) => q.sync_status === 'pending').length

  function handleRunOcrScan() {
    const prev = activeMeter?.last_meter_recording ?? 0
    const res = extractMeterReadingFromHint(ocrHintInput, prev)
    setCurrentReadingStr(String(res.reading))
    setOcrConfidence(res.confidence)
    setOcrStatusMsg(
      res.warning
        ? `⚠️ OCR อ่านได้ ${res.digits} (${res.warning})`
        : `✅ AI OCR อ่านเลขหน้าปัดสำเร็จ: ${res.digits} (ความมั่นใจ ${res.confidence}%)`,
    )
  }

  function handleRecordReadingAndOpenBluetooth(e: React.FormEvent) {
    e.preventDefault()
    if (!activeMeter) return
    const invNo = `INV-2569-${String(invoices.length + 1).padStart(4, '0')}`
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ')

    const queued = enqueueOfflineReading({
      inv_no: invNo,
      meter_id: activeMeter.meter_id,
      meternumber: activeMeter.meternumber,
      homeowner_name: activeMeter.homeowner_name,
      house_no: activeMeter.house_no,
      period_id: 1,
      period_name: selectedPeriod,
      last_meter: activeMeter.last_meter_recording,
      current_meter: currentReadingNum,
      water_used: liveBreakdown.units_used,
      paid: liveBreakdown.water_charge,
      reserve_meter: liveBreakdown.reserve_fee,
      vat: liveBreakdown.vat_amount,
      totalpaid: liveBreakdown.total_payable,
      reading_photo_url: '',
      ocr_text: String(currentReadingNum).padStart(5, '0'),
      ocr_confidence: ocrConfidence,
    })

    setOfflineQueue(getOfflineQueue())

    const newInv: InvoiceItem = {
      id: invoices.length + 1,
      inv_no: invNo,
      client_reading_id: queued.client_reading_id,
      period_name: selectedPeriod,
      meter_id: activeMeter.meter_id,
      meternumber: activeMeter.meternumber,
      homeowner_name: activeMeter.homeowner_name,
      house_no: activeMeter.house_no,
      zone_name: activeMeter.zone_name,
      lastmeter: activeMeter.last_meter_recording,
      currentmeter: currentReadingNum,
      water_used: liveBreakdown.units_used,
      paid: liveBreakdown.water_charge,
      reserve_meter: liveBreakdown.reserve_fee,
      vat: liveBreakdown.vat_amount,
      totalpaid: liveBreakdown.total_payable,
      reading_photo_url: '',
      ocr_text: queued.ocr_text,
      ocr_confidence: ocrConfidence,
      status: 'invoice',
      recorded_at: nowStr,
    }
    setInvoices([newInv, ...invoices])
    setMeters(
      meters.map((m) =>
        m.meter_id === activeMeter.meter_id ? { ...m, last_meter_recording: currentReadingNum } : m,
      ),
    )

    setActiveThermalBill({
      orgName: orgInfo.org_name,
      invNo,
      periodName: selectedPeriod,
      meterNumber: activeMeter.meternumber,
      homeownerName: activeMeter.homeowner_name,
      houseNo: `${activeMeter.house_no} ${activeMeter.zone_name}`,
      lastMeter: activeMeter.last_meter_recording,
      currentMeter: currentReadingNum,
      waterUsed: liveBreakdown.units_used,
      waterCharge: liveBreakdown.water_charge,
      reserveFee: liveBreakdown.reserve_fee,
      vat: liveBreakdown.vat_amount,
      totalPaid: liveBreakdown.total_payable,
      status: 'invoice',
      recordedAt: nowStr,
    })
    setBluetoothPrintStatus('')
  }

  function handleSyncOfflineQueue() {
    const pendingIds = offlineQueue
      .filter((r) => r.sync_status === 'pending')
      .map((r) => r.client_reading_id)
    markReadingsSynced(pendingIds)
    setOfflineQueue(getOfflineQueue())
  }

  return {
    isOfflineMode,
    setIsOfflineMode,
    selectedMeterId,
    setSelectedMeterId,
    selectedPeriod,
    setSelectedPeriod,
    currentReadingStr,
    setCurrentReadingStr,
    ocrHintInput,
    setOcrHintInput,
    ocrStatusMsg,
    offlineQueue,
    activeThermalBill,
    setActiveThermalBill,
    bluetoothPrintStatus,
    setBluetoothPrintStatus,
    activeMeter,
    liveBreakdown,
    pendingSyncCount,
    handleRunOcrScan,
    handleRecordReadingAndOpenBluetooth,
    handleSyncOfflineQueue,
  }
}
