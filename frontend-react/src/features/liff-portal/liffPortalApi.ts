import { apiRequest } from '@/shared/api/httpClient'
import type { Homeowner, InvoiceItem, WaterMeterItem } from '@/shared/types/waterSmartBill'

export interface LiffPortalPayload {
  homeowner: Homeowner
  meters: WaterMeterItem[]
  invoices: InvoiceItem[]
  unpaid_total: number
}

export const liffPortalApi = {
  getResidentBills: (meterNumber: string) =>
    apiRequest<LiffPortalPayload>(`/api/v1/liff/bills?meternumber=${encodeURIComponent(meterNumber)}`),
}
