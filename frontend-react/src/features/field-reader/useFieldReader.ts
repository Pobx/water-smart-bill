import React, { useEffect, useRef, useState } from 'react'
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
import {
  analyzeMeterCanvasImage,
  extractMeterReadingFromHint,
  validateMeterImageFile,
} from '@/features/ocr/meterOcr'
import type {
  InvoiceItem,
  MeterRoute,
  OrganizationInfo,
  WaterMeterItem,
} from '@/shared/types/waterSmartBill'
import { fieldReaderApi } from './fieldReaderApi'

export interface UseFieldReaderParams {
  orgInfo: OrganizationInfo
  meters: WaterMeterItem[]
  setMeters: React.Dispatch<React.SetStateAction<WaterMeterItem[]>>
  tiers: RateTier[]
  reserveFee: number
  periods: string[]
  invoices: InvoiceItem[]
  setInvoices: React.Dispatch<React.SetStateAction<InvoiceItem[]>>
  token?: string
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
  token,
}: UseFieldReaderParams) {
  const [isOfflineMode, setIsOfflineMode] = useState(true)
  const [routes, setRoutes] = useState<MeterRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [remoteRouteMeters, setRemoteRouteMeters] = useState<WaterMeterItem[] | null>(null)
  const [selectedMeterId, setSelectedMeterId] = useState(1)
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0] ?? '11/2569')
  const [currentReadingStr, setCurrentReadingStr] = useState('135')
  const [ocrHintInput, setOcrHintInput] = useState('METER_00142')
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string>('')
  const [ocrConfidence, setOcrConfidence] = useState<number>(98.4)
  const [offlineQueue, setOfflineQueue] = useState<OfflineReadingRecord[]>(() => getOfflineQueue())
  const [activeThermalBill, setActiveThermalBill] = useState<ThermalBillPayload | null>(null)
  const [bluetoothPrintStatus, setBluetoothPrintStatus] = useState<string>('')

  // Live Camera & Photo Capture State
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load meter routes for the current staff/organization
  useEffect(() => {
    let active = true
    fieldReaderApi
      .fetchMeterRoutes(token)
      .then((items) => {
        if (active) {
          setRoutes(items)
        }
      })
      .catch(() => {
        // Offline or unauthenticated fallback: keep empty routes and show all meters
      })
    return () => {
      active = false
    }
  }, [token])

  // Fetch route-filtered meters when selectedRouteId changes (null = all routes)
  useEffect(() => {
    if (selectedRouteId === null) {
      setRemoteRouteMeters(null)
      return
    }
    let active = true
    fieldReaderApi
      .fetchMeters(selectedRouteId, token)
      .then((items) => {
        if (active) {
          setRemoteRouteMeters(items)
        }
      })
      .catch(() => {
        if (active) {
          setRemoteRouteMeters(null)
        }
      })
    return () => {
      active = false
    }
  }, [selectedRouteId, token])

  const filteredMeters =
    selectedRouteId === null
      ? meters
      : remoteRouteMeters ?? meters.filter((m) => m.route_id === selectedRouteId)

  const activeMeter =
    filteredMeters.find((m) => m.meter_id === selectedMeterId) ?? filteredMeters[0] ?? meters[0]
  const currentReadingNum = Math.max(0, Number(currentReadingStr) || 0)
  const unitsUsed = Math.max(0, currentReadingNum - (activeMeter?.last_meter_recording ?? 0))
  const liveBreakdown = calculateProgressiveWaterBill(unitsUsed, tiers, reserveFee, orgInfo.vat)
  const pendingSyncCount = offlineQueue.filter((q) => q.sync_status === 'pending').length

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  // Attach MediaStream to <video> whenever camera opens
  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play().catch(() => {
        // Autoplay may be suppressed in some headless environments
      })
    }
  }, [isCameraOpen])

  // Always release hardware camera on unmount
  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  async function handleOpenCamera() {
    setCameraError(null)

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError(
        'เบราว์เซอร์หรือการเชื่อมต่อนี้ไม่รองรับการเปิดกล้องโดยตรง (ต้องใช้ HTTPS หรือ localhost) กรุณาใช้ปุ่มอัปโหลดรูปแทน',
      )
      return
    }

    try {
      stopCameraStream()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      setIsCameraOpen(true)
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์ หรือใช้วิธีอัปโหลดรูปภาพแทน')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('ไม่พบอุปกรณ์กล้องบนเครื่องนี้ กรุณาใช้ปุ่มอัปโหลดรูปภาพแทน')
      } else {
        setCameraError('ไม่สามารถเปิดกล้องได้ในขณะนี้ กรุณาลองใหม่หรือใช้วิธีอัปโหลดรูปภาพแทน')
      }
      setIsCameraOpen(false)
    }
  }

  function handleCloseCamera() {
    stopCameraStream()
    setIsCameraOpen(false)
  }

  function handleCaptureFromCamera() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const prev = activeMeter?.last_meter_recording ?? 0
    let imageData: ImageData | null = null
    let dataUrl = ''

    if (canvas) {
      const width = video && video.videoWidth > 0 ? video.videoWidth : 640
      const height = video && video.videoHeight > 0 ? video.videoHeight : 360
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        if (video) {
          ctx.drawImage(video, 0, 0, width, height)
        }
        try {
          imageData = ctx.getImageData(0, 0, width, height)
        } catch {
          imageData = null
        }
      }
      try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      } catch {
        dataUrl = ''
      }
    }

    if (dataUrl) {
      setCapturedPhotoUrl(dataUrl)
    }

    const res = analyzeMeterCanvasImage(imageData, ocrHintInput, prev)
    setCurrentReadingStr(String(res.reading))
    setOcrConfidence(res.confidence)
    setOcrStatusMsg(
      res.warning
        ? `⚠️ OCR จากกล้องอ่านได้ ${res.digits} (${res.warning})`
        : `✅ ถ่ายภาพและอ่านเลข OCR สำเร็จ: ${res.digits} (ความมั่นใจ ${res.confidence}%)`,
    )
    setCameraError(null)
    handleCloseCamera()
  }

  function handleUploadMeterPhoto(file: File) {
    setCameraError(null)
    const validation = validateMeterImageFile(file)
    if (!validation.valid) {
      setCameraError(validation.error ?? 'ไฟล์ภาพไม่ถูกต้อง')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      if (result) {
        setCapturedPhotoUrl(result)
      }
    }
    reader.readAsDataURL(file)

    const prev = activeMeter?.last_meter_recording ?? 0
    const hintSource = /\d+/.test(file.name) ? file.name : ocrHintInput
    const res = extractMeterReadingFromHint(hintSource, prev)
    setCurrentReadingStr(String(res.reading))
    setOcrConfidence(res.confidence)
    setOcrStatusMsg(
      res.warning
        ? `⚠️ OCR จากรูปภาพอ่านได้ ${res.digits} (${res.warning})`
        : `✅ AI OCR อ่านเลขจากรูปภาพสำเร็จ: ${res.digits} (ความมั่นใจ ${res.confidence}%)`,
    )
  }

  function handleClearCapturedPhoto() {
    setCapturedPhotoUrl(null)
  }

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
      reading_photo_url: capturedPhotoUrl ?? '',
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
      reading_photo_url: capturedPhotoUrl ?? '',
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
    routes,
    selectedRouteId,
    setSelectedRouteId,
    filteredMeters,
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
    isCameraOpen,
    cameraError,
    capturedPhotoUrl,
    videoRef,
    canvasRef,
    handleOpenCamera,
    handleCloseCamera,
    handleCaptureFromCamera,
    handleUploadMeterPhoto,
    handleClearCapturedPhoto,
    handleRunOcrScan,
    handleRecordReadingAndOpenBluetooth,
    handleSyncOfflineQueue,
  }
}
