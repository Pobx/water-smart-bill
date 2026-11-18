import { formatThermalReceiptText, printViaWebBluetooth } from '@/features/printer/escpos'
import type { WaterMeterItem } from '@/shared/types/waterSmartBill'
import type { useFieldReader } from './useFieldReader'

export interface FieldReaderScreenProps extends ReturnType<typeof useFieldReader> {
  meters: WaterMeterItem[]
  periods: string[]
}

export function FieldReaderScreen({
  meters,
  periods,
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
}: FieldReaderScreenProps) {
  return (
    <>
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
    </>
  )
}
