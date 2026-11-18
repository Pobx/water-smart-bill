export interface RateTier {
  tier_order: number
  min_units: number
  max_units?: number | null
  rate_per_unit: number
  comment?: string
}

export interface WaterBillBreakdown {
  units_used: number
  water_charge: number
  reserve_fee: number
  vat_amount: number
  total_payable: number
}

function round2(val: number): number {
  return Math.round(val * 100) / 100
}

export function calculateProgressiveWaterBill(
  unitsUsed: number,
  tiers: RateTier[],
  reserveFee: number,
  vatPercent: number,
): WaterBillBreakdown {
  if (unitsUsed <= 0 || tiers.length === 0) {
    const sub = Math.max(0, reserveFee)
    const vat = round2((sub * Math.max(0, vatPercent)) / 100)
    return {
      units_used: Math.max(0, unitsUsed),
      water_charge: 0,
      reserve_fee: round2(sub),
      vat_amount: vat,
      total_payable: round2(sub + vat),
    }
  }

  const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order)
  let remaining = unitsUsed
  let charge = 0
  let prevMax = 0

  for (const tier of sorted) {
    if (remaining <= 0) break
    let tierCapacity: number
    if (tier.max_units === undefined || tier.max_units === null || tier.max_units <= 0) {
      tierCapacity = remaining
    } else {
      const bandWidth = Math.max(0, tier.max_units - prevMax)
      tierCapacity = Math.min(remaining, bandWidth)
      prevMax = tier.max_units
    }
    charge += tierCapacity * tier.rate_per_unit
    remaining -= tierCapacity
  }

  charge = round2(charge)
  const reserve = round2(Math.max(0, reserveFee))
  const subTotal = charge + reserve
  const vat = round2((subTotal * Math.max(0, vatPercent)) / 100)

  return {
    units_used: round2(unitsUsed),
    water_charge: charge,
    reserve_fee: reserve,
    vat_amount: vat,
    total_payable: round2(subTotal + vat),
  }
}

export function resolveAvatarUrl(imageUrl: string | undefined | null, firstName: string, lastName: string): string {
  const trimmed = (imageUrl ?? '').trim()
  if (trimmed.length > 0) {
    return trimmed
  }
  const fullName = `${firstName} ${lastName}`.trim() || 'เจ้าของบ้าน'
  return `/api/v1/avatars/default?name=${encodeURIComponent(fullName)}`
}
