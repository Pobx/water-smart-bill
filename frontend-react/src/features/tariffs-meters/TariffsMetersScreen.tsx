import type { Homeowner } from '@/shared/types/waterSmartBill'
import type { useTariffsMeters } from './useTariffsMeters'

export interface TariffsMetersScreenProps extends ReturnType<typeof useTariffsMeters> {
  vatRate: number
  homeowners: Homeowner[]
}

export function TariffsMetersScreen({
  vatRate,
  homeowners,
  reserveFee,
  setReserveFee,
  tiers,
  setTiers,
  newPeriodName,
  setNewPeriodName,
  meters,
  newMeterOwnerId,
  setNewMeterOwnerId,
  newMeterNumber,
  setNewMeterNumber,
  newMeterInitialReading,
  setNewMeterInitialReading,
  handleRegisterMeter,
  handleCreatePeriod,
}: TariffsMetersScreenProps) {
  return (
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
              value={vatRate}
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
              onClick={handleCreatePeriod}
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
  )
}
