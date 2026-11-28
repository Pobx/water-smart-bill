import { useEffect, useMemo, useRef, useState } from 'react'
import type { Homeowner } from '@/shared/types/waterSmartBill'
import type {
  CreateDebtNoticePayload,
  DebtNotice,
  OutstandingBalanceResponse,
} from './debtManagementApi'

export interface CreateDebtNoticeModalProps {
  open: boolean
  homeowners: Homeowner[]
  onFetchOutstanding: (userId: number) => Promise<OutstandingBalanceResponse>
  onConfirm: (payload: CreateDebtNoticePayload) => Promise<DebtNotice | void>
  onClose: () => void
}

export function CreateDebtNoticeModal({
  open,
  homeowners,
  onFetchOutstanding,
  onConfirm,
  onClose,
}: CreateDebtNoticeModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<Homeowner | null>(null)
  const [outstanding, setOutstanding] = useState<OutstandingBalanceResponse | null>(null)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([])
  const [loadingOutstanding, setLoadingOutstanding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeqRef = useRef(0)

  // Reset modal state cleanly whenever modal closes so reopening starts fresh
  useEffect(() => {
    if (!open) {
      requestSeqRef.current += 1
      setSearchQuery('')
      setSelectedUser(null)
      setOutstanding(null)
      setSelectedInvoiceIds([])
      setLoadingOutstanding(false)
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  const filteredHomeowners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return homeowners
    return homeowners.filter((h) => {
      const fullName = `${h.prefix}${h.firstname} ${h.lastname}`.toLowerCase()
      return (
        fullName.includes(q) ||
        h.house_no.toLowerCase().includes(q) ||
        String(h.id) === q
      )
    })
  }, [homeowners, searchQuery])

  const selectedTotal = useMemo(() => {
    if (!outstanding) return 0
    return outstanding.invoices
      .filter((inv) => selectedInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + inv.totalpaid, 0)
  }, [outstanding, selectedInvoiceIds])

  if (!open) return null

  const handleSelectUser = async (user: Homeowner) => {
    const seq = ++requestSeqRef.current
    setSelectedUser(user)
    setOutstanding(null)
    setSelectedInvoiceIds([])
    setError(null)
    setLoadingOutstanding(true)
    try {
      const data = await onFetchOutstanding(user.id)
      if (seq !== requestSeqRef.current) return
      const invoices = data.invoices ?? []
      setOutstanding({ ...data, invoices })
      setSelectedInvoiceIds(invoices.map((inv) => inv.id))
    } catch (err) {
      if (seq !== requestSeqRef.current) return
      setError(err instanceof Error ? err.message : 'ไม่สามารถดึงยอดค้างชำระได้')
    } finally {
      if (seq === requestSeqRef.current) {
        setLoadingOutstanding(false)
      }
    }
  }

  const toggleInvoice = (invoiceId: number) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId]
    )
  }

  const handleConfirm = async () => {
    if (!selectedUser || selectedInvoiceIds.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({
        user_id: selectedUser.id,
        invoice_ids: selectedInvoiceIds,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถสร้างใบแจ้งเตือนหนี้ได้')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="สร้างใบแจ้งเตือนหนี้ค้างชำระ"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">สร้างใบแจ้งเตือนหนี้ค้างชำระ</h2>
            <p className="text-xs text-slate-500">
              ขั้นตอนที่ 1: ค้นหาลูกบ้าน → ขั้นตอนที่ 2: ตรวจสอบบิลค้างชำระ → ขั้นตอนที่ 3: ยืนยันสร้าง
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* Step 1: Search & Select Homeowner */}
          <div className="space-y-2">
            <label
              htmlFor="debt-user-search"
              className="block text-xs font-semibold text-slate-700"
            >
              1. ค้นหาและเลือกลูกบ้าน
            </label>
            <input
              id="debt-user-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ-สกุล หรือบ้านเลขที่..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {filteredHomeowners.length === 0 ? (
                <p className="py-3 text-center text-xs text-slate-500">ไม่พบข้อมูลลูกบ้าน</p>
              ) : (
                filteredHomeowners.map((h) => {
                  const isSelected = selectedUser?.id === h.id
                  const fullName = `${h.prefix}${h.firstname} ${h.lastname}`.trim()
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => void handleSelectUser(h)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                        isSelected
                          ? 'bg-sky-600 font-semibold text-white'
                          : 'bg-white text-slate-700 hover:bg-sky-50'
                      }`}
                    >
                      <span>{fullName}</span>
                      <span className={isSelected ? 'text-sky-100' : 'text-slate-500'}>
                        บ้านเลขที่ {h.house_no}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Step 2: Outstanding Invoices */}
          {selectedUser && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800">
                  2. รายการบิลค้างชำระของ {selectedUser.prefix}
                  {selectedUser.firstname} {selectedUser.lastname}
                </h3>
                {outstanding && (
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                    ยอดรวมค้างชำระ ฿{outstanding.total.toFixed(2)}
                  </span>
                )}
              </div>

              {loadingOutstanding && (
                <p className="py-4 text-center text-xs text-slate-500">
                  กำลังดึงข้อมูลยอดค้างชำระ...
                </p>
              )}

              {!loadingOutstanding && outstanding && outstanding.invoices.length === 0 && (
                <p className="py-3 text-center text-xs text-emerald-700">
                  ลูกบ้านรายนี้ไม่มียอดค้างชำระ
                </p>
              )}

              {!loadingOutstanding && outstanding && outstanding.invoices.length > 0 && (
                <div className="space-y-2">
                  {outstanding.invoices.map((inv) => {
                    const checked = selectedInvoiceIds.includes(inv.id)
                    return (
                      <label
                        key={inv.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInvoice(inv.id)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">{inv.inv_no}</div>
                            <div className="text-[11px] text-slate-500">
                              รอบบิล {inv.period_name} • ใช้น้ำ {inv.water_used} หน่วย
                            </div>
                          </div>
                        </div>
                        <span className="font-bold text-slate-900">
                          ฿{inv.totalpaid.toFixed(2)}
                        </span>
                      </label>
                    )
                  })}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-bold text-slate-900">
                    <span>เลือกแล้ว {selectedInvoiceIds.length} รอบบิล</span>
                    <span>ยอดรวมที่เลือก ฿{selectedTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {error}
            </div>
          )}
        </div>

        {/* Step 3: Actions */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!selectedUser || selectedInvoiceIds.length === 0 || submitting || loadingOutstanding}
            onClick={() => void handleConfirm()}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันสร้างใบแจ้งเตือนหนี้'}
          </button>
        </div>
      </div>
    </div>
  )
}
