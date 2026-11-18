import { apiRequest } from '@/shared/api/httpClient'
import type { InvoiceItem } from '@/shared/types/waterSmartBill'
import type { OfflineReadingRecord } from '@/features/offline/offlineStore'

export const fieldReaderApi = {
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
