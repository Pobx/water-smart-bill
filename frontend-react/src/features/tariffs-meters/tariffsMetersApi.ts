import { apiRequest } from '@/shared/api/httpClient'
import type { WaterMeterItem } from '@/shared/types/waterSmartBill'
import type { RateTier } from '@/features/billing/utils/waterBillCalculator'

export interface RateConfigPayload {
  reserve_fee: number
  vat: number
  tiers: RateTier[]
}

export const tariffsMetersApi = {
  getRateConfig: (token?: string) =>
    apiRequest<RateConfigPayload>('/api/v1/tabwater/rate-configs', { token }),
  listMeters: (token?: string) =>
    apiRequest<{ items: WaterMeterItem[] }>('/api/v1/tabwater/meters', { token }),
}
