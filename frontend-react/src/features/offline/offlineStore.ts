export interface OfflineReadingRecord {
  client_reading_id: string
  inv_no: string
  meter_id: number
  meternumber: string
  homeowner_name: string
  house_no: string
  period_id: number
  period_name: string
  last_meter: number
  current_meter: number
  water_used: number
  paid: number
  reserve_meter: number
  vat: number
  totalpaid: number
  reading_photo_url: string
  ocr_text: string
  ocr_confidence: number
  recorded_at: string
  sync_status: 'pending' | 'synced'
}

export type NewOfflineReadingInput = Omit<
  OfflineReadingRecord,
  'client_reading_id' | 'recorded_at' | 'sync_status'
>

const OFFLINE_QUEUE_KEY = 'water_smart_bill_offline_readings_v1'

export function getOfflineQueue(): OfflineReadingRecord[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as OfflineReadingRecord[]
  } catch {
    return []
  }
}

function saveOfflineQueue(items: OfflineReadingRecord[]): void {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items))
}

export function enqueueOfflineReading(input: NewOfflineReadingInput): OfflineReadingRecord {
  const record: OfflineReadingRecord = {
    ...input,
    client_reading_id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recorded_at: new Date().toISOString(),
    sync_status: 'pending',
  }
  const current = getOfflineQueue()
  saveOfflineQueue([record, ...current])
  return record
}

export function markReadingsSynced(clientReadingIds: string[]): void {
  const idSet = new Set(clientReadingIds)
  const updated = getOfflineQueue().map((item) =>
    idSet.has(item.client_reading_id) ? { ...item, sync_status: 'synced' as const } : item,
  )
  saveOfflineQueue(updated)
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
}
