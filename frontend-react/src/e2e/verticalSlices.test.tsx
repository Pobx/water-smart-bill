import { describe, expect, it } from 'vitest'
import { MasterDataScreen, useMasterData } from '@/features/master-data'
import { TariffsMetersScreen, useTariffsMeters } from '@/features/tariffs-meters'
import { FieldReaderScreen, useFieldReader } from '@/features/field-reader'
import { LiffPortalScreen, useLiffPortal } from '@/features/liff-portal'
import { AuthModal, useAuth } from '@/features/auth'
import { FinanceCashierScreen, useFinanceCashier } from '@/features/finance-cashier'

describe('Frontend Vertical Slice Architecture (piliar.me)', () => {
  it('exports self-contained Screen and useFeature hook from each feature barrel index.ts', () => {
    expect(typeof MasterDataScreen).toBe('function')
    expect(typeof useMasterData).toBe('function')

    expect(typeof TariffsMetersScreen).toBe('function')
    expect(typeof useTariffsMeters).toBe('function')

    expect(typeof FieldReaderScreen).toBe('function')
    expect(typeof useFieldReader).toBe('function')

    expect(typeof FinanceCashierScreen).toBe('function')
    expect(typeof useFinanceCashier).toBe('function')

    expect(typeof LiffPortalScreen).toBe('function')
    expect(typeof useLiffPortal).toBe('function')

    expect(typeof AuthModal).toBe('function')
    expect(typeof useAuth).toBe('function')
  })
})
