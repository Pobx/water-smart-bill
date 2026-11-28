import { apiRequest } from '@/shared/api/httpClient'
import type { DebtNotice } from '@/features/debt-management'
import type { Homeowner, InvoiceItem, WaterMeterItem } from '@/shared/types/waterSmartBill'

export type { DebtNotice }

export interface LiffPortalPayload {
  homeowner: Homeowner
  meters: WaterMeterItem[]
  invoices: InvoiceItem[]
  unpaid_total: number
}

export async function fetchMyDebtNotices(userId: number, token?: string): Promise<DebtNotice[]> {
  const res = await apiRequest<{ items?: DebtNotice[] | null }>(
    `/api/v1/users/${encodeURIComponent(String(userId))}/debt-notices`,
    { token }
  )
  return res.items ?? []
}

export const liffPortalApi = {
  getResidentBills: (meterNumber: string) =>
    apiRequest<LiffPortalPayload>(`/api/v1/liff/bills?meternumber=${encodeURIComponent(meterNumber)}`),
  fetchMyDebtNotices,
}
