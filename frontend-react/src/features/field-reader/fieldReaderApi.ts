import { apiRequest } from '@/shared/api/httpClient'
import type { InvoiceItem, MeterRoute, WaterMeterItem } from '@/shared/types/waterSmartBill'
import type { OfflineReadingRecord } from '@/features/offline/offlineStore'

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
