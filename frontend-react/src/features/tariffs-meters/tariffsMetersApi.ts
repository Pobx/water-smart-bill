import { apiRequest } from '@/shared/api/httpClient'
import type { WaterMeterItem } from '@/shared/types/waterSmartBill'
import type { RateTier } from '@/features/billing/utils/waterBillCalculator'

export interface RateConfigPayload {
  id?: number
  reserve_fee: number
  vat: number
  tiers: RateTier[]
}

export const tariffsMetersApi = {
  getRateConfig: (token?: string) =>
    apiRequest<RateConfigPayload>('/api/v1/tabwater/rate-configs', { token }),
  updateRateConfig: (id: number, payload: RateConfigPayload, token?: string) =>
    apiRequest<RateConfigPayload>(`/api/v1/tabwater/rate-configs/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    }),
  listMeters: (token?: string) =>
    apiRequest<{ items: WaterMeterItem[] }>('/api/v1/tabwater/meters', { token }),
}
