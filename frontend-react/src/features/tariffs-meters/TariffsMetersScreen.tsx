import { NumericInput, SearchableSelect } from '@/shared/ui'
import type { Homeowner } from '@/shared/types/waterSmartBill'
import type { useTariffsMeters } from './useTariffsMeters'
import { TierEditor } from './TierEditor'

export interface TariffsMetersScreenProps extends ReturnType<typeof useTariffsMeters> {
  vatRate: number
  homeowners: Homeowner[]
}

export function TariffsMetersScreen({
  vatRate,
  homeowners,
  reserveFee,
  tiers,
  isSavingRateConfig,
  rateConfigError,
  rateConfigSuccess,
  handleSaveRateConfig,
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

        <TierEditor
          vatRate={vatRate}
          reserveFee={reserveFee}
          tiers={tiers}
          onSave={handleSaveRateConfig}
          isSaving={isSavingRateConfig}
          errorMessage={rateConfigError}
          successMessage={rateConfigSuccess}
        />

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
            <SearchableSelect
              ariaLabel="เจ้าของบ้าน"
              options={homeowners.map((h) => ({
                value: h.id,
                label: `${h.firstname} (${h.house_no})`,
              }))}
              value={newMeterOwnerId}
              onChange={(val) => setNewMeterOwnerId(val)}
            />
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
              <NumericInput
                aria-label="เลขตั้งต้น"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                value={newMeterInitialReading}
                decimalScale={2}
                onValueChange={(raw) => setNewMeterInitialReading(raw)}
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

        {/* ตารางทะเบียนมิเตอร์ (Desktop: md ขึ้นไป) */}
        <div className="mt-5 hidden md:block overflow-x-auto">
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

        {/* รายการทะเบียนมิเตอร์แบบการ์ด (Mobile: เล็กกว่า md) */}
        <div className="mt-4 block md:hidden space-y-2.5">
          {meters.map((m) => (
            <div
              key={m.meter_id}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                  {m.meternumber}
                </span>
                <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {m.last_meter_recording} m³
                </span>
              </div>
              <div className="text-xs">
                <div className="font-semibold text-slate-900">{m.homeowner_name}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  บ้านเลขที่ {m.house_no} • {m.zone_name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
