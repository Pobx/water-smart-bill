import { apiRequest } from '@/shared/api/httpClient'
import type { DebtNotice } from '@/features/debt-management'
import type { Homeowner, InvoiceItem, WaterMeterItem } from '@/shared/types/waterSmartBill'

export type { DebtNotice }

export type IncidentType = 'no_water' | 'cloudy_water' | 'broken_pipe' | 'other'

export interface Incident {
  id: string
  org_id: number
  reporter_user_id: number
  reporter_name?: string
  incident_type: IncidentType
  description?: string
  lat?: number
  lng?: number
  photo_url?: string
  status: string
  assigned_to?: number
  assigned_at?: string
  resolved_at?: string
  resolution_note?: string
  created_at: string
}

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

export async function submitIncident(formData: FormData, token?: string): Promise<Incident> {
  return apiRequest<Incident>('/api/v1/incidents', {
    method: 'POST',
    body: formData,
    token,
  })
}

export const liffPortalApi = {
  getResidentBills: (meterNumber: string) =>
    apiRequest<LiffPortalPayload>(`/api/v1/liff/bills?meternumber=${encodeURIComponent(meterNumber)}`),
  fetchMyDebtNotices,
  submitIncident,
}
