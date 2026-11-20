import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MasterDataScreen, useMasterData } from '@/features/master-data'
import { formatThermalReceiptText, type ThermalBillPayload } from '@/features/printer/escpos'

function MasterDataGoldenWrapper() {
  const masterData = useMasterData()
  return <MasterDataScreen {...masterData} />
}

describe('Golden Snapshot Tests (Visual & Structural Characterization)', () => {
  it('matches golden snapshot for MasterDataScreen (verifying Desktop Table + Mobile Cards integrity)', () => {
    const { container } = render(<MasterDataGoldenWrapper />)

    // Golden DOM snapshot ensures both desktop table and mobile cards never unintentionally change structure
    expect(container).toMatchSnapshot()
  })

  it('matches golden text output for ESC/POS Thermal Receipt', () => {
    const billPayload: ThermalBillPayload = {
      orgName: 'องค์การบริหารส่วนตำบลห้องแซง',
      invNo: 'INV-2569-11-0001',
      periodName: '11/2569',
      meterNumber: 'HSG-0001',
      homeownerName: 'นายสมหมาย ใจดี',
      houseNo: '101/1 หมู่ที่ 1',
      lastMeter: 120,
      currentMeter: 135,
      waterUsed: 15,
      waterCharge: 85.0,
      reserveFee: 10.0,
      vat: 6.65,
      totalPaid: 101.65,
      status: 'invoice',
      recordedAt: '2026-11-20 10:30',
    }

    const receiptText = formatThermalReceiptText(billPayload)

    // Golden snapshot of thermal receipt text format
    expect(receiptText).toMatchSnapshot()
  })
})
