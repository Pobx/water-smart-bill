import { describe, expect, it } from 'vitest'
import {
  calculateProgressiveWaterBill,
  resolveAvatarUrl,
  type RateTier,
} from './waterBillCalculator'

describe('waterBillCalculator & default avatar resolution', () => {
  const tiers: RateTier[] = [
    { tier_order: 1, min_units: 1, max_units: 10, rate_per_unit: 5 },
    { tier_order: 2, min_units: 11, max_units: 20, rate_per_unit: 7 },
    { tier_order: 3, min_units: 21, max_units: 50, rate_per_unit: 10 },
    { tier_order: 4, min_units: 51, max_units: null, rate_per_unit: 12 },
  ]

  it('calculates zero-usage water bill with reserve fee and VAT', () => {
    const res = calculateProgressiveWaterBill(0, tiers, 10, 7)
    expect(res).toEqual({
      units_used: 0,
      water_charge: 0,
      reserve_fee: 10,
      vat_amount: 0.7,
      total_payable: 10.7,
    })
  })

  it('calculates progressive water bill across multiple tiers identically to Go backend', () => {
    const res = calculateProgressiveWaterBill(25, tiers, 10, 7)
    expect(res).toEqual({
      units_used: 25,
      water_charge: 170,
      reserve_fee: 10,
      vat_amount: 12.6,
      total_payable: 192.6,
    })
  })

  it('resolves default avatar URL when homeowner has no uploaded photo', () => {
    expect(resolveAvatarUrl('', 'สมหมาย', 'ใจดี')).toContain('/api/v1/avatars/default?name=')
    expect(resolveAvatarUrl('/uploads/avatars/u1.png', 'สมหมาย', 'ใจดี')).toBe('/uploads/avatars/u1.png')
  })
})
