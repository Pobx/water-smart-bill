import { useState } from 'react'
import type { UserRole } from '@/features/auth'
import type { Homeowner } from '@/shared/types/waterSmartBill'
import { CreateDebtNoticeModal } from './CreateDebtNoticeModal'
import { MeterCutScreen } from './MeterCutScreen'
import type { DebtNotice, DebtNoticeStatus } from './debtManagementApi'
import { useDebtManagement } from './useDebtManagement'

export interface DebtNoticeListScreenProps {
  token?: string
  currentRole: UserRole
  homeowners?: Homeowner[]
}

const STATUS_BADGES: Record<DebtNoticeStatus, { label: string; className: string }> = {
  pending: {
    label: 'รอดำเนินการ',
    className: 'bg-amber-50 text-amber-800 ring-1 ring-amber-500/30',
  },
  sent: {
    label: 'ส่งใบแจ้งเตือนแล้ว',
    className: 'bg-sky-50 text-sky-800 ring-1 ring-sky-500/30',
  },
  cut: {
    label: 'ตัดมิเตอร์แล้ว',
    className: 'bg-rose-50 text-rose-800 ring-1 ring-rose-500/30',
  },
  restored: {
    label: 'เปิดคืนมิเตอร์แล้ว',
    className: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30',
  },
}

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'sent', label: 'ส่งใบแจ้งเตือนแล้ว' },
  { value: 'cut', label: 'ตัดมิเตอร์แล้ว' },
  { value: 'restored', label: 'เปิดคืนมิเตอร์แล้ว' },
]

export function DebtNoticeListScreen({
  token,
  currentRole,
  homeowners = [],
}: DebtNoticeListScreenProps) {
  const {
    notices,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    reload,
    getOutstanding,
    createNotice,
    cut,
    restore,
  } = useDebtManagement({ token })

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null)

  const selectedNotice: DebtNotice | undefined = notices.find(
    (n) => n.id === selectedNoticeId
  )
  const isAdmin = currentRole === 'admin'
  const canOperateMeter = currentRole === 'admin' || currentRole === 'tabwater_staff'

  if (selectedNotice) {
    return (
      <MeterCutScreen
        notice={selectedNotice}
        onFetchOutstanding={getOutstanding}
        onCut={async (id, meterReading) => {
          await cut(id, meterReading)
        }}
        onRestore={async (id) => {
          await restore(id)
        }}
        onBack={() => setSelectedNoticeId(null)}
      />
    )
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            ระบบแจ้งเตือนหนี้ค้างชำระ & ตัด/เปิดมิเตอร์น้ำ
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            ออกใบแจ้งเตือนค้างชำระ (Admin) และบันทึกการตัด-เปิดคืนมิเตอร์น้ำภาคสนาม (Staff)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            รีเฟรช
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
            >
              + สร้างใบแจ้งเตือนหนี้
            </button>
          )}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
        >
          {error}
        </div>
      )}

      {/* Debt Notices Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">ลูกบ้าน / บ้านเลขที่</th>
                <th className="px-4 py-3">จำนวนรอบค้าง</th>
                <th className="px-4 py-3">ยอดรวมค้างชำระ</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && notices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    กำลังโหลดรายการใบแจ้งเตือนหนี้...
                  </td>
                </tr>
              ) : notices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    ยังไม่มีรายการใบแจ้งเตือนหนี้ค้างชำระ
                  </td>
                </tr>
              ) : (
                notices.map((notice) => {
                  const badge = STATUS_BADGES[notice.status] ?? STATUS_BADGES.pending
                  const canCut = notice.status === 'pending' || notice.status === 'sent'
                  const canRestore = notice.status === 'cut'
                  return (
                    <tr key={notice.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {notice.homeowner_name ?? `ผู้ใช้ #${notice.user_id}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {notice.house_no ? `บ้านเลขที่ ${notice.house_no}` : `ID: ${notice.user_id}`}
                          {notice.meternumber ? ` • มิเตอร์ ${notice.meternumber}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {notice.invoice_ids.length} รอบบิล
                      </td>
                      <td className="px-4 py-3 font-bold text-rose-700">
                        ฿{notice.total_overdue_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canOperateMeter && canCut && (
                          <button
                            type="button"
                            onClick={() => setSelectedNoticeId(notice.id)}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                          >
                            ตัดมิเตอร์
                          </button>
                        )}
                        {canOperateMeter && canRestore && (
                          <button
                            type="button"
                            onClick={() => setSelectedNoticeId(notice.id)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            บันทึกเปิดคืน
                          </button>
                        )}
                        {notice.status === 'restored' && (
                          <span className="text-[11px] font-medium text-slate-400">
                            เสร็จสิ้น
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Create Modal */}
      {isAdmin && (
        <CreateDebtNoticeModal
          open={isCreateOpen}
          homeowners={homeowners}
          onFetchOutstanding={getOutstanding}
          onConfirm={async (payload) => {
            await createNotice(payload)
          }}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  )
}
