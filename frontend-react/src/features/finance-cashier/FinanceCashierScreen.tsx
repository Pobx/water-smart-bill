import { useFinanceCashier } from './useFinanceCashier'
import type { WaterInvoiceItem } from '@/shared/types/waterSmartBill'

export interface FinanceCashierScreenProps {
  token?: string
  invoices?: WaterInvoiceItem[]
  onInvoicePaid?: (inv: WaterInvoiceItem) => void
}

export function FinanceCashierScreen({ token, invoices, onInvoicePaid }: FinanceCashierScreenProps) {
  const {
    filteredInvoices,
    report,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    selectedInvoiceForPayment,
    handleOpenPayment,
    handleClosePayment,
    paymentMethod,
    setPaymentMethod,
    cashTendered,
    setCashTendered,
    cashChange,
    isCashSufficient,
    handleConfirmPayment,
    receiptModalInvoice,
    setReceiptModalInvoice,
    handlePrintReceipt,
    handleDownloadCSV,
    isProcessing,
    message,
    loadData,
  } = useFinanceCashier({ token, initialInvoices: invoices, onInvoicePaid })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg font-bold text-xl">
              💰
            </span>
            <h1 className="text-2xl font-bold text-slate-900">
              ระบบการเงินและรับชำระค่าน้ำ (Finance & Cashier Desk)
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            เคาน์เตอร์บริการจัดเก็บค่าน้ำประปาประจำสำนักงาน อบต. ออกใบเสร็จรับเงิน และสรุปรายงานการจัดเก็บ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🔄</span> รีเฟรช
          </button>
          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <span>📥</span> ส่งออกรายงาน CSV
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 border ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{message.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            ยอดจัดเก็บรวม
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            ฿{report?.total_collected.toLocaleString('th-TH', { minimumFractionDigits: 2 }) ?? '0.00'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            เงินสด: ฿{(report?.total_cash ?? 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            บิลชำระแล้ว
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-2">
            {report?.paid_invoices ?? 0}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {report?.total_invoices ?? 0} บิล
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{
                width: `${
                  report && report.total_invoices > 0
                    ? (report.paid_invoices / report.total_invoices) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            ค้างชำระ (รอดำเนินการ)
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {report?.unpaid_invoices ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            พร้อมรับชำระที่เคาน์เตอร์ อบต.
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            หน่วยน้ำที่ใช้น้ำรวม
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            {(report?.total_units_used ?? 0).toLocaleString()}{' '}
            <span className="text-sm font-normal text-slate-500">หน่วย (ลบ.ม.)</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            VAT รวม: ฿{(report?.total_vat_amount ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({report?.total_invoices ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('unpaid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'unpaid'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            รอชำระ ({report?.unpaid_invoices ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('paid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterStatus === 'paid'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ชำระแล้ว ({report?.paid_invoices ?? 0})
          </button>
        </div>

        <div className="w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาเลขที่บิล, บ้านเลขที่, หรือชื่อผู้ใช้น้ำ..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">เลขที่บิล / งวด</th>
                <th className="px-6 py-3">บ้านเลขที่ / เจ้าของบ้าน</th>
                <th className="px-6 py-3">มิเตอร์ / หน่วยที่ใช้</th>
                <th className="px-6 py-3 text-right">ยอดรวมสุทธิ</th>
                <th className="px-6 py-3 text-center">สถานะ</th>
                <th className="px-6 py-3 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    ไม่พบรายการใบแจ้งหนี้ตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{inv.inv_no}</div>
                      <div className="text-xs text-slate-400">{inv.period_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">บ้านเลขที่ {inv.house_no}</div>
                      <div className="text-xs text-slate-500">{inv.homeowner_name} ({inv.zone_name})</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-800">{inv.meternumber}</div>
                      <div className="text-xs text-blue-600 font-medium">
                        {inv.lastmeter} ➔ {inv.currentmeter} ({inv.water_used} หน่วย)
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-base font-bold text-slate-900">
                        ฿{inv.totalpaid.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {inv.status === 'paid' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          ✓ ชำระแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          ⏳ รอชำระ
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {inv.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(inv)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          🧾 ใบเสร็จ ({inv.receipt_no || 'RC'})
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(inv)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
                        >
                          💵 รับชำระเงิน
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  รับชำระค่าน้ำประปา
                </h3>
                <p className="text-xs text-slate-500">
                  บิลเลขที่: {selectedInvoiceForPayment.inv_no}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClosePayment}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">ผู้ใช้น้ำ:</span>
                <span className="font-medium text-slate-900">
                  {selectedInvoiceForPayment.homeowner_name} (บ้านเลขที่ {selectedInvoiceForPayment.house_no})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">หน่วยน้ำที่ใช้:</span>
                <span className="font-medium text-slate-900">
                  {selectedInvoiceForPayment.water_used} หน่วย
                </span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2 text-slate-900">
                <span>ยอดเงินที่ต้องชำระ:</span>
                <span className="text-emerald-600">
                  ฿{selectedInvoiceForPayment.totalpaid.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 uppercase">
                ช่องทางการชำระเงิน
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className="p-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                >
                  <span>💵</span> เงินสด (Cash)
                </button>
                <div
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs font-medium flex flex-col items-center justify-center gap-0.5 cursor-not-allowed select-none opacity-60"
                  title="ระบบ QR Code ปิดใช้งานชั่วคราว อยู่ระหว่างศึกษาเตรียมการ"
                >
                  <span className="flex items-center gap-1 font-semibold text-slate-500">
                    <span>📱</span> โอน QR Code
                  </span>
                  <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    ปิดเตรียมการชั่วคราว
                  </span>
                </div>
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === 'cash' ? (
              <div className="space-y-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <label className="text-xs font-semibold text-emerald-900">
                  จำนวนเงินที่รับจากผู้ใช้น้ำ (บาท)
                </label>
                <input
                  type="number"
                  step="any"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-full px-3 py-2 text-lg font-bold border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="0.00"
                />
                <div className="flex justify-between items-center text-sm pt-1">
                  <span className="text-slate-600">เงินทอน (Change):</span>
                  <span
                    className={`font-bold text-base ${
                      isCashSufficient ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {isCashSufficient ? `฿${cashChange.toFixed(2)}` : 'ยอดเงินไม่เพียงพอ'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 text-center space-y-2">
                <div className="text-xs text-blue-800 font-medium">
                  สแกนชำระผ่าน PromptPay QR
                </div>
                <div className="p-3 bg-white inline-block rounded-lg shadow-sm border border-blue-200">
                  <div className="w-36 h-36 bg-slate-100 flex items-center justify-center font-mono text-xs text-slate-500">
                    [QR Code PromptPay]
                  </div>
                </div>
                <div className="text-xs text-slate-600">
                  ยอดโอน: <b className="text-blue-700">฿{selectedInvoiceForPayment.totalpaid.toFixed(2)}</b>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={handleClosePayment}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={!isCashSufficient || isProcessing}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-all ${
                  isCashSufficient && !isProcessing
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                {isProcessing ? 'กำลังบันทึก...' : 'ยืนยันรับชำระเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">
                ใบเสร็จรับเงินค่าน้ำประปา
              </h3>
              <button
                type="button"
                onClick={() => setReceiptModalInvoice(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Official SAO Receipt Layout */}
            <div className="p-5 border border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-3 font-mono text-xs text-slate-800">
              <div className="text-center space-y-0.5 border-b border-dashed pb-2">
                <div className="font-bold text-sm">องค์การบริหารส่วนตำบล</div>
                <div>ใบเสร็จรับเงินค่าน้ำประปา</div>
                <div className="text-slate-500">เลขที่: {receiptModalInvoice.receipt_no || 'RC-TEMP'}</div>
              </div>

              <div className="space-y-1">
                <div>วันที่: {receiptModalInvoice.paid_at || new Date().toLocaleString('th-TH')}</div>
                <div>ผู้ใช้น้ำ: {receiptModalInvoice.homeowner_name}</div>
                <div>บ้านเลขที่: {receiptModalInvoice.house_no} ({receiptModalInvoice.zone_name})</div>
                <div>เลขมิเตอร์: {receiptModalInvoice.meternumber}</div>
                <div>งวดบิล: {receiptModalInvoice.period_name}</div>
              </div>

              <div className="border-t border-dashed pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>เลขมิเตอร์: {receiptModalInvoice.lastmeter} ➔ {receiptModalInvoice.currentmeter}</span>
                  <span>{receiptModalInvoice.water_used} หน่วย</span>
                </div>
                <div className="flex justify-between">
                  <span>ค่าน้ำประปา:</span>
                  <span>฿{receiptModalInvoice.paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ค่ารักษามิเตอร์:</span>
                  <span>฿{receiptModalInvoice.reserve_meter.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ภาษีมูลค่าเพิ่ม 7%:</span>
                  <span>฿{receiptModalInvoice.vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-dashed pt-1 text-slate-900">
                  <span>ยอดชำระสุทธิ:</span>
                  <span>฿{receiptModalInvoice.totalpaid.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed pt-2 text-center text-slate-500">
                <div>วิธีชำระ: เงินสด</div>
                <div className="text-emerald-700 font-bold mt-1">✓ ชำระเงินเรียบร้อยแล้ว</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReceiptModalInvoice(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5"
              >
                <span>🖨️</span> พิมพ์ใบเสร็จ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
