import type { WaterMeterItem } from '@/shared/types/waterSmartBill'
import type { useLiffPortal } from './useLiffPortal'

export interface LiffPortalScreenProps extends ReturnType<typeof useLiffPortal> {
  orgName: string
  meters: WaterMeterItem[]
}

export function LiffPortalScreen({
  orgName,
  meters,
  liffSelectedMeterNo,
  setLiffSelectedMeterNo,
  liffInvoices,
  liffMeter,
}: LiffPortalScreenProps) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-emerald-200 bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            LINE LIFF • ระบบเช็คค่าน้ำประปาสำหรับเจ้าของบ้าน
          </span>
          <h2 className="mt-1 text-base font-bold text-slate-900">{orgName}</h2>
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
              <span className="text-xs font-bold text-slate-900">
                งวด <span className="font-mono">{inv.period_name}</span> (<span className="font-mono">{inv.inv_no}</span>)
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
              <div>ครั้งก่อน: <span className="font-mono">{inv.lastmeter}</span></div>
              <div>ครั้งนี้: <span className="font-mono">{inv.currentmeter}</span></div>
              <div className="font-semibold text-sky-700">ใช้ไป: <span className="font-mono">{inv.water_used}</span> m³</div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
              <span className="text-xs text-slate-500">ยอดรวมสุทธิ (รวม VAT 7%)</span>
              <span className="text-base font-extrabold text-slate-900">
                <span className="font-mono">฿{inv.totalpaid.toFixed(2)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
