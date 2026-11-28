import type { CollectionInvoiceItem } from './reportsApi'
import { useExcelExport } from './useExcelExport'
import { useReports } from './useReports'

export interface DailyCollectionReportProps {
  token?: string
  initialFrom?: string
  initialTo?: string
}

function formatCollectionDate(inv: CollectionInvoiceItem): string {
  const raw = inv.paid_at || inv.recorded_at || ''
  if (!raw) return '-'
  return raw.slice(0, 10)
}

function formatCashier(inv: CollectionInvoiceItem): string {
  if (inv.cashier_name) return inv.cashier_name
  if (inv.cashier_id) return `เจ้าหน้าที่ #${inv.cashier_id}`
  return inv.payment_method ? inv.payment_method : '-'
}

export function DailyCollectionReport({
  token,
  initialFrom,
  initialTo,
}: DailyCollectionReportProps) {
  const {
    from,
    to,
    setFrom,
    setTo,
    report,
    rows,
    totalUnits,
    totalAmount,
    loading,
    error,
    reload,
  } = useReports({ token, initialFrom, initialTo })

  const { exportToXlsx } = useExcelExport()

  const handleExportExcel = () => {
    const exportRows = rows.map((inv) => ({
      วันที่: formatCollectionDate(inv),
      บ้านเลขที่: inv.house_no || '-',
      ชื่อ: inv.homeowner_name || '-',
      จำนวนหน่วย: inv.water_used ?? 0,
      ยอดชำระ: Number((inv.totalpaid ?? 0).toFixed(2)),
      ผู้รับเงิน: formatCashier(inv),
    }))
    const filename = `collection-report-${from}-to-${to}.xlsx`
    exportToXlsx(exportRows, filename, 'รายงานการรับชำระ')
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-sky-50 p-2 text-xl text-sky-600">📑</span>
            <h2 className="text-xl font-bold text-slate-900">
              รายงานการรับชำระค่าน้ำประปา
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ตรวจสอบยอดจัดเก็บรายวันหรือตามช่วงวันที่ และส่งออกเป็นไฟล์ Excel (.xlsx)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ค้นหา / รีเฟรช
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || rows.length === 0}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="report-from-date"
              className="text-xs font-semibold text-slate-700"
            >
              วันที่เริ่มต้น
            </label>
            <input
              id="report-from-date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="report-to-date"
              className="text-xs font-semibold text-slate-700"
            >
              วันที่สิ้นสุด
            </label>
            <input
              id="report-to-date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="text-xs text-slate-500">
            ช่วงวันที่เลือก: <span className="font-semibold text-slate-700">{from}</span> ถึง{' '}
            <span className="font-semibold text-slate-700">{to}</span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-400">ยอดจัดเก็บรวม</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            ฿{totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            เงินสด ฿{(report?.total_cash ?? 0).toFixed(2)} • พร้อมเพย์ ฿{(report?.total_promptpay ?? 0).toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-400">จำนวนรายการ</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {rows.length} <span className="text-xs font-normal text-slate-500">รายการ</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            ชำระแล้ว {report?.paid_invoices ?? 0} / ค้างชำระ {report?.unpaid_invoices ?? 0}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-400">จำนวนหน่วยใช้น้ำรวม</div>
          <div className="mt-1 text-2xl font-bold text-sky-700">
            {totalUnits.toLocaleString('th-TH')} <span className="text-xs font-normal text-slate-500">หน่วย</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {report?.period_name || 'ทุกรอบบิลในช่วงที่เลือก'}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700"
        >
          {error}
        </div>
      )}

      {/* Report Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">
                  วันที่
                </th>
                <th scope="col" className="px-4 py-3">
                  บ้านเลขที่
                </th>
                <th scope="col" className="px-4 py-3">
                  ชื่อ
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  จำนวนหน่วย
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  ยอดชำระ
                </th>
                <th scope="col" className="px-4 py-3">
                  ผู้รับเงิน
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    กำลังโหลดข้อมูลรายงาน...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    ไม่พบรายการรับชำระในช่วงวันที่ที่เลือก
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatCollectionDate(inv)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                      {inv.house_no || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{inv.homeowner_name || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {inv.water_used}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-700">
                      {inv.totalpaid.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatCashier(inv)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right">
                  ยอดรวมทั้งหมด ({rows.length} รายการ)
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{totalUnits}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">
                  {totalAmount.toFixed(2)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  )
}
