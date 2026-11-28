import { apiRequest } from '@/shared/api/httpClient'
import type { WaterInvoiceItem } from '@/shared/types/waterSmartBill'

export interface CollectionInvoiceItem extends WaterInvoiceItem {
  cashier_name?: string
}

export interface CollectionSummaryReport {
  period_id: number
  period_name: string
  total_invoices: number
  paid_invoices: number
  unpaid_invoices: number
  total_units_used: number
  total_water_charge: number
  total_reserve_fee: number
  total_vat_amount: number
  total_collected: number
  total_cash: number
  total_promptpay: number
  generated_at: string
  invoices: CollectionInvoiceItem[]
}

export interface CollectionReportParams {
  from?: string
  to?: string
  status?: string
  periodId?: number
}

export async function fetchCollectionReport(
  params: CollectionReportParams = {},
  token?: string
): Promise<CollectionSummaryReport> {
  const queryParams = new URLSearchParams()
  if (params.from) {
    queryParams.set('from', params.from)
  }
  if (params.to) {
    queryParams.set('to', params.to)
  }
  if (params.status) {
    queryParams.set('status', params.status)
  }
  if (params.periodId !== undefined) {
    queryParams.set('period_id', String(params.periodId))
  }
  const query = queryParams.toString() ? `?${queryParams.toString()}` : ''
  return apiRequest<CollectionSummaryReport>(`/api/v1/tabwater/reports/collections${query}`, {
    token,
  })
}

export const reportsApi = {
  fetchCollectionReport,
}
