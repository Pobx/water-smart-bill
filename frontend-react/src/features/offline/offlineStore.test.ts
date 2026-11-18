import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearOfflineQueue,
  enqueueOfflineReading,
  getOfflineQueue,
  markReadingsSynced,
} from './offlineStore'

describe('Offline-first meter reading queue', () => {
  beforeEach(() => {
    clearOfflineQueue()
  })

  it('enqueues offline reading with idempotency client_reading_id and marks synced', () => {
    const item = enqueueOfflineReading({
      inv_no: 'INV-OFFLINE-001',
      meter_id: 1,
      meternumber: 'HSG-0001',
      homeowner_name: 'นายสมหมาย ใจดี',
      house_no: '101/1',
      period_id: 1,
      period_name: '11/2569',
      last_meter: 120,
      current_meter: 135,
      water_used: 15,
      paid: 85,
      reserve_meter: 10,
      vat: 6.65,
      totalpaid: 101.65,
      reading_photo_url: 'data:image/png;base64,iVBORw0KGgo=',
      ocr_text: '00135',
      ocr_confidence: 96.4,
    })

    expect(item.client_reading_id).toMatch(/^offline-/)
    expect(item.sync_status).toBe('pending')

    const queue = getOfflineQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].totalpaid).toBe(101.65)

    markReadingsSynced([item.client_reading_id])
    const updated = getOfflineQueue()
    expect(updated[0].sync_status).toBe('synced')
  })
})
