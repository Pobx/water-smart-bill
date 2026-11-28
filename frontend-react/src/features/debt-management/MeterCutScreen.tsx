import { useEffect, useState } from 'react'
import type { DebtNotice, OutstandingBalanceResponse } from './debtManagementApi'

export interface MeterCutScreenProps {
  notice: DebtNotice
  outstandingTotal?: number
  onFetchOutstanding?: (userId: number) => Promise<OutstandingBalanceResponse>
  onCut: (noticeId: string, meterReading: number) => Promise<DebtNotice | void>
  onRestore: (noticeId: string) => Promise<DebtNotice | void>
  onBack?: () => void
}

const STATUS_LABELS: Record<DebtNotice['status'], string> = {
  pending: 'รอดำเนินการตัดมิเตอร์',
  sent: 'ส่งใบแจ้งเตือนแล้ว',
  cut: 'ตัดมิเตอร์แล้ว',
  restored: 'เปิดคืนมิเตอร์แล้ว',
}

export function MeterCutScreen({
  notice,
  outstandingTotal,
  onFetchOutstanding,
  onCut,
  onRestore,
  onBack,
}: MeterCutScreenProps) {
  const [meterReadingInput, setMeterReadingInput] = useState<string>(
    notice.cut_meter_reading != null ? String(notice.cut_meter_reading) : ''
  )
  const [fetchedOutstanding, setFetchedOutstanding] = useState<number | null>(null)
  const [loadingOutstanding, setLoadingOutstanding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (outstandingTotal !== undefined || notice.status !== 'cut' || !onFetchOutstanding) {
      return
    }
    let cancelled = false
    setLoadingOutstanding(true)
    onFetchOutstanding(notice.user_id)
      .then((res) => {
        if (!cancelled) {
          setFetchedOutstanding(res.total)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedOutstanding(notice.total_overdue_amount)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOutstanding(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [notice.status, notice.user_id, notice.total_overdue_amount, onFetchOutstanding, outstandingTotal])

  const effectiveOutstanding =
    outstandingTotal !== undefined
      ? outstandingTotal
      : fetchedOutstanding !== null
        ? fetchedOutstanding
        : notice.total_overdue_amount

  const handleCutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = Number(meterReadingInput)
    if (meterReadingInput.trim() === '' || Number.isNaN(parsed) || parsed < 0) {
      setError('กรุณากรอกเลขมิเตอร์ล่าสุดเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await onCut(notice.id, parsed)
      setSuccessMsg('บันทึกการตัดมิเตอร์เรียบร้อยแล้ว')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกการตัดมิเตอร์ได้')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRestoreClick = async () => {
    if (effectiveOutstanding > 0) return
    setSubmitting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await onRestore(notice.id)
      setSuccessMsg('บันทึกการเปิดคืนมิเตอร์เรียบร้อยแล้ว')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถเปิดคืนมิเตอร์ได้')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            บันทึกการตัด / เปิดคืนมิเตอร์น้ำ
          </h2>
          <p className="text-xs text-slate-500">
            ใบแจ้งเตือนเลขที่ {notice.id} • {notice.homeowner_name ?? `ผู้ใช้ #${notice.user_id}`}
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← กลับหน้ารายการ
          </button>
        )}
      </div>

      {/* Notice Summary Card */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-slate-500">เจ้าของบ้าน / บ้านเลขที่</div>
          <div className="mt-0.5 font-semibold text-slate-900">
            {notice.homeowner_name ?? `ผู้ใช้ #${notice.user_id}`}
            {notice.house_no ? ` (${notice.house_no})` : ''}
          </div>
        </div>
        <div>
          <div className="text-slate-500">เลขที่มิเตอร์</div>
          <div className="mt-0.5 font-semibold text-slate-900">
            {notice.meternumber || '-'}
          </div>
        </div>
        <div>
          <div className="text-slate-500">ยอดค้างในใบแจ้งเตือน ({notice.invoice_ids.length} รอบบิล)</div>
          <div className="mt-0.5 font-bold text-rose-700">
            ฿{notice.total_overdue_amount.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-slate-500">สถานะปัจจุบัน</div>
          <div className="mt-0.5 font-semibold text-slate-900">
            {STATUS_LABELS[notice.status]}
          </div>
        </div>
      </div>

      {/* Cut Meter Form (for pending / sent notices) */}
      {(notice.status === 'pending' || notice.status === 'sent') && (
        <form onSubmit={(e) => void handleCutSubmit(e)} className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-sm font-bold text-slate-900">ดำเนินการตัดมิเตอร์น้ำ</h3>
          <div className="max-w-sm space-y-1.5">
            <label
              htmlFor="meter-reading-input"
              className="block text-xs font-semibold text-slate-700"
            >
              เลขมิเตอร์ล่าสุด (meter_reading)
            </label>
            <input
              id="meter-reading-input"
              name="meter_reading"
              type="number"
              step="any"
              min="0"
              required
              value={meterReadingInput}
              onChange={(e) => setMeterReadingInput(e.target.value)}
              placeholder="เช่น 125.5"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : 'ยืนยันตัดมิเตอร์'}
          </button>
        </form>
      )}

      {/* Restore Meter Section (for cut notices) */}
      {notice.status === 'cut' && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">บันทึกเปิดคืนมิเตอร์น้ำ</h3>
              <p className="text-xs text-slate-600">
                เลขมิเตอร์ตอนตัด: {notice.cut_meter_reading ?? '-'} • ยอดค้างชำระคงเหลือ:{' '}
                <span className={effectiveOutstanding > 0 ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>
                  {loadingOutstanding ? 'กำลังตรวจสอบ...' : `฿${effectiveOutstanding.toFixed(2)}`}
                </span>
              </p>
            </div>
            <button
              type="button"
              disabled={effectiveOutstanding > 0 || loadingOutstanding || submitting}
              onClick={() => void handleRestoreClick()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'กำลังบันทึก...' : 'บันทึกเปิดคืนมิเตอร์'}
            </button>
          </div>
          {effectiveOutstanding > 0 && (
            <p className="text-xs font-medium text-rose-700">
              ยังไม่สามารถเปิดคืนมิเตอร์ได้ เนื่องจากลูกบ้านยังมียอดค้างชำระคงเหลือ กรุณาชำระให้ครบก่อน
            </p>
          )}
        </div>
      )}

      {/* Restored Confirmation */}
      {notice.status === 'restored' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          มิเตอร์น้ำเปิดคืนใช้งานเรียบร้อยแล้ว
          {notice.restored_at ? ` (${notice.restored_at})` : ''}
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

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          {successMsg}
        </div>
      )}
    </section>
  )
}
