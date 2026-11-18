import { apiRequest } from '@/shared/api/httpClient'
import type { WaterInvoiceItem } from '@/shared/types/waterSmartBill'

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
  invoices: WaterInvoiceItem[]
}

export const financeCashierApi = {
  listInvoices: (status?: string, periodId?: number, token?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (periodId) params.set('period_id', String(periodId))
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiRequest<{ items: WaterInvoiceItem[] }>(`/api/v1/tabwater/invoices${query}`, { token })
  },

  payInvoice: (id: number, paymentMethod: string, token?: string) =>
    apiRequest<WaterInvoiceItem>(`/api/v1/tabwater/invoices/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: paymentMethod }),
      token,
    }),

  getCollectionReport: (periodId?: number, token?: string) => {
    const query = periodId ? `?period_id=${periodId}` : ''
    return apiRequest<CollectionSummaryReport>(`/api/v1/water-bills/reports/collections${query}`, { token })
  },

  downloadCollectionReportCSV: async (periodId?: number, token?: string): Promise<Blob> => {
    const query = periodId ? `?period_id=${periodId}&format=csv` : '?format=csv'
    const headers: Record<string, string> = {
      Accept: 'text/csv',
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    const res = await fetch(`/api/v1/water-bills/reports/collections${query}`, {
      headers,
    })
    if (!res.ok) {
      throw new Error(`Failed to download report: ${res.statusText}`)
    }
    return res.blob()
  },
}
