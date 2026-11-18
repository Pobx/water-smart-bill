import React, { useState } from 'react'
import {
  calculateProgressiveWaterBill,
  resolveAvatarUrl,
  type RateTier,
} from '@/features/billing/utils/waterBillCalculator'
import {
  enqueueOfflineReading,
  getOfflineQueue,
  markReadingsSynced,
  type OfflineReadingRecord,
} from '@/features/offline/offlineStore'
import {
  formatThermalReceiptText,
  printViaWebBluetooth,
  type ThermalBillPayload,
} from '@/features/printer/escpos'
import { extractMeterReadingFromHint } from '@/features/ocr/meterOcr'

interface Homeowner {
  id: number
  prefix: string
  firstname: string
  lastname: string
  house_no: string
  zone_id: number
  zone_name: string
  tambon_name: string
  phone: string
  line_user_id: string
  image: string
  avatar_url: string
}

interface VillageZone {
  id: number
  moo_no: number
  zone_name: string
  tambon_name: string
  subzone_name: string
}

interface WaterMeterItem {
  meter_id: number
  meternumber: string
  factory_no: string
  user_id: number
  homeowner_name: string
  house_no: string
  zone_id: number
  zone_name: string
  last_meter_recording: number
  status: 'active' | 'cutmeter'
}

interface InvoiceItem {
  id: number
  inv_no: string
  client_reading_id?: string
  period_name: string
  meter_id: number
  meternumber: string
  homeowner_name: string
  house_no: string
  zone_name: string
  lastmeter: number
  currentmeter: number
  water_used: number
  paid: number
  reserve_meter: number
  vat: number
  totalpaid: number
  reading_photo_url: string
  ocr_text: string
  ocr_confidence: number
  status: 'invoice' | 'paid'
  recorded_at: string
}

function makeDefaultAvatarDataUri(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`
      : (parts[0]?.slice(0, 2) ?? 'อบ')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="60" fill="#0284c7"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="40" font-weight="700">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function App() {
  const [activeTab, setActiveTab] = useState<'master' | 'tariffs' | 'reader' | 'liff'>('master')

  // Auth & JWT Blacklist State
  const [jwtToken, setJwtToken] = useState('demo-jwt-hsg-2569-active')
  const [blacklistedTokens, setBlacklistedTokens] = useState<string[]>([])
  const [showKeycloakModal, setShowKeycloakModal] = useState(false)

  // Organization (อบต.) State
  const [orgInfo, setOrgInfo] = useState({
    org_code: 'HSG1',
    org_name: 'องค์การบริหารส่วนตำบลห้องแซง',
    tambon_name: 'ห้องแซง',
    district_name: 'เลิงนกทา',
    province_name: 'ยโสธร',
    zipcode: '35120',
    phone: '045-777-111',
    dept_name: 'กองการประปา อบต.ห้องแซง',
    vat: 7,
  })

  // Villages (หมู่บ้าน) State
  const [zones, setZones] = useState<VillageZone[]>([
    { id: 1, moo_no: 1, zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ', tambon_name: 'ห้องแซง', subzone_name: 'สายจดที่ 1 (คุ้มวัดเหนือ)' },
    { id: 2, moo_no: 2, zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้', tambon_name: 'ห้องแซง', subzone_name: 'สายจดที่ 2 (คุ้มตลาดใต้)' },
  ])
  const [newZoneMoo, setNewZoneMoo] = useState('3')
  const [newZoneName, setNewZoneName] = useState('')
  const [newSubzoneName, setNewSubzoneName] = useState('')

  // Homeowners (เจ้าของบ้าน + รูป Avatar) State
  const [homeowners, setHomeowners] = useState<Homeowner[]>([
    {
      id: 1,
      prefix: 'นาย',
      firstname: 'สมหมาย',
      lastname: 'ใจดี',
      house_no: '101/1',
      zone_id: 1,
      zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ',
      tambon_name: 'ห้องแซง',
      phone: '081-234-5678',
      line_user_id: 'U1001_SOMMAI',
      image: '',
      avatar_url: makeDefaultAvatarDataUri('สมหมาย ใจดี'),
    },
    {
      id: 2,
      prefix: 'นาง',
      firstname: 'มาลี',
      lastname: 'ศรีสุข',
      house_no: '205/4',
      zone_id: 2,
      zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้',
      tambon_name: 'ห้องแซง',
      phone: '089-876-5432',
      line_user_id: 'U1002_MALEE',
      image: '',
      avatar_url: makeDefaultAvatarDataUri('มาลี ศรีสุข'),
    },
  ])
  const [prefix, setPrefix] = useState('นาย')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [houseNo, setHouseNo] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState(1)
  const [phone, setPhone] = useState('')
  const [uploadedAvatarDataUrl, setUploadedAvatarDataUrl] = useState('')

  // Tariff Tiers & Billing Periods State
  const [reserveFee, setReserveFee] = useState(10)
  const [tiers, setTiers] = useState<RateTier[]>([
    { tier_order: 1, min_units: 1, max_units: 10, rate_per_unit: 5, comment: 'หน่วยที่ 1 - 10 (ครัวเรือนประหยัด)' },
    { tier_order: 2, min_units: 11, max_units: 20, rate_per_unit: 7, comment: 'หน่วยที่ 11 - 20' },
    { tier_order: 3, min_units: 21, max_units: 50, rate_per_unit: 10, comment: 'หน่วยที่ 21 - 50' },
    { tier_order: 4, min_units: 51, max_units: null, rate_per_unit: 12, comment: 'ตั้งแต่ 51 หน่วยขึ้นไป' },
  ])
  const [periods, setPeriods] = useState(['11/2569', '10/2569'])
  const [newPeriodName, setNewPeriodName] = useState('')

  // Water Meters State
  const [meters, setMeters] = useState<WaterMeterItem[]>([
    {
      meter_id: 1,
      meternumber: 'HSG-0001',
      factory_no: 'SN-2026-0001',
      user_id: 1,
      homeowner_name: 'นายสมหมาย ใจดี',
      house_no: '101/1',
      zone_id: 1,
      zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ',
      last_meter_recording: 120,
      status: 'active',
    },
    {
      meter_id: 2,
      meternumber: 'HSG-0002',
      factory_no: 'SN-2026-0002',
      user_id: 2,
      homeowner_name: 'นางมาลี ศรีสุข',
      house_no: '205/4',
      zone_id: 2,
      zone_name: 'หมู่ที่ 2 บ้านห้องแซงใต้',
      last_meter_recording: 85,
      status: 'active',
    },
  ])
  const [newMeterOwnerId, setNewMeterOwnerId] = useState(1)
  const [newMeterNumber, setNewMeterNumber] = useState('')
  const [newMeterInitialReading, setNewMeterInitialReading] = useState('0')

  // Field Meter Reader, Offline-First & OCR State
  const [isOfflineMode, setIsOfflineMode] = useState(true)
  const [selectedMeterId, setSelectedMeterId] = useState(1)
  const [selectedPeriod, setSelectedPeriod] = useState('11/2569')
  const [currentReadingStr, setCurrentReadingStr] = useState('135')
  const [ocrHintInput, setOcrHintInput] = useState('METER_00142')
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string>('')
  const [ocrConfidence, setOcrConfidence] = useState<number>(98.4)
  const [offlineQueue, setOfflineQueue] = useState<OfflineReadingRecord[]>(() => getOfflineQueue())
  const [activeThermalBill, setActiveThermalBill] = useState<ThermalBillPayload | null>(null)
  const [bluetoothPrintStatus, setBluetoothPrintStatus] = useState<string>('')

  // Invoices & LINE LIFF State
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

  const activeMeter = meters.find((m) => m.meter_id === selectedMeterId) ?? meters[0]
  const currentReadingNum = Math.max(0, Number(currentReadingStr) || 0)
  const unitsUsed = Math.max(0, currentReadingNum - (activeMeter?.last_meter_recording ?? 0))
  const liveBreakdown = calculateProgressiveWaterBill(unitsUsed, tiers, reserveFee, orgInfo.vat)

  function handleAddVillage(e: React.FormEvent) {
    e.preventDefault()
    if (!newZoneName.trim()) return
    const nextId = zones.length + 1
    setZones([
      ...zones,
      {
        id: nextId,
        moo_no: Number(newZoneMoo) || nextId,
        zone_name: newZoneName.trim(),
        tambon_name: orgInfo.tambon_name,
        subzone_name: newSubzoneName.trim() || `สายจดที่ ${nextId}`,
      },
    ])
    setNewZoneName('')
    setNewSubzoneName('')
  }

  function handleAddHomeowner(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !houseNo.trim()) return
    const zone = zones.find((z) => z.id === selectedZoneId) ?? zones[0]
    const nextId = homeowners.length + 1
    const fallbackAvatar = uploadedAvatarDataUrl.trim()
      ? uploadedAvatarDataUrl.trim()
      : makeDefaultAvatarDataUri(`${firstName} ${lastName}`)
    const newOwner: Homeowner = {
      id: nextId,
      prefix,
      firstname: firstName.trim(),
      lastname: lastName.trim(),
      house_no: houseNo.trim(),
      zone_id: zone.id,
      zone_name: zone.zone_name,
      tambon_name: orgInfo.tambon_name,
      phone: phone.trim() || '080-000-0000',
      line_user_id: `U_AUTO_${nextId}`,
      image: uploadedAvatarDataUrl.trim(),
      avatar_url: fallbackAvatar,
    }
    setHomeowners([...homeowners, newOwner])
    setFirstName('')
    setLastName('')
    setHouseNo('')
    setPhone('')
    setUploadedAvatarDataUrl('')
  }

  function handleRegisterMeter(e: React.FormEvent) {
    e.preventDefault()
    if (!newMeterNumber.trim()) return
    const owner = homeowners.find((h) => h.id === newMeterOwnerId) ?? homeowners[0]
    const nextId = meters.length + 1
    setMeters([
      ...meters,
      {
        meter_id: nextId,
        meternumber: newMeterNumber.trim(),
        factory_no: `SN-2026-000${nextId}`,
        user_id: owner.id,
        homeowner_name: `${owner.prefix}${owner.firstname} ${owner.lastname}`.trim(),
        house_no: owner.house_no,
        zone_id: owner.zone_id,
        zone_name: owner.zone_name,
        last_meter_recording: Number(newMeterInitialReading) || 0,
        status: 'active',
      },
    ])
    setNewMeterNumber('')
    setNewMeterInitialReading('0')
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

  function handleLogoutAndBlacklistJwt() {
    if (!blacklistedTokens.includes(jwtToken)) {
      setBlacklistedTokens([jwtToken, ...blacklistedTokens])
    }
    setShowKeycloakModal(true)
  }

  const pendingSyncCount = offlineQueue.filter((q) => q.sync_status === 'pending').length
  const liffInvoices = invoices.filter((i) => i.meternumber === liffSelectedMeterNo)
  const liffMeter = meters.find((m) => m.meternumber === liffSelectedMeterNo) ?? meters[0]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation Header (shadcn/ui + v0.app style) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 font-bold text-white shadow-xs">
              💧
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">Water Smart Bill</h1>
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-600/20">
                  SAO Platform • ต่อยอดจาก PIOS
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {orgInfo.org_name} • ต.{orgInfo.tambon_name} อ.{orgInfo.district_name} จ.{orgInfo.province_name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                isOfflineMode
                  ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/30'
                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isOfflineMode ? `Offline-First Mode (${pendingSyncCount} รอซิงค์)` : 'Online Connected'}
            </span>

            <a
              href="/swagger/index.html"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Swagger API (Non-Prod)
            </a>

            <button
              type="button"
              onClick={handleLogoutAndBlacklistJwt}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Logout (Blacklist JWT)
            </button>
          </div>
        </div>

        {/* Navigation Pill Bar */}
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'master'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            1. ข้อมูล อบต. / หมู่บ้าน / เจ้าของบ้าน (Avatar)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tariffs')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'tariffs'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            2. อัตราค่าน้ำ & ทะเบียนมิเตอร์น้ำ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reader')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'reader'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            3. จดมิเตอร์ & ออกบิล Bluetooth (Offline + OCR)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('liff')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'liff'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            4. LINE LIFF ลูกบ้าน
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {/* TAB 1: MASTER DATA (อบต., ตำบล, หมู่บ้าน, บ้านเลขที่ & เจ้าของบ้าน + Default Avatar) */}
        {activeTab === 'master' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              {/* ข้อมูล อบต. และ ตำบล */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">ข้อมูล อบต. และพื้นที่ตำบล</h2>
                    <p className="text-xs text-slate-500">ตาราง organizations, provinces, districts, tambons</p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                    {orgInfo.org_code}
                  </span>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">ชื่อองค์การบริหารส่วนตำบล (อบต.)</label>
                    <input
                      aria-label="ชื่อ อบต."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={orgInfo.org_name}
                      onChange={(e) => setOrgInfo({ ...orgInfo, org_name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">ตำบล</label>
                      <input
                        aria-label="ตำบล"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        value={orgInfo.tambon_name}
                        onChange={(e) => setOrgInfo({ ...orgInfo, tambon_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">อำเภอ</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        value={orgInfo.district_name}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">จังหวัด</label>
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        value={orgInfo.province_name}
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* เพิ่มหมู่บ้าน (Zones / Subzones) */}
                <form onSubmit={handleAddVillage} className="mt-5 border-t border-slate-100 pt-4">
                  <h3 className="mb-2 text-sm font-bold text-slate-900">จัดการหมู่บ้าน (Zones) & สายจดมิเตอร์</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      placeholder="หมู่ที่"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      value={newZoneMoo}
                      onChange={(e) => setNewZoneMoo(e.target.value)}
                    />
                    <input
                      placeholder="ชื่อหมู่บ้าน (เช่น บ้านดอน)"
                      className="col-span-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      placeholder="สายจดมิเตอร์ / คุ้ม"
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      value={newSubzoneName}
                      onChange={(e) => setNewSubzoneName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      + เพิ่มหมู่บ้าน
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                    {zones.map((z) => (
                      <li key={z.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                        <span className="font-medium text-slate-800">{z.zone_name}</span>
                        <span className="text-slate-500">{z.subzone_name}</span>
                      </li>
                    ))}
                  </ul>
                </form>
              </div>

              {/* ฟอร์มบันทึกบ้านเลขที่และเจ้าของบ้าน + Avatar Upload & Default Avatar */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-7">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      บันทึกบ้านเลขที่และเจ้าของบ้าน (พร้อมรูป Avatar)
                    </h2>
                    <p className="text-xs text-slate-500">
                      หากไม่อัปโหลดรูป ระบบจะสร้างรูป Default Avatar อัตโนมัติ (`resolveAvatarUrl`)
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddHomeowner} className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">คำนำหน้า</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                    >
                      <option value="นาย">นาย</option>
                      <option value="นาง">นาง</option>
                      <option value="นางสาว">นางสาว</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="owner-firstname" className="mb-1 block text-xs font-medium text-slate-600">
                      ชื่อเจ้าของบ้าน
                    </label>
                    <input
                      id="owner-firstname"
                      aria-label="ชื่อเจ้าของบ้าน"
                      placeholder="เช่น วิภา"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="owner-lastname" className="mb-1 block text-xs font-medium text-slate-600">
                      นามสกุลเจ้าของบ้าน
                    </label>
                    <input
                      id="owner-lastname"
                      aria-label="นามสกุลเจ้าของบ้าน"
                      placeholder="เช่น สุขใจ"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="owner-houseno" className="mb-1 block text-xs font-medium text-slate-600">
                      บ้านเลขที่
                    </label>
                    <input
                      id="owner-houseno"
                      aria-label="บ้านเลขที่"
                      placeholder="เช่น 309/2"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={houseNo}
                      onChange={(e) => setHouseNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">หมู่บ้าน</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(Number(e.target.value))}
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.zone_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">เบอร์โทรศัพท์</label>
                    <input
                      placeholder="08x-xxx-xxxx"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      อัปโหลดรูป Avatar (ตัวเลือก — ถ้าเว้นว่างจะใช้ Default Avatar)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = () => setUploadedAvatarDataUrl(String(reader.result || ''))
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700"
                    >
                      บันทึกเจ้าของบ้าน
                    </button>
                  </div>
                </form>

                {/* ตารางรายชื่อเจ้าของบ้านพร้อมรูป Avatar */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Avatar</th>
                        <th className="px-3 py-2.5">ชื่อ-นามสกุลเจ้าของบ้าน</th>
                        <th className="px-3 py-2.5">บ้านเลขที่</th>
                        <th className="px-3 py-2.5">หมู่บ้าน / ตำบล</th>
                        <th className="px-3 py-2.5">สถานะรูป</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {homeowners.map((h) => (
                        <tr key={h.id}>
                          <td className="px-3 py-2.5">
                            <img
                              src={h.avatar_url || resolveAvatarUrl(h.image, h.firstname, h.lastname)}
                              alt={`Avatar ${h.firstname} ${h.lastname}`}
                              className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">
                            {h.prefix}
                            {h.firstname} {h.lastname}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-sky-700">{h.house_no}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {h.zone_name} • ต.{h.tambon_name}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {h.image ? 'Uploaded Photo' : 'Default Avatar'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TARIFFS & WATER METERS */}
        {activeTab === 'tariffs' && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* ตารางอัตราค่าน้ำขั้นบันได */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-6">
              <h2 className="text-base font-bold text-slate-900">
                บันทึกข้อมูลหน่วยและอัตราค่าน้ำขั้นบันได (Progressive Tariff)
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                ตาราง tw_meter_type_rate_configs & tw_meter_type_rate_tiers
              </p>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    ค่ารักษามาตรวัดน้ำ (บาท/เดือน)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    value={reserveFee}
                    onChange={(e) => setReserveFee(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">ภาษีมูลค่าเพิ่ม VAT (%)</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                    value={orgInfo.vat}
                    readOnly
                  />
                </div>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-2">ขั้นที่</th>
                    <th className="px-3 py-2">ช่วงหน่วยน้ำ (m³)</th>
                    <th className="px-3 py-2">ราคา/หน่วย (บาท)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tiers.map((t, idx) => (
                    <tr key={t.tier_order}>
                      <td className="px-3 py-2 font-mono font-bold">Tier #{t.tier_order}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {t.min_units} - {t.max_units ?? 'ขึ้นไป'} หน่วย
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-24 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                          value={t.rate_per_unit}
                          onChange={(e) => {
                            const updated = [...tiers]
                            updated[idx] = { ...t, rate_per_unit: Number(e.target.value) || 0 }
                            setTiers(updated)
                          }}
                        />{' '}
                        ฿
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* เปิดรอบบิล */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-bold text-slate-900">งวดบิลประจำเดือน (Invoice Periods)</h3>
                <div className="flex gap-2">
                  <input
                    placeholder="เช่น 12/2569"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                    value={newPeriodName}
                    onChange={(e) => setNewPeriodName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPeriodName.trim()) {
                        setPeriods([newPeriodName.trim(), ...periods])
                        setNewPeriodName('')
                      }
                    }}
                    className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    + เปิดงวดบิล
                  </button>
                </div>
              </div>
            </div>

            {/* ขึ้นทะเบียนมิเตอร์น้ำประปา */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-6">
              <h2 className="text-base font-bold text-slate-900">บันทึกทะเบียนมิเตอร์น้ำประปา (Water Meters)</h2>
              <p className="mb-4 text-xs text-slate-500">ตาราง tw_meter_infos ผูกกับบ้านเลขที่และเจ้าของบ้าน</p>

              <form onSubmit={handleRegisterMeter} className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">เจ้าของบ้าน</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                    value={newMeterOwnerId}
                    onChange={(e) => setNewMeterOwnerId(Number(e.target.value))}
                  >
                    {homeowners.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.firstname} ({h.house_no})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">เลขทะเบียนมิเตอร์</label>
                  <input
                    placeholder="เช่น HSG-0003"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={newMeterNumber}
                    onChange={(e) => setNewMeterNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">เลขตั้งต้น (m³)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                      value={newMeterInitialReading}
                      onChange={(e) => setNewMeterInitialReading(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      บันทึก
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">เลขมิเตอร์</th>
                      <th className="px-3 py-2">เจ้าของบ้าน</th>
                      <th className="px-3 py-2">บ้านเลขที่ / หมู่บ้าน</th>
                      <th className="px-3 py-2">เลขล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {meters.map((m) => (
                      <tr key={m.meter_id}>
                        <td className="px-3 py-2.5 font-mono font-bold text-sky-700">{m.meternumber}</td>
                        <td className="px-3 py-2.5 font-medium">{m.homeowner_name}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600">
                          {m.house_no} • {m.zone_name}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{m.last_meter_recording} m³</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OFFLINE-FIRST FIELD READER + AI OCR + BLUETOOTH ESC/POS PRINTER */}
        {activeTab === 'reader' && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    บันทึกเลขมิเตอร์น้ำ (Offline-First) + AI OCR + พิมพ์บิล Bluetooth
                  </h2>
                  <p className="text-xs text-slate-500">
                    รองรับการเดินจดในพื้นที่อับสัญญาณ คำนวณค่าน้ำทันที และพิมพ์ผ่าน Web Bluetooth ESC/POS
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOfflineMode(!isOfflineMode)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  สลับโหมด: {isOfflineMode ? 'กำลังทำงาน Offline' : 'กำลังทำงาน Online'}
                </button>
              </div>

              {/* กล่องถ่ายรูปมิเตอร์และสแกนตัวเลขด้วย AI OCR */}
              <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-sky-700">
                      Optional AI / Hybrid OCR Meter Scanner
                    </div>
                    <p className="text-xs text-slate-600">
                      ถ่ายรูปหน้าปัดมิเตอร์น้ำเพื่ออ่านค่าหน่วยมิเตอร์อัตโนมัติ (ตรวจสอบและแก้ไขได้เสมอ)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunOcrScan}
                    className="rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700"
                  >
                    📷 AI OCR อ่านเลขมิเตอร์จากรูป
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    aria-label="OCR Image Text Hint"
                    placeholder="ภาพจำลองหน้าปัดมิเตอร์ เช่น METER_00142"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs"
                    value={ocrHintInput}
                    onChange={(e) => setOcrHintInput(e.target.value)}
                  />
                  {ocrStatusMsg && (
                    <div className="flex items-center text-xs font-semibold text-sky-800">{ocrStatusMsg}</div>
                  )}
                </div>
              </div>

              <form onSubmit={handleRecordReadingAndOpenBluetooth} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">เลือกมิเตอร์น้ำ / บ้านเลขที่</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={selectedMeterId}
                      onChange={(e) => setSelectedMeterId(Number(e.target.value))}
                    >
                      {meters.map((m) => (
                        <option key={m.meter_id} value={m.meter_id}>
                          {m.meternumber} — บ้าน {m.house_no} ({m.homeowner_name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">ประจำงวดบิล</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                    >
                      {periods.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="current-reading-input" className="mb-1 block text-xs font-medium text-slate-600">
                      เลขมิเตอร์ครั้งนี้
                    </label>
                    <input
                      id="current-reading-input"
                      aria-label="เลขมิเตอร์ครั้งนี้"
                      type="number"
                      className="w-full rounded-lg border border-sky-300 bg-white px-3 py-2 font-mono text-base font-bold text-slate-900"
                      value={currentReadingStr}
                      onChange={(e) => setCurrentReadingStr(e.target.value)}
                    />
                  </div>
                </div>

                {/* Live Calculation Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div>
                      <div className="text-[11px] text-slate-500">เลขมิเตอร์ครั้งก่อน</div>
                      <div className="font-mono text-base font-bold">{activeMeter?.last_meter_recording ?? 0} m³</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">หน่วยน้ำที่ใช้</div>
                      <div className="font-mono text-base font-bold text-sky-700">{liveBreakdown.units_used} m³</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">ค่าน้ำตามขั้นบันได</div>
                      <div className="font-mono text-base font-bold">{liveBreakdown.water_charge.toFixed(2)} ฿</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">ค่ารักษามิเตอร์ + VAT</div>
                      <div className="font-mono text-base font-bold">
                        {(liveBreakdown.reserve_fee + liveBreakdown.vat_amount).toFixed(2)} ฿
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-700">รวมสุทธิที่ต้องชำระ</div>
                      <div className="font-mono text-lg font-extrabold text-emerald-700">
                        {liveBreakdown.total_payable.toFixed(2)} ฿
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                >
                  🖨️ บันทึกมิเตอร์ & พิมพ์บิล Bluetooth (ESC/POS)
                </button>
              </form>
            </div>

            {/* คิว Offline-First Sync */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">คิวซิงค์ข้อมูล Offline-First</h2>
                  <p className="text-xs text-slate-500">เก็บลงเครื่องด้วย Idempotency-Key (`client_reading_id`)</p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncOfflineQueue}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  🔄 Sync ข้อมูลขึ้น Server ({pendingSyncCount})
                </button>
              </div>

              {offlineQueue.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                  ยังไม่มีรายการบันทึกมิเตอร์ในคิว Offline
                </p>
              ) : (
                <div className="space-y-2.5">
                  {offlineQueue.map((item) => (
                    <div
                      key={item.client_reading_id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900">
                          {item.meternumber} • {item.inv_no}
                        </div>
                        <div className="text-slate-500">
                          {item.homeowner_name} ({item.last_meter} → {item.current_meter} m³ ={' '}
                          {item.totalpaid.toFixed(2)} ฿)
                        </div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 font-semibold ${
                          item.sync_status === 'synced'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {item.sync_status === 'synced' ? 'Synced' : 'Pending Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: LINE LIFF RESIDENT PORTAL */}
        {activeTab === 'liff' && (
          <div className="mx-auto max-w-lg rounded-3xl border border-emerald-200 bg-white p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  LINE LIFF • ระบบเช็คค่าน้ำประปาสำหรับเจ้าของบ้าน
                </span>
                <h2 className="mt-1 text-base font-bold text-slate-900">{orgInfo.org_name}</h2>
              </div>
              <select
                aria-label="เลือกมิเตอร์ลูกบ้าน"
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs font-semibold"
                value={liffSelectedMeterNo}
                onChange={(e) => setLiffSelectedMeterNo(e.target.value)}
              >
                {meters.map((m) => (
                  <option key={m.meter_id} value={m.meternumber}>
                    {m.meternumber} ({m.house_no})
                  </option>
                ))}
              </select>
            </div>

            {liffMeter && (
              <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="font-bold text-slate-900">{liffMeter.homeowner_name}</div>
                <div className="text-xs text-slate-600">
                  บ้านเลขที่ {liffMeter.house_no} • {liffMeter.zone_name} • เลขมิเตอร์{' '}
                  <span className="font-mono font-bold text-sky-700">{liffMeter.meternumber}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {liffInvoices.map((inv) => (
                <div key={inv.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      งวด {inv.period_name} ({inv.inv_no})
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        inv.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {inv.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระเงิน'}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-xs text-slate-600">
                    <div>ครั้งก่อน: {inv.lastmeter}</div>
                    <div>ครั้งนี้: {inv.currentmeter}</div>
                    <div className="font-semibold text-sky-700">ใช้ไป: {inv.water_used} m³</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-xs text-slate-500">ยอดรวมสุทธิ (รวม VAT 7%)</span>
                    <span className="font-mono text-base font-extrabold text-slate-900">
                      {inv.totalpaid.toFixed(2)} บาท
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal พิมพ์ใบแจ้งหนี้ผ่านเครื่องพิมพ์ Bluetooth (ESC/POS 58mm/80mm) */}
      {activeThermalBill && (
        <div
          role="dialog"
          aria-label="Bluetooth ESC/POS Receipt"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                🖨️ พิมพ์บิลค่าน้ำผ่านเครื่องพิมพ์ Bluetooth (ESC/POS 58mm)
              </h3>
              <button
                type="button"
                onClick={() => setActiveThermalBill(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ปิดหน้าต่าง
              </button>
            </div>

            <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs leading-relaxed text-slate-800">
              {formatThermalReceiptText(activeThermalBill)}
            </pre>

            {bluetoothPrintStatus && (
              <div className="mt-2.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                {bluetoothPrintStatus}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await printViaWebBluetooth(activeThermalBill)
                  setBluetoothPrintStatus(
                    `ส่งชุดคำสั่ง ESC/POS (${res.bytesSent} bytes) ไปยังเครื่องพิมพ์ Bluetooth สำเร็จ`,
                  )
                }}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700"
              >
                ส่งคำสั่งพิมพ์ Bluetooth ทันที
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Web Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal แสดงหน้า Keycloak Custom Tailwind Login & JWT Blacklist เมื่อ Logout */}
      {showKeycloakModal && (
        <div
          role="dialog"
          aria-label="Keycloak Custom Login"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
              JWT Blacklisted in Redis ({jwtToken})
            </span>
            <h3 className="mt-3 text-lg font-bold text-slate-900">
              Keycloak OIDC Login (Customized with Tailwind CSS)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Token เดิมถูกบันทึกเข้า Redis Blacklist เรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่
            </p>
            <div className="mt-4 space-y-3">
              <input
                defaultValue="somchai_staff"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="password"
                defaultValue="••••••••"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setJwtToken(`demo-jwt-hsg-${Date.now()}`)
                  setShowKeycloakModal(false)
                }}
                className="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-700"
              >
                Sign In with Keycloak OIDC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
