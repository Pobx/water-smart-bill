import { useEffect, useState } from 'react'
import { AuthModal, ROLE_OPTIONS, useAuth, type UserRole } from '@/features/auth'
import { MasterDataScreen, useMasterData } from '@/features/master-data'
import { TariffsMetersScreen, useTariffsMeters } from '@/features/tariffs-meters'
import { FieldReaderScreen, useFieldReader } from '@/features/field-reader'
import { LiffPortalScreen, useLiffPortal } from '@/features/liff-portal'
import { FinanceCashierScreen } from '@/features/finance-cashier'

export type TabKey = 'master' | 'tariffs' | 'reader' | 'cashier' | 'liff'

export interface MenuItem {
  id: TabKey
  label: string
  shortLabel: string
  icon: string
  allowedRoles: UserRole[]
  description: string
}

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'master',
    label: '1. ข้อมูล อบต. / หมู่บ้าน / เจ้าของบ้าน (Avatar)',
    shortLabel: 'ข้อมูล อบต. & ลูกบ้าน',
    icon: '🏛️',
    allowedRoles: ['admin'],
    description: 'จัดการข้อมูล อบต., โซน/หมู่บ้าน และเจ้าของบ้าน',
  },
  {
    id: 'tariffs',
    label: '2. อัตราค่าน้ำ & ทะเบียนมิเตอร์น้ำ',
    shortLabel: 'อัตราค่าน้ำ & มิเตอร์',
    icon: '📊',
    allowedRoles: ['admin', 'tabwater_staff', 'finance_staff'],
    description: 'กำหนดอัตราค่าน้ำขั้นบันได และค้นหาทะเบียนมิเตอร์น้ำ',
  },
  {
    id: 'reader',
    label: '3. จดมิเตอร์ & ออกบิล Bluetooth (Offline + OCR)',
    shortLabel: 'จดมิเตอร์ภาคสนาม (OCR)',
    icon: '📱',
    allowedRoles: ['admin', 'tabwater_staff'],
    description: 'จดเลขมิเตอร์ออฟไลน์, สแกนรูปถ่าย OCR, พิมพ์ใบแจ้งหนี้ Bluetooth',
  },
  {
    id: 'cashier',
    label: '4. การเงิน & รับชำระ (Finance & Cashier)',
    shortLabel: 'การเงิน & รับชำระ',
    icon: '💰',
    allowedRoles: ['admin', 'finance_staff'],
    description: 'เคาน์เตอร์รับชำระเงินสด/QR, ออกใบเสร็จรับเงิน, รายงานยอดจัดเก็บ',
  },
  {
    id: 'liff',
    label: '5. LINE LIFF ลูกบ้าน',
    shortLabel: 'LINE LIFF ลูกบ้าน',
    icon: '💬',
    allowedRoles: ['admin', 'user'],
    description: 'พอร์ทัลประชาชน ตรวจสอบประวัติค่าน้ำ และสแกนชำระ',
  },
]

export function App() {
  const auth = useAuth()
  const masterData = useMasterData()
  const tariffsMeters = useTariffsMeters(masterData.homeowners)
  const liffPortal = useLiffPortal(tariffsMeters.meters)
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

  // Filter menu items by user's current role (RBAC)
  const permittedMenuItems = MENU_ITEMS.filter((item) =>
    item.allowedRoles.includes(auth.currentRole)
  )

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('tab') as TabKey
      if (param && ['master', 'tariffs', 'reader', 'cashier', 'liff'].includes(param)) {
        return param
      }
    }
    return 'master'
  })

  // Auto-switch to first permitted tab if active tab becomes forbidden on role change
  useEffect(() => {
    if (permittedMenuItems.length > 0 && !permittedMenuItems.some((m) => m.id === activeTab)) {
      setActiveTab(permittedMenuItems[0].id)
    }
  }, [auth.currentRole, permittedMenuItems, activeTab])

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Left Menu Sidebar with RBAC */}
      <aside
        aria-label="Left Sidebar"
        className="sticky top-0 flex h-screen w-72 shrink-0 flex-col justify-between border-r border-slate-200 bg-white/95 p-4 shadow-xs backdrop-blur"
      >
        <div className="space-y-4">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 font-bold text-white shadow-xs">
              💧
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900">
                Water Smart Bill
              </h1>
              <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-600/20">
                ระบบบริหารจัดการน้ำประปา อบต.
              </span>
            </div>
          </div>

          {/* Role Switcher Card (RBAC Control) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="text-sm">🛡️</span> สิทธิ์ผู้ใช้ (Role RBAC)
              </span>
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                {auth.currentRole}
              </span>
            </div>
            <div className="mt-2">
              <select
                aria-label="เลือกบทบาท (Role)"
                value={auth.currentRole}
                onChange={(e) => auth.setCurrentRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-2xs focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.icon} {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {ROLE_OPTIONS.find((o) => o.id === auth.currentRole)?.description}
            </p>
          </div>

          {/* Left Menu Items Navigation */}
          <nav aria-label="เมนูระบบ" className="space-y-1.5">
            <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              เมนูตามสิทธิ์การใช้งาน
            </div>
            {permittedMenuItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{item.label}</div>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-2.5 border-t border-slate-100 pt-3">
          <span
            className={`flex w-full items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-center text-[11px] font-medium ${
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
              ? `Offline Mode (${fieldReader.pendingSyncCount} รอซิงค์)`
              : 'Online Connected'}
          </span>

          <a
            href="/swagger/index.html"
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Swagger API (Non-Prod)
          </a>

          <button
            type="button"
            onClick={auth.handleLogout}
            className="flex w-full items-center justify-center rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-rose-700"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              {masterData.orgInfo.org_name}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500">
              ต.{masterData.orgInfo.tambon_name} อ.{masterData.orgInfo.district_name} จ.{masterData.orgInfo.province_name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              ผู้ใช้: somchai_staff
            </span>
          </div>
        </header>

        {/* Screen Content */}
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
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

          {activeTab === 'cashier' && (
            <FinanceCashierScreen
              token={auth.jwtToken}
              invoices={liffPortal.invoices}
              onInvoicePaid={(updated) =>
                liffPortal.setInvoices((prev) =>
                  prev.map((inv) => (inv.id === updated.id ? updated : inv))
                )
              }
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
      </div>

      <AuthModal
        jwtToken={auth.jwtToken}
        showKeycloakModal={auth.showKeycloakModal}
        onSignIn={auth.handleSignInWithKeycloak}
      />
    </div>
  )
}
