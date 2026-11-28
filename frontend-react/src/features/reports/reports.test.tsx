import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import { App } from '@/app/App'
import {
  DailyCollectionReport,
  fetchCollectionReport,
  sanitizeCellValue,
  useExcelExport,
  type CollectionSummaryReport,
} from '@/features/reports'

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>()
  return {
    ...actual,
    utils: {
      ...actual.utils,
      json_to_sheet: vi.fn(actual.utils.json_to_sheet),
      book_new: vi.fn(actual.utils.book_new),
      book_append_sheet: vi.fn(actual.utils.book_append_sheet),
    },
    writeFile: vi.fn(),
  }
})

const mockReport: CollectionSummaryReport = {
  period_id: 1,
  period_name: 'งวดที่ 11/2569',
  total_invoices: 2,
  paid_invoices: 2,
  unpaid_invoices: 0,
  total_units_used: 25,
  total_water_charge: 125,
  total_reserve_fee: 20,
  total_vat_amount: 10.15,
  total_collected: 155.15,
  total_cash: 100.15,
  total_promptpay: 55,
  generated_at: '2026-11-28T10:00:00Z',
  invoices: [
    {
      id: 101,
      inv_no: 'INV-2569-11-0001',
      period_name: '11/2569',
      meter_id: 1,
      meternumber: 'HSG-0001',
      homeowner_name: 'นายสมหมาย ใจดี',
      house_no: '101/1',
      zone_name: 'หมู่ที่ 1',
      lastmeter: 120,
      currentmeter: 135,
      water_used: 15,
      paid: 75,
      reserve_meter: 10,
      vat: 5.95,
      totalpaid: 90.95,
      reading_photo_url: '',
      ocr_text: '',
      ocr_confidence: 0,
      status: 'paid',
      payment_method: 'cash',
      receipt_no: 'RC-001',
      paid_at: '2026-11-28T09:15:00Z',
      cashier_id: 7,
      recorded_at: '2026-11-20T08:00:00Z',
    },
    {
      id: 102,
      inv_no: 'INV-2569-11-0002',
      period_name: '11/2569',
      meter_id: 2,
      meternumber: 'HSG-0002',
      homeowner_name: '=SUM(A1)',
      house_no: '102/2',
      zone_name: 'หมู่ที่ 1',
      lastmeter: 50,
      currentmeter: 60,
      water_used: 10,
      paid: 50,
      reserve_meter: 10,
      vat: 4.2,
      totalpaid: 64.2,
      reading_photo_url: '',
      ocr_text: '',
      ocr_confidence: 0,
      status: 'paid',
      payment_method: 'promptpay',
      receipt_no: 'RC-002',
      paid_at: '2026-11-28T10:30:00Z',
      cashier_id: 8,
      recorded_at: '2026-11-20T08:05:00Z',
    },
  ],
}

describe('reports feature (DailyCollectionReport + useExcelExport)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches collection report with date range (from, to)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockReport,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCollectionReport(
      { from: '2026-11-01', to: '2026-11-30' },
      'jwt-finance-token'
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tabwater/reports/collections?from=2026-11-01&to=2026-11-30',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    )
    const callHeaders = fetchMock.mock.calls[0][1].headers as Headers
    expect(callHeaders.get('Authorization')).toBe('Bearer jwt-finance-token')
    expect(result.total_collected).toBe(155.15)
    expect(result.invoices).toHaveLength(2)
  })

  it('renders DailyCollectionReport with date range picker, rows, and footer totals', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockReport,
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DailyCollectionReport
        token="jwt-finance-token"
        initialFrom="2026-11-01"
        initialTo="2026-11-30"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('นายสมหมาย ใจดี')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tabwater/reports/collections?from=2026-11-01&to=2026-11-30',
      expect.any(Object)
    )

    // Verify required columns
    expect(screen.getByRole('columnheader', { name: 'วันที่' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'บ้านเลขที่' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ชื่อ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'จำนวนหน่วย' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ยอดชำระ' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ผู้รับเงิน' })).toBeInTheDocument()

    // Change date range and verify refetch with new from/to
    fireEvent.change(screen.getByLabelText('วันที่เริ่มต้น'), {
      target: { value: '2026-11-10' },
    })
    fireEvent.change(screen.getByLabelText('วันที่สิ้นสุด'), {
      target: { value: '2026-11-28' },
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/tabwater/reports/collections?from=2026-11-10&to=2026-11-28',
        expect.any(Object)
      )
    })

    // Footer totals visible
    expect(screen.getByText(/ยอดรวมทั้งหมด/i)).toBeInTheDocument()
    expect(screen.getAllByText(/155\.15/).length).toBeGreaterThan(0)
  })

  it('clicking Export Excel triggers XLSX.writeFile with sanitized rows and .xlsx filename', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockReport,
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <DailyCollectionReport
        token="jwt-finance-token"
        initialFrom="2026-11-01"
        initialTo="2026-11-30"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('นายสมหมาย ใจดี')).toBeInTheDocument()
    })

    const exportBtn = screen.getByRole('button', { name: /Export Excel/i })
    fireEvent.click(exportBtn)

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(1)
    const passedRows = vi.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0] as Array<
      Record<string, unknown>
    >
    expect(passedRows).toHaveLength(2)
    expect(passedRows[0]['บ้านเลขที่']).toBe('101/1')
    expect(passedRows[0]['ชื่อ']).toBe('นายสมหมาย ใจดี')
    // Formula injection in second row must be neutralized
    expect(passedRows[1]['ชื่อ']).toBe("'=SUM(A1)")

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1)
    const filename = vi.mocked(XLSX.writeFile).mock.calls[0][1]
    expect(filename).toBe('collection-report-2026-11-01-to-2026-11-30.xlsx')
    expect(filename).toMatch(/\.xlsx$/)
  })

  it('sanitizes formula injection prefixes (=, +, -, @) via useExcelExport and sanitizeCellValue', () => {
    expect(sanitizeCellValue('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(sanitizeCellValue('+1+1')).toBe("'+1+1")
    expect(sanitizeCellValue('-2+3')).toBe("'-2+3")
    expect(sanitizeCellValue('@SUM(1,2)')).toBe("'@SUM(1,2)")
    expect(sanitizeCellValue('นายสมหมาย ใจดี')).toBe('นายสมหมาย ใจดี')
    expect(sanitizeCellValue(125.5)).toBe(125.5)

    const { result } = renderHook(() => useExcelExport())
    result.current.exportToXlsx(
      [
        {
          วันที่: '2026-11-28',
          บ้านเลขที่: '101/1',
          ชื่อ: '=SUM(A1)',
          จำนวนหน่วย: 10,
          ยอดชำระ: 64.2,
          ผู้รับเงิน: '+cmd|calc',
        },
      ],
      'test-export.xlsx'
    )

    const sheetInput = vi.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0] as Array<
      Record<string, unknown>
    >
    expect(sheetInput[0]['ชื่อ']).toBe("'=SUM(A1)")
    expect(sheetInput[0]['ผู้รับเงิน']).toBe("'+cmd|calc")
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'test-export.xlsx')
  })

  it('displays error alert when API request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
    )

    render(<DailyCollectionReport initialFrom="2026-11-01" initialTo="2026-11-30" />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('HTTP 500')
    })
    expect(screen.getByRole('button', { name: /Export Excel/i })).toBeDisabled()
  })

  it('allows finance_staff and admin to access reports tab in App while hiding from tabwater_staff', async () => {
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline fallback in test'))
    )

    render(<App />)

    // Login as finance_staff
    fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: 'finance_naree' } })
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'water1234' } })
    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
    })
    const reportsMenuBtn = screen.getByRole('button', { name: /7. รายงานการรับชำระ/i })
    expect(reportsMenuBtn).toBeInTheDocument()

    fireEvent.click(reportsMenuBtn)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /รายงานการรับชำระค่าน้ำประปา/i })).toBeInTheDocument()
    })

    // Logout and verify tabwater_staff cannot see reports tab
    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: 'somchai_staff' } })
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'water1234' } })
    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /7. รายงานการรับชำระ/i })).not.toBeInTheDocument()

    sessionStorage.clear()
  })
})
