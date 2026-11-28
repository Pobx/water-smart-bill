import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  CreateDebtNoticeModal,
  DebtNoticeListScreen,
  MeterCutScreen,
  createDebtNotice,
  cutMeter,
  fetchDebtNotices,
  fetchUserOutstanding,
  restoreMeter,
  type DebtNotice,
  type OutstandingBalanceResponse,
} from '@/features/debt-management'
import type { Homeowner, WaterInvoiceItem } from '@/shared/types/waterSmartBill'

const mockHomeowners: Homeowner[] = [
  {
    id: 1,
    prefix: 'นาย',
    firstname: 'สมหมาย',
    lastname: 'ใจดี',
    house_no: '101/1',
    zone_id: 1,
    zone_name: 'หมู่ที่ 1 บ้านห้องแซง',
    tambon_name: 'ห้องแซง',
    phone: '081-111-2222',
    line_user_id: '',
    image: '',
    avatar_url: '',
  },
  {
    id: 2,
    prefix: 'นาง',
    firstname: 'มาลี',
    lastname: 'รักน้ำ',
    house_no: '102/3',
    zone_id: 1,
    zone_name: 'หมู่ที่ 1 บ้านห้องแซง',
    tambon_name: 'ห้องแซง',
    phone: '082-333-4444',
    line_user_id: '',
    image: '',
    avatar_url: '',
  },
]

const mockUnpaidInvoices: WaterInvoiceItem[] = [
  {
    id: 10,
    inv_no: 'INV-2569-09-0001',
    period_name: '09/2569',
    meter_id: 1,
    meternumber: 'HSG-0001',
    homeowner_name: 'นายสมหมาย ใจดี',
    house_no: '101/1',
    zone_name: 'หมู่ที่ 1',
    lastmeter: 100,
    currentmeter: 110,
    water_used: 10,
    paid: 50,
    reserve_meter: 10,
    vat: 4.2,
    totalpaid: 64.2,
    reading_photo_url: '',
    ocr_text: '',
    ocr_confidence: 0,
    status: 'invoice',
    recorded_at: '2026-09-25T10:00:00Z',
  },
  {
    id: 11,
    inv_no: 'INV-2569-10-0001',
    period_name: '10/2569',
    meter_id: 1,
    meternumber: 'HSG-0001',
    homeowner_name: 'นายสมหมาย ใจดี',
    house_no: '101/1',
    zone_name: 'หมู่ที่ 1',
    lastmeter: 110,
    currentmeter: 120,
    water_used: 10,
    paid: 50,
    reserve_meter: 10,
    vat: 4.2,
    totalpaid: 64.2,
    reading_photo_url: '',
    ocr_text: '',
    ocr_confidence: 0,
    status: 'invoice',
    recorded_at: '2026-10-25T10:00:00Z',
  },
]

const mockPendingNotice: DebtNotice = {
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
}

const mockCutNotice: DebtNotice = {
  ...mockPendingNotice,
  id: 'dn-002',
  status: 'cut',
  cut_at: '2026-11-28T11:00:00Z',
  cut_meter_reading: 125.5,
}

describe('debt-management feature (Admin + Staff)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches outstanding balance before creating debt notice', async () => {
    const outstandingResp: OutstandingBalanceResponse = {
      user_id: 1,
      invoices: mockUnpaidInvoices,
      total: 128.4,
    }
    const onFetchOutstanding = vi.fn().mockResolvedValue(outstandingResp)
    const onConfirm = vi.fn().mockResolvedValue(mockPendingNotice)
    const onClose = vi.fn()

    render(
      <CreateDebtNoticeModal
        open={true}
        homeowners={mockHomeowners}
        onFetchOutstanding={onFetchOutstanding}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    // Step 1: Select homeowner
    fireEvent.click(screen.getByRole('button', { name: /นายสมหมาย ใจดี/i }))

    // Step 2: Outstanding balance is fetched and invoices are shown
    await waitFor(() => {
      expect(onFetchOutstanding).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText(/INV-2569-09-0001/i)).toBeInTheDocument()
    expect(screen.getByText(/INV-2569-10-0001/i)).toBeInTheDocument()
    expect(screen.getByText(/ยอดรวมค้างชำระ ฿128\.40/)).toBeInTheDocument()

    // Step 3: Confirm creation
    fireEvent.click(screen.getByRole('button', { name: /ยืนยันสร้างใบแจ้งเตือน/i }))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({
        user_id: 1,
        invoice_ids: [10, 11],
      })
    })
  })

  it('shows cut meter form with meter_reading input and submits cut command', async () => {
    const onCut = vi.fn().mockResolvedValue({
      ...mockPendingNotice,
      status: 'cut',
      cut_meter_reading: 125.5,
    })
    const onRestore = vi.fn()

    render(
      <MeterCutScreen
        notice={mockPendingNotice}
        onCut={onCut}
        onRestore={onRestore}
      />
    )

    const readingInput = screen.getByLabelText(/เลขมิเตอร์ล่าสุด/i) as HTMLInputElement
    expect(readingInput).toBeInTheDocument()

    fireEvent.change(readingInput, { target: { value: '125.5' } })
    fireEvent.click(screen.getByRole('button', { name: /ยืนยันตัดมิเตอร์/i }))

    await waitFor(() => {
      expect(onCut).toHaveBeenCalledWith('dn-001', 125.5)
    })
  })

  it('restore button disabled when outstanding > 0 and enabled when outstanding === 0', async () => {
    const onCut = vi.fn()
    const onRestore = vi.fn().mockResolvedValue({
      ...mockCutNotice,
      status: 'restored',
    })

    // Case 1: outstanding > 0 -> restore button disabled
    const { rerender } = render(
      <MeterCutScreen
        notice={mockCutNotice}
        outstandingTotal={128.4}
        onCut={onCut}
        onRestore={onRestore}
      />
    )

    const restoreBtnDisabled = screen.getByRole('button', { name: /บันทึกเปิดคืน/i })
    expect(restoreBtnDisabled).toBeDisabled()

    // Case 2: outstanding === 0 -> restore button enabled and triggers restore
    rerender(
      <MeterCutScreen
        notice={mockCutNotice}
        outstandingTotal={0}
        onCut={onCut}
        onRestore={onRestore}
      />
    )

    const restoreBtnEnabled = screen.getByRole('button', { name: /บันทึกเปิดคืน/i })
    expect(restoreBtnEnabled).toBeEnabled()

    fireEvent.click(restoreBtnEnabled)
    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith('dn-002')
    })
  })

  it('renders DebtNoticeListScreen with RBAC actions for admin vs tabwater_staff', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [mockPendingNotice, mockCutNotice] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Staff view: sees list & cut meter button, but NOT Admin create notice button
    const { rerender } = render(
      <DebtNoticeListScreen
        token="test-token"
        currentRole="tabwater_staff"
        homeowners={mockHomeowners}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText(/นายสมหมาย ใจดี/i).length).toBeGreaterThan(0)
    })
    expect(screen.queryByRole('button', { name: /สร้างใบแจ้งเตือน/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ตัดมิเตอร์$/ })).toBeInTheDocument()

    // Admin view: sees create notice button
    rerender(
      <DebtNoticeListScreen
        token="test-token"
        currentRole="admin"
        homeowners={mockHomeowners}
      />
    )
    expect(screen.getByRole('button', { name: /สร้างใบแจ้งเตือน/i })).toBeInTheDocument()
  })

  it('calls backend debt-notice API endpoints with expected methods, paths, and payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invoices: mockUnpaidInvoices, total: 128.4 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [mockPendingNotice] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockPendingNotice,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCutNotice,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...mockCutNotice, status: 'restored' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const out = await fetchUserOutstanding(1, 'tok')
    expect(out.total).toBe(128.4)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/users/1/outstanding',
      expect.objectContaining({ headers: expect.any(Headers) })
    )

    const list = await fetchDebtNotices({ status: 'pending', user_id: 1 }, 'tok')
    expect(list).toHaveLength(1)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/debt-notices?status=pending&user_id=1',
      expect.objectContaining({ headers: expect.any(Headers) })
    )

    await createDebtNotice({ user_id: 1, invoice_ids: [10, 11] }, 'tok')
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/debt-notices',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 1, invoice_ids: [10, 11] }),
      })
    )

    await cutMeter('dn-001', 125.5, 'tok')
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/debt-notices/dn-001/cut',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ meter_reading: 125.5 }),
      })
    )

    await restoreMeter('dn-002', 'tok')
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/debt-notices/dn-002/restore',
      expect.objectContaining({
        method: 'PATCH',
      })
    )
  })

  it('opens CreateDebtNoticeModal from DebtNoticeListScreen without hook errors, resets state on close/reopen, and navigates to MeterCutScreen', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/v1/debt-notices')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ items: [mockPendingNotice, mockCutNotice] }),
        })
      }
      if (url === '/api/v1/users/1/outstanding') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ invoices: mockUnpaidInvoices, total: 128.4 }),
        })
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DebtNoticeListScreen
        token="test-token"
        currentRole="admin"
        homeowners={mockHomeowners}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText(/นายสมหมาย ใจดี/i).length).toBeGreaterThan(0)
    })

    // Transition CreateDebtNoticeModal open: false -> true
    fireEvent.click(screen.getByRole('button', { name: /\+ สร้างใบแจ้งเตือนหนี้/i }))
    expect(screen.getByRole('dialog', { name: /สร้างใบแจ้งเตือนหนี้ค้างชำระ/i })).toBeInTheDocument()

    // Filter and select homeowner inside modal
    fireEvent.change(screen.getByLabelText(/ค้นหาและเลือกลูกบ้าน/i), { target: { value: 'สมหมาย' } })
    fireEvent.click(screen.getByRole('button', { name: /นายสมหมาย ใจดี/i }))
    expect(await screen.findByText(/INV-2569-09-0001/i)).toBeInTheDocument()

    // Close and reopen -> state must be cleanly reset
    fireEvent.click(screen.getByRole('button', { name: /ยกเลิก/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /\+ สร้างใบแจ้งเตือนหนี้/i }))
    expect((screen.getByLabelText(/ค้นหาและเลือกลูกบ้าน/i) as HTMLInputElement).value).toBe('')
    expect(screen.queryByText(/INV-2569-09-0001/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ยกเลิก/i }))

    // Click cut meter action from list -> transitions to MeterCutScreen
    fireEvent.click(screen.getByRole('button', { name: /^ตัดมิเตอร์$/ }))
    expect(screen.getByLabelText(/เลขมิเตอร์ล่าสุด/i)).toBeInTheDocument()

    // Return back to list
    fireEvent.click(screen.getByRole('button', { name: /กลับหน้ารายการ/i }))
    expect(screen.getByRole('button', { name: /^ตัดมิเตอร์$/ })).toBeInTheDocument()
  })

  it('ignores stale out-of-order onFetchOutstanding responses when switching homeowners rapidly', async () => {
    let resolveUser1!: (value: OutstandingBalanceResponse) => void
    let resolveUser2!: (value: OutstandingBalanceResponse) => void

    const onFetchOutstanding = vi.fn().mockImplementation((userId: number) => {
      if (userId === 1) {
        return new Promise<OutstandingBalanceResponse>((resolve) => {
          resolveUser1 = resolve
        })
      }
      return new Promise<OutstandingBalanceResponse>((resolve) => {
        resolveUser2 = resolve
      })
    })

    const user2Invoice: WaterInvoiceItem = {
      ...mockUnpaidInvoices[0],
      id: 22,
      inv_no: 'INV-USER2-0001',
      totalpaid: 99.5,
    }

    render(
      <CreateDebtNoticeModal
        open={true}
        homeowners={mockHomeowners}
        onFetchOutstanding={onFetchOutstanding}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    )

    // Rapidly click user 1, then user 2 before user 1 finishes
    fireEvent.click(screen.getByRole('button', { name: /นายสมหมาย ใจดี/i }))
    fireEvent.click(screen.getByRole('button', { name: /นางมาลี รักน้ำ/i }))

    // User 2 resolves first
    resolveUser2({ user_id: 2, invoices: [user2Invoice], total: 99.5 })
    expect(await screen.findByText(/INV-USER2-0001/i)).toBeInTheDocument()

    // Stale user 1 response resolves later -> must be ignored
    resolveUser1({ user_id: 1, invoices: mockUnpaidInvoices, total: 128.4 })
    await waitFor(() => {
      expect(screen.getByText(/INV-USER2-0001/i)).toBeInTheDocument()
      expect(screen.queryByText(/INV-2569-09-0001/i)).not.toBeInTheDocument()
    })
  })

  it('surfaces a visible warning alert and keeps restore disabled when live outstanding check fails in MeterCutScreen', async () => {
    const onFetchOutstanding = vi.fn().mockRejectedValue(new Error('HTTP 503'))

    render(
      <MeterCutScreen
        notice={mockCutNotice}
        onFetchOutstanding={onFetchOutstanding}
        onCut={vi.fn()}
        onRestore={vi.fn()}
      />
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/ไม่สามารถตรวจสอบยอดค้างชำระล่าสุดได้/i)
    expect(alert).toHaveTextContent(/HTTP 503/i)
    expect(screen.getByRole('button', { name: /บันทึกเปิดคืน/i })).toBeDisabled()
  })
})
