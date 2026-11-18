import { useState } from 'react'
import { AuthModal, useAuth } from '@/features/auth'
import { MasterDataScreen, useMasterData } from '@/features/master-data'
import { TariffsMetersScreen, useTariffsMeters } from '@/features/tariffs-meters'
import { FieldReaderScreen, useFieldReader } from '@/features/field-reader'
import { LiffPortalScreen, useLiffPortal } from '@/features/liff-portal'

export function App() {
  const [activeTab, setActiveTab] = useState<'master' | 'tariffs' | 'reader' | 'liff'>('master')

  // Vertical Slice 1: Auth & Redis JWT Blacklist
  const auth = useAuth()

  // Vertical Slice 2: Master Data (อบต., ตำบล, หมู่บ้าน, บ้านเลขที่ & เจ้าของบ้าน + Default Avatar)
  const masterData = useMasterData()

  // Vertical Slice 3: Progressive Tariffs, Billing Periods & Water Meters
  const tariffsMeters = useTariffsMeters(masterData.homeowners)

  // Vertical Slice 4: LINE LIFF Resident Portal
  const liffPortal = useLiffPortal(tariffsMeters.meters)

  // Vertical Slice 5: Offline-First Field Meter Reader, AI OCR & Web Bluetooth ESC/POS Printer
  const fieldReader = useFieldReader({
    orgInfo: masterData.orgInfo,
    meters: tariffsMeters.meters,
    setMeters: tariffsMeters.setMeters,
    tiers: tariffsMeters.tiers,
    reserveFee: tariffsMeters.reserveFee,
    periods: tariffsMeters.periods,
    invoices: liffPortal.invoices,
    setInvoices: liffPortal.setInvoices,
  })

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
                {masterData.orgInfo.org_name} • ต.{masterData.orgInfo.tambon_name} อ.
                {masterData.orgInfo.district_name} จ.{masterData.orgInfo.province_name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                fieldReader.isOfflineMode
                  ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/30'
                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  fieldReader.isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              {fieldReader.isOfflineMode
                ? `Offline-First Mode (${fieldReader.pendingSyncCount} รอซิงค์)`
                : 'Online Connected'}
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
              onClick={auth.handleLogoutAndBlacklistJwt}
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

      {/* Main Content Composing Vertical Slice Screens */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {activeTab === 'master' && <MasterDataScreen {...masterData} />}

        {activeTab === 'tariffs' && (
          <TariffsMetersScreen
            {...tariffsMeters}
            vatRate={masterData.orgInfo.vat}
            homeowners={masterData.homeowners}
          />
        )}

        {activeTab === 'reader' && (
          <FieldReaderScreen
            {...fieldReader}
            meters={tariffsMeters.meters}
            periods={tariffsMeters.periods}
          />
        )}

        {activeTab === 'liff' && (
          <LiffPortalScreen
            {...liffPortal}
            orgName={masterData.orgInfo.org_name}
            meters={tariffsMeters.meters}
          />
        )}
      </main>

      <AuthModal
        jwtToken={auth.jwtToken}
        showKeycloakModal={auth.showKeycloakModal}
        onSignIn={auth.handleSignInWithKeycloak}
      />
    </div>
  )
}
