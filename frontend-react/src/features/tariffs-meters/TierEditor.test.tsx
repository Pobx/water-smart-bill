import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TierEditor } from './TierEditor'
import type { RateTier } from '@/features/billing/utils/waterBillCalculator'

const sampleTiers: RateTier[] = [
  { tier_order: 1, min_units: 0, max_units: 10, rate_per_unit: 5, comment: 'Tier 1' },
  { tier_order: 2, min_units: 11, max_units: 50, rate_per_unit: 8, comment: 'Tier 2' },
]

describe('TierEditor', () => {
  it('renders existing tiers in editable rows', () => {
    render(
      <TierEditor
        vatRate={7}
        reserveFee={10}
        tiers={sampleTiers}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByLabelText('ค่ารักษามาตรวัดน้ำ')).toHaveValue(10)
    expect(screen.getByLabelText('ภาษีมูลค่าเพิ่ม VAT')).toHaveValue(7)
    expect(screen.getByLabelText('หน่วยเริ่มต้น Tier 1')).toHaveValue(0)
    expect(screen.getByLabelText('หน่วยสิ้นสุด Tier 1')).toHaveValue(10)
    expect(screen.getByLabelText('ราคาต่อหน่วย Tier 1')).toHaveValue(5)
    expect(screen.getByLabelText('หน่วยเริ่มต้น Tier 2')).toHaveValue(11)
    expect(screen.getByLabelText('หน่วยสิ้นสุด Tier 2')).toHaveValue(50)
    expect(screen.getByLabelText('ราคาต่อหน่วย Tier 2')).toHaveValue(8)
  })

  it('shows error when tier gap detected on save', async () => {
    const onSave = vi.fn()
    render(
      <TierEditor
        vatRate={7}
        reserveFee={10}
        tiers={[
          { tier_order: 1, min_units: 0, max_units: 5, rate_per_unit: 5 },
          { tier_order: 2, min_units: 10, max_units: 50, rate_per_unit: 8 },
        ]}
        onSave={onSave}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('tier gap detected')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows error when tier overlap detected on save', async () => {
    const onSave = vi.fn()
    render(
      <TierEditor
        vatRate={7}
        reserveFee={10}
        tiers={[
          { tier_order: 1, min_units: 0, max_units: 10, rate_per_unit: 5 },
          { tier_order: 2, min_units: 10, max_units: 50, rate_per_unit: 8 },
        ]}
        onSave={onSave}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('tier overlap detected')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('add new tier row on "เพิ่ม Tier" button click', () => {
    render(
      <TierEditor
        vatRate={7}
        reserveFee={10}
        tiers={sampleTiers}
        onSave={vi.fn()}
      />
    )

    expect(screen.queryByLabelText('หน่วยเริ่มต้น Tier 3')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /เพิ่ม Tier/ }))

    expect(screen.getByLabelText('หน่วยเริ่มต้น Tier 3')).toHaveValue(51)
    expect(screen.getByLabelText('หน่วยสิ้นสุด Tier 3')).toHaveValue(null)
  })

  it('removes a tier row and saves updated VAT, reserve fee, and tiers', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <TierEditor
        vatRate={7}
        reserveFee={10}
        tiers={sampleTiers}
        onSave={onSave}
      />
    )

    fireEvent.change(screen.getByLabelText('ภาษีมูลค่าเพิ่ม VAT'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('ค่ารักษามาตรวัดน้ำ'), { target: { value: '15' } })
    fireEvent.click(screen.getByLabelText('ลบ Tier 2'))

    expect(screen.queryByLabelText('หน่วยเริ่มต้น Tier 2')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        vat: 8,
        reserve_fee: 15,
        tiers: [
          expect.objectContaining({
            tier_order: 1,
            min_units: 0,
            max_units: 10,
            rate_per_unit: 5,
          }),
        ],
      })
    })
  })
})
