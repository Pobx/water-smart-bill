import { apiRequest } from '@/shared/api/httpClient'
import type {
  InvoiceItem,
  MeterReadingStatusItem,
  MeterRoute,
  WaterMeterItem,
} from '@/shared/types/waterSmartBill'
import type { OfflineReadingRecord } from '@/features/offline/offlineStore'

export interface FetchReadingsParams {
  periodId?: number | null
  status?: 'recorded' | 'pending'
  routeId?: number | null
}

export const fieldReaderApi = {
  fetchMeterRoutes: async (token?: string): Promise<MeterRoute[]> => {
    const res = await apiRequest<{ items: MeterRoute[] }>('/api/v1/tabwater/meter-routes', {
      method: 'GET',
      token,
    })
    return res.items ?? []
  },
  fetchMeters: async (routeId?: number | null, token?: string): Promise<WaterMeterItem[]> => {
    const query = routeId != null ? `?route_id=${encodeURIComponent(String(routeId))}` : ''
    const res = await apiRequest<{ items: WaterMeterItem[] }>(`/api/v1/tabwater/meters${query}`, {
      method: 'GET',
      token,
    })
    return res.items ?? []
  },
  fetchReadings: async (
    params?: FetchReadingsParams,
    token?: string,
  ): Promise<MeterReadingStatusItem[]> => {
    const qs = new URLSearchParams()
    if (params?.periodId != null) {
      qs.set('period_id', String(params.periodId))
    }
    if (params?.status) {
      qs.set('status', params.status)
    }
    if (params?.routeId != null) {
      qs.set('route_id', String(params.routeId))
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<{ items: MeterReadingStatusItem[] }>(
      `/api/v1/tabwater/readings${suffix}`,
      {
        method: 'GET',
        token,
      },
    )
    return res.items ?? []
  },
  syncOfflineReadings: (readings: OfflineReadingRecord[], token?: string) =>
    apiRequest<{ total_received: number; synced_count: number; invoices: InvoiceItem[] }>(
      '/api/v1/tabwater/readings/sync',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ readings }),
      },
    ),
  scanMeterOcr: (ocrHint: string, lastMeter: number, token?: string) =>
    apiRequest<{ digits: string; reading: number; confidence: number; warning?: string }>(
      '/api/v1/tabwater/ocr/meter-read',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ ocr_hint: ocrHint, last_meter: lastMeter }),
      },
    ),
}

export const fetchMeterRoutes = fieldReaderApi.fetchMeterRoutes
export const fetchMeters = fieldReaderApi.fetchMeters
export const fetchReadings = fieldReaderApi.fetchReadings
