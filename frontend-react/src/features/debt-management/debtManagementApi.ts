import { apiRequest } from '@/shared/api/httpClient'
import type { WaterInvoiceItem } from '@/shared/types/waterSmartBill'

export type DebtNoticeStatus = 'pending' | 'sent' | 'cut' | 'restored'

export interface DebtNotice {
  id: string
  org_id: number
  user_id: number
  homeowner_name?: string
  house_no?: string
  meternumber?: string
  invoice_ids: number[]
  total_overdue_amount: number
  status: DebtNoticeStatus
  notice_sent_at?: string
  cut_at?: string
  cut_by?: number | null
  cut_meter_reading?: number | null
  restored_at?: string
  restored_by?: number | null
  created_at: string
}

export interface OutstandingBalanceResponse {
  user_id?: number
  invoices: WaterInvoiceItem[]
  total: number
}

export interface DebtNoticeFilter {
  status?: string
  user_id?: number
}

export interface CreateDebtNoticePayload {
  user_id: number
  invoice_ids: number[]
}

export async function fetchUserOutstanding(
  userId: number,
  token?: string
): Promise<OutstandingBalanceResponse> {
  return apiRequest<OutstandingBalanceResponse>(`/api/v1/users/${userId}/outstanding`, {
    token,
  })
}

export async function fetchDebtNotices(
  filter?: DebtNoticeFilter,
  token?: string
): Promise<DebtNotice[]> {
  const params = new URLSearchParams()
  if (filter?.status) {
    params.set('status', filter.status)
  }
  if (filter?.user_id !== undefined && filter.user_id > 0) {
    params.set('user_id', String(filter.user_id))
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await apiRequest<{ items: DebtNotice[] | null }>(
    `/api/v1/debt-notices${query}`,
    { token }
  )
  return res.items ?? []
}

export async function createDebtNotice(
  payload: CreateDebtNoticePayload,
  token?: string
): Promise<DebtNotice> {
  return apiRequest<DebtNotice>('/api/v1/debt-notices', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  })
}

export async function cutMeter(
  id: string,
  meterReading: number,
  token?: string
): Promise<DebtNotice> {
  return apiRequest<DebtNotice>(`/api/v1/debt-notices/${encodeURIComponent(id)}/cut`, {
    method: 'PATCH',
    body: JSON.stringify({ meter_reading: meterReading }),
    token,
  })
}

export async function restoreMeter(id: string, token?: string): Promise<DebtNotice> {
  return apiRequest<DebtNotice>(`/api/v1/debt-notices/${encodeURIComponent(id)}/restore`, {
    method: 'PATCH',
    token,
  })
}

export const debtManagementApi = {
  fetchUserOutstanding,
  fetchDebtNotices,
  createDebtNotice,
  cutMeter,
  restoreMeter,
}
