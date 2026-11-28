import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { DebtNotice } from '@/features/debt-management'
import {
  LiffPortalScreen,
  fetchMyDebtNotices,
  useLiffPortal,
} from '@/features/liff-portal'
import type { WaterMeterItem } from '@/shared/types/waterSmartBill'

const mockMeters: WaterMeterItem[] = [
  {
    meter_id: 1,
    meternumber: 'HSG-0001',
    factory_no: 'SN-2026-0001',
    user_id: 1,
    homeowner_name: 'นายสมหมาย ใจดี',
    house_no: '101/1',
    zone_id: 1,
    zone_name: 'หมู่ที่ 1 บ้านห้องแซงเหนือ',
    last_meter_recording: 120,
    status: 'active',
  },
]

function LiffPortalTestHarness({
  meters = mockMeters,
  token = 'resident-jwt-token',
}: {
  meters?: WaterMeterItem[]
  token?: string
}) {
  const liffPortal = useLiffPortal(meters, token)
  return (
    <LiffPortalScreen
      {...liffPortal}
      orgName="องค์การบริหารส่วนตำบลห้องแซง"
      meters={meters}
    />
  )
}

function makeNotice(overrides: Partial<DebtNotice> = {}): DebtNotice {
  return {
    id: 'dn-001',
    org_id: 1,
    user_id: 1,
    homeowner_name: 'นายสมหมาย ใจดี',
    house_no: '101/1',
    meternumber: 'HSG-0001',
    invoice_ids: [10, 11],
    total_overdue_amount: 128.4,
    status: 'pending',
    created_at: '2026-11-28T09:00:00Z',
    ...overrides,
  }
}

describe('LINE LIFF Resident Dashboard Debt Notice Banner', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetchMyDebtNotices calls GET /api/v1/users/:user_id/debt-notices with encoded user_id and Bearer token', async () => {
    const notice = makeNotice()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [notice] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const items = await fetchMyDebtNotices(1, 'my-jwt-token')

    expect(items).toEqual([notice])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/users/1/debt-notices')
    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer my-jwt-token')
  })

  it('shows debt notice banner (role="alert") with overdue rounds count and total amount when pending debt notice exists', async () => {
    const pendingNotice = makeNotice({
      status: 'pending',
      invoice_ids: [10, 11],
      total_overdue_amount: 128.4,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [pendingNotice] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    render(<LiffPortalTestHarness />)

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.className).toMatch(/rose|red/)
    expect(
      screen.getByText(/กรุณาชำระค่าน้ำที่ค้างชำระจำนวน 2 รอบ ยอดรวม 128\.40 บาท/)
    ).toBeInTheDocument()
  })

  it('shows debt notice banner (role="alert") when sent debt notice exists', async () => {
    const sentNotice = makeNotice({
      id: 'dn-002',
      status: 'sent',
      invoice_ids: [10, 11, 12],
      total_overdue_amount: 250.0,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [sentNotice] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    render(<LiffPortalTestHarness />)

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(
      screen.getByText(/กรุณาชำระค่าน้ำที่ค้างชำระจำนวน 3 รอบ ยอดรวม 250\.00 บาท/)
    ).toBeInTheDocument()
  })

  it('hides banner when no debt notices exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<LiffPortalTestHarness />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides banner when only restored debt notices exist', async () => {
    const restoredNotice = makeNotice({
      id: 'dn-003',
      status: 'restored',
      invoice_ids: [10],
      total_overdue_amount: 64.2,
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [restoredNotice] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<LiffPortalTestHarness />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles offline/network errors gracefully without showing banner', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Network error'))
    vi.stubGlobal('fetch', fetchMock)

    render(<LiffPortalTestHarness />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
