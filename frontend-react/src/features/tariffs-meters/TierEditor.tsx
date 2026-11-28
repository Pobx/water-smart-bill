import { useEffect, useState } from 'react'
import type { RateTier } from '@/features/billing/utils/waterBillCalculator'

export interface TierEditorSavePayload {
  vat: number
  reserve_fee: number
  tiers: RateTier[]
}

export interface TierEditorProps {
  vatRate: number
  reserveFee: number
  tiers: RateTier[]
  onSave: (payload: TierEditorSavePayload) => Promise<void> | void
  isSaving?: boolean
  disabled?: boolean
  errorMessage?: string | null
  successMessage?: string | null
}

export function validateTierConfig(
  vat: number,
  reserveFee: number,
  tiers: RateTier[]
): { valid: true; normalizedTiers: RateTier[] } | { valid: false; error: string } {
  if (Number.isNaN(vat) || vat < 0 || vat > 100) {
    return { valid: false, error: 'ภาษีมูลค่าเพิ่ม VAT ต้องอยู่ระหว่าง 0 - 100%' }
  }
  if (Number.isNaN(reserveFee) || reserveFee < 0) {
    return { valid: false, error: 'ค่ารักษามาตรวัดน้ำต้องไม่ติดลบ' }
  }
  if (tiers.length === 0) {
    return { valid: false, error: 'ต้องมีอย่างน้อย 1 ขั้นบันได (tier)' }
  }

  for (const t of tiers) {
    if (Number.isNaN(t.min_units) || t.min_units < 0) {
      return { valid: false, error: 'หน่วยเริ่มต้นต้องมากกว่าหรือเท่ากับ 0' }
    }
    if (Number.isNaN(t.rate_per_unit) || t.rate_per_unit < 0) {
      return { valid: false, error: 'ราคาต่อหน่วยต้องไม่ติดลบ' }
    }
    if (t.max_units !== null && t.max_units !== undefined && t.max_units < t.min_units) {
      return { valid: false, error: 'หน่วยสิ้นสุดต้องมากกว่าหรือเท่ากับหน่วยเริ่มต้น' }
    }
  }

  const sorted = [...tiers].sort((a, b) => {
    if (a.min_units !== b.min_units) return a.min_units - b.min_units
    if (a.max_units === null || a.max_units === undefined) return 1
    if (b.max_units === null || b.max_units === undefined) return -1
    return a.max_units - b.max_units
  })

  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i]
    const next = sorted[i + 1]
    if (prev.max_units === null || prev.max_units === undefined) {
      return { valid: false, error: 'พบช่วงหน่วยซ้อนทับกัน (tier overlap detected)' }
    }
    if (prev.max_units + 1 < next.min_units) {
      return { valid: false, error: 'พบช่องว่างระหว่างช่วงหน่วย (tier gap detected)' }
    }
    if (prev.max_units + 1 > next.min_units) {
      return { valid: false, error: 'พบช่วงหน่วยซ้อนทับกัน (tier overlap detected)' }
    }
  }

  const normalizedTiers = sorted.map((t, index) => ({
    ...t,
    tier_order: index + 1,
    max_units: t.max_units === undefined ? null : t.max_units,
  }))

  return { valid: true, normalizedTiers }
}

export function TierEditor({
  vatRate,
  reserveFee,
  tiers,
  onSave,
  isSaving = false,
  disabled = false,
  errorMessage = null,
  successMessage = null,
}: TierEditorProps) {
  const [draftVat, setDraftVat] = useState<number>(vatRate)
  const [draftReserveFee, setDraftReserveFee] = useState<number>(reserveFee)
  const [draftTiers, setDraftTiers] = useState<RateTier[]>(tiers)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setDraftVat(vatRate)
  }, [vatRate])

  useEffect(() => {
    setDraftReserveFee(reserveFee)
  }, [reserveFee])

  useEffect(() => {
    setDraftTiers(tiers)
  }, [tiers])

  function handleTierFieldChange(
    idx: number,
    field: 'min_units' | 'max_units' | 'rate_per_unit',
    rawValue: string
  ) {
    setValidationError(null)
    setDraftTiers((prev) =>
      prev.map((tier, i) => {
        if (i !== idx) return tier
        if (field === 'max_units') {
          if (rawValue.trim() === '') {
            return { ...tier, max_units: null }
          }
          const parsed = Number(rawValue)
          return { ...tier, max_units: Number.isNaN(parsed) ? null : Math.trunc(parsed) }
        }
        if (field === 'min_units') {
          const parsed = Number(rawValue)
          return { ...tier, min_units: Number.isNaN(parsed) ? 0 : Math.trunc(parsed) }
        }
        const parsed = Number(rawValue)
        return { ...tier, rate_per_unit: Number.isNaN(parsed) ? 0 : parsed }
      })
    )
  }

  function handleAddTier() {
    setValidationError(null)
    setDraftTiers((prev) => {
      if (prev.length === 0) {
        return [{ tier_order: 1, min_units: 0, max_units: 10, rate_per_unit: 5 }]
      }
      const nextList = prev.map((t) => ({ ...t }))
      const last = nextList[nextList.length - 1]
      let nextMin = 0
      if (last.max_units === null || last.max_units === undefined) {
        const autoEnd = last.min_units + 9
        last.max_units = autoEnd
        nextMin = autoEnd + 1
      } else {
        nextMin = last.max_units + 1
      }
      nextList.push({
        tier_order: nextList.length + 1,
        min_units: nextMin,
        max_units: null,
        rate_per_unit: last.rate_per_unit + 2,
      })
      return nextList
    })
  }

  function handleRemoveTier(idx: number) {
    setValidationError(null)
    setDraftTiers((prev) => {
      if (prev.length <= 1) return prev
      return prev
        .filter((_, i) => i !== idx)
        .map((t, i) => ({ ...t, tier_order: i + 1 }))
    })
  }

  async function handleSaveClick() {
    const check = validateTierConfig(draftVat, draftReserveFee, draftTiers)
    if (!check.valid) {
      setValidationError(check.error)
      return
    }
    setValidationError(null)
    setDraftTiers(check.normalizedTiers)
    await onSave({
      vat: draftVat,
      reserve_fee: draftReserveFee,
      tiers: check.normalizedTiers,
    })
  }

  const activeError = validationError ?? errorMessage

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="tier-editor-reserve-fee"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            ค่ารักษามาตรวัดน้ำ (บาท/เดือน)
          </label>
          <input
            id="tier-editor-reserve-fee"
            type="number"
            min={0}
            step="0.01"
            aria-label="ค่ารักษามาตรวัดน้ำ"
            disabled={disabled || isSaving}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={draftReserveFee}
            onChange={(e) => {
              setValidationError(null)
              setDraftReserveFee(Number(e.target.value))
            }}
          />
        </div>
        <div>
          <label
            htmlFor="tier-editor-vat"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            ภาษีมูลค่าเพิ่ม VAT (%)
          </label>
          <input
            id="tier-editor-vat"
            type="number"
            min={0}
            max={100}
            step="0.1"
            aria-label="ภาษีมูลค่าเพิ่ม VAT"
            disabled={disabled || isSaving}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            value={draftVat}
            onChange={(e) => {
              setValidationError(null)
              setDraftVat(Number(e.target.value))
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-2 py-2">ขั้นที่</th>
              <th className="px-2 py-2">หน่วยเริ่มต้น</th>
              <th className="px-2 py-2">หน่วยสิ้นสุด</th>
              <th className="px-2 py-2">ราคา/หน่วย (฿)</th>
              <th className="px-2 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {draftTiers.map((t, idx) => {
              const rowNum = idx + 1
              return (
                <tr key={rowNum}>
                  <td className="px-2 py-2 font-mono text-xs font-bold text-slate-700">
                    <div>Tier #{rowNum}</div>
                    <div className="font-sans text-[11px] font-normal text-slate-500">
                      {t.min_units} - {t.max_units ?? 'ขึ้นไป'} หน่วย
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`หน่วยเริ่มต้น Tier ${rowNum}`}
                      disabled={disabled || isSaving}
                      className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                      value={t.min_units}
                      onChange={(e) => handleTierFieldChange(idx, 'min_units', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="ขึ้นไป"
                      aria-label={`หน่วยสิ้นสุด Tier ${rowNum}`}
                      disabled={disabled || isSaving}
                      className="w-20 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                      value={t.max_units === null || t.max_units === undefined ? '' : t.max_units}
                      onChange={(e) => handleTierFieldChange(idx, 'max_units', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`ราคาต่อหน่วย Tier ${rowNum}`}
                      disabled={disabled || isSaving}
                      className="w-24 rounded border border-slate-200 px-2 py-1 font-mono text-sm"
                      value={t.rate_per_unit}
                      onChange={(e) => handleTierFieldChange(idx, 'rate_per_unit', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`ลบ Tier ${rowNum}`}
                      disabled={disabled || isSaving || draftTiers.length <= 1}
                      onClick={() => handleRemoveTier(idx)}
                      className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {activeError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
        >
          {activeError}
        </div>
      )}

      {successMessage && !activeError && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
        >
          {successMessage}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled || isSaving}
          onClick={handleAddTier}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          + เพิ่ม Tier
        </button>

        <button
          type="button"
          disabled={disabled || isSaving}
          onClick={handleSaveClick}
          className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกอัตราค่าน้ำ'}
        </button>
      </div>
    </div>
  )
}
