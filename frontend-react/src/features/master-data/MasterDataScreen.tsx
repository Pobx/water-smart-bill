import { resolveAvatarUrl } from '@/features/billing/utils/waterBillCalculator'
import type { useMasterData } from './useMasterData'

export type MasterDataScreenProps = ReturnType<typeof useMasterData>

export function MasterDataScreen({
  orgInfo,
  setOrgInfo,
  zones,
  newZoneMoo,
  setNewZoneMoo,
  newZoneName,
  setNewZoneName,
  newSubzoneName,
  setNewSubzoneName,
  homeowners,
  prefix,
  setPrefix,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  houseNo,
  setHouseNo,
  selectedZoneId,
  setSelectedZoneId,
  phone,
  setPhone,
  setUploadedAvatarDataUrl,
  handleAddVillage,
  handleAddHomeowner,
}: MasterDataScreenProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ข้อมูล อบต. และ ตำบล */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">ข้อมูล อบต. และพื้นที่ตำบล</h2>
              <p className="text-xs text-slate-500">ตาราง organizations, provinces, districts, tambons</p>
            </div>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
              {orgInfo.org_code}
            </span>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">ชื่อองค์การบริหารส่วนตำบล (อบต.)</label>
              <input
                aria-label="ชื่อ อบต."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={orgInfo.org_name}
                onChange={(e) => setOrgInfo({ ...orgInfo, org_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">ตำบล</label>
                <input
                  aria-label="ตำบล"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={orgInfo.tambon_name}
                  onChange={(e) => setOrgInfo({ ...orgInfo, tambon_name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">อำเภอ</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={orgInfo.district_name}
                  readOnly
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">จังหวัด</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={orgInfo.province_name}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* เพิ่มหมู่บ้าน (Zones / Subzones) */}
          <form onSubmit={handleAddVillage} className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-sm font-bold text-slate-900">จัดการหมู่บ้าน (Zones) & สายจดมิเตอร์</h3>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="หมู่ที่"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                value={newZoneMoo}
                onChange={(e) => setNewZoneMoo(e.target.value)}
              />
              <input
                placeholder="ชื่อหมู่บ้าน (เช่น บ้านดอน)"
                className="col-span-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <input
                placeholder="สายจดมิเตอร์ / คุ้ม"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                value={newSubzoneName}
                onChange={(e) => setNewSubzoneName(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                + เพิ่มหมู่บ้าน
              </button>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                  <span className="font-medium text-slate-800">{z.zone_name}</span>
                  <span className="text-slate-500">{z.subzone_name}</span>
                </li>
              ))}
            </ul>
          </form>
        </div>

        {/* ฟอร์มบันทึกบ้านเลขที่และเจ้าของบ้าน + Avatar Upload & Default Avatar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                บันทึกบ้านเลขที่และเจ้าของบ้าน (พร้อมรูป Avatar)
              </h2>
              <p className="text-xs text-slate-500">
                หากไม่อัปโหลดรูป ระบบจะสร้างรูป Default Avatar อัตโนมัติ (`resolveAvatarUrl`)
              </p>
            </div>
          </div>

          <form onSubmit={handleAddHomeowner} className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">คำนำหน้า</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              >
                <option value="นาย">นาย</option>
                <option value="นาง">นาง</option>
                <option value="นางสาว">นางสาว</option>
              </select>
            </div>
            <div>
              <label htmlFor="owner-firstname" className="mb-1 block text-xs font-medium text-slate-600">
                ชื่อเจ้าของบ้าน
              </label>
              <input
                id="owner-firstname"
                aria-label="ชื่อเจ้าของบ้าน"
                placeholder="เช่น วิภา"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="owner-lastname" className="mb-1 block text-xs font-medium text-slate-600">
                นามสกุลเจ้าของบ้าน
              </label>
              <input
                id="owner-lastname"
                aria-label="นามสกุลเจ้าของบ้าน"
                placeholder="เช่น สุขใจ"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="owner-houseno" className="mb-1 block text-xs font-medium text-slate-600">
                บ้านเลขที่
              </label>
              <input
                id="owner-houseno"
                aria-label="บ้านเลขที่"
                placeholder="เช่น 309/2"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={houseNo}
                onChange={(e) => setHouseNo(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">หมู่บ้าน</label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(Number(e.target.value))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.zone_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">เบอร์โทรศัพท์</label>
              <input
                placeholder="08x-xxx-xxxx"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                อัปโหลดรูป Avatar (ตัวเลือก — ถ้าเว้นว่างจะใช้ Default Avatar)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = () => setUploadedAvatarDataUrl(String(reader.result || ''))
                    reader.readAsDataURL(file)
                  }
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-sky-700"
              >
                บันทึกเจ้าของบ้าน
              </button>
            </div>
          </form>

          {/* ตารางรายชื่อเจ้าของบ้านพร้อมรูป Avatar */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Avatar</th>
                  <th className="px-3 py-2.5">ชื่อ-นามสกุลเจ้าของบ้าน</th>
                  <th className="px-3 py-2.5">บ้านเลขที่</th>
                  <th className="px-3 py-2.5">หมู่บ้าน / ตำบล</th>
                  <th className="px-3 py-2.5">สถานะรูป</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {homeowners.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2.5">
                      <img
                        src={h.avatar_url || resolveAvatarUrl(h.image, h.firstname, h.lastname)}
                        alt={`Avatar ${h.firstname} ${h.lastname}`}
                        className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {h.prefix}
                      {h.firstname} {h.lastname}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-sky-700">{h.house_no}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {h.zone_name} • ต.{h.tambon_name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {h.image ? 'Uploaded Photo' : 'Default Avatar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
