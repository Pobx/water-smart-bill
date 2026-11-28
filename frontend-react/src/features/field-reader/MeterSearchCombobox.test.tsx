import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, renderHook, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OrganizationInfo, WaterMeterItem } from '@/shared/types/waterSmartBill'
import { fieldReaderApi } from './fieldReaderApi'
import { MeterSearchCombobox } from './MeterSearchCombobox'
import { useFieldReader } from './useFieldReader'

const mockMeters: WaterMeterItem[] = [
  {
    meter_id: 1,
    meternumber: 'MTR-0001',
    factory_no: 'FAC-001',
    user_id: 101,
    homeowner_name: 'นายสมชาย ใจดี',
    house_no: '12/1',
    zone_id: 1,
    zone_name: 'หมู่ 1 บ้านเหนือ',
    last_meter_recording: 120,
    status: 'active',
    route_id: 10,
  },
  {
    meter_id: 2,
    meternumber: 'MTR-0002',
    factory_no: 'FAC-002',
    user_id: 102,
    homeowner_name: 'นางสมหญิง รักน้ำ',
    house_no: '45/2',
    zone_id: 1,
    zone_name: 'หมู่ 1 บ้านเหนือ',
    last_meter_recording: 85,
    status: 'active',
    route_id: 20,
  },
  {
    meter_id: 3,
    meternumber: 'MTR-0003',
    factory_no: 'FAC-003',
    user_id: 103,
    homeowner_name: 'นายประเสริฐ มั่งมี',
    house_no: '99/9',
    zone_id: 2,
    zone_name: 'หมู่ 2 บ้านใต้',
    last_meter_recording: 210,
    status: 'active',
    route_id: 10,
  },
]

describe('MeterSearchCombobox', () => {
  it('renders meter items with house_no | homeowner_name | meternumber format', () => {
    render(<MeterSearchCombobox meters={mockMeters} onSelect={vi.fn()} />)

    expect(screen.getByText('12/1 | นายสมชาย ใจดี | MTR-0001')).toBeInTheDocument()
    expect(screen.getByText('45/2 | นางสมหญิง รักน้ำ | MTR-0002')).toBeInTheDocument()
    expect(screen.getByText('99/9 | นายประเสริฐ มั่งมี | MTR-0003')).toBeInTheDocument()
  })

  it('filters meters by search text (name, house_no, or meternumber)', async () => {
    const user = userEvent.setup()
    render(<MeterSearchCombobox meters={mockMeters} onSelect={vi.fn()} />)

    const input = screen.getByRole('combobox')
    await user.type(input, 'สมชาย')

    expect(screen.getByText(/สมชาย/)).toBeInTheDocument()
    expect(screen.queryByText(/สมหญิง/)).not.toBeInTheDocument()
    expect(screen.queryByText(/ประเสริฐ/)).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, '45/2')
    expect(screen.getByText(/สมหญิง/)).toBeInTheDocument()
    expect(screen.queryByText(/สมชาย/)).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'MTR-0003')
    expect(screen.getByText(/ประเสริฐ/)).toBeInTheDocument()
    expect(screen.queryByText(/สมชาย/)).not.toBeInTheDocument()
  })

  it('calls onSelect with meterId when item is clicked', async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()
    render(<MeterSearchCombobox meters={mockMeters} onSelect={handleSelect} />)

    await user.click(screen.getByText('45/2 | นางสมหญิง รักน้ำ | MTR-0002'))

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(2)
  })

  it('shows empty state message when no meters match search query', async () => {
    const user = userEvent.setup()
    render(<MeterSearchCombobox meters={mockMeters} onSelect={vi.fn()} />)

    await user.type(screen.getByRole('combobox'), 'ไม่พบข้อมูลแน่นอน999')

    expect(screen.getByText(/ไม่พบมิเตอร์ที่ตรงกับการค้นหา/)).toBeInTheDocument()
  })

  it('marks the currently selected meter with aria-selected or visual indicator', () => {
    render(<MeterSearchCombobox meters={mockMeters} selectedMeterId={2} onSelect={vi.fn()} />)

    const selectedItem = screen.getByText('45/2 | นางสมหญิง รักน้ำ | MTR-0002').closest('[data-selected-meter]')
    expect(selectedItem).toHaveAttribute('data-selected-meter', 'true')
  })
})

const mockOrgInfo: OrganizationInfo = {
  org_code: 'OBT-01',
  org_name: 'อบต.ทดสอบ',
  tambon_name: 'ต.ทดสอบ',
  district_name: 'อ.เมือง',
  province_name: 'จ.ทดสอบ',
  zipcode: '10000',
  phone: '02-000-0000',
  dept_name: 'กองช่าง',
  vat: 7,
}

describe('fieldReaderApi & useFieldReader route filter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetchMeterRoutes calls GET /api/v1/tabwater/meter-routes and returns route items', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: 10, org_id: 1, name: 'สาย 1 หมู่บ้านเหนือ', staff_id: 5 },
          { id: 20, org_id: 1, name: 'สาย 2 หมู่บ้านใต้', staff_id: null },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const routes = await fieldReaderApi.fetchMeterRoutes('demo-token')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tabwater/meter-routes',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(routes).toHaveLength(2)
    expect(routes[0].name).toBe('สาย 1 หมู่บ้านเหนือ')
  })

  it('shows all meters when selectedRouteId is null and filters meters when a route is selected', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/tabwater/meter-routes') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { id: 10, org_id: 1, name: 'สาย 1', staff_id: 5 },
              { id: 20, org_id: 1, name: 'สาย 2', staff_id: 6 },
            ],
          }),
        })
      }
      return Promise.reject(new TypeError('Offline fallback'))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useFieldReader({
        orgInfo: mockOrgInfo,
        meters: mockMeters,
        setMeters: vi.fn(),
        tiers: [{ tier_order: 1, min_units: 0, max_units: null, rate_per_unit: 10 }],
        reserveFee: 10,
        periods: ['11/2569'],
        invoices: [],
        setInvoices: vi.fn(),
      }),
    )

    await waitFor(() => {
      expect(result.current.routes).toHaveLength(2)
    })

    // Default: selectedRouteId === null -> all meters shown
    expect(result.current.selectedRouteId).toBeNull()
    expect(result.current.filteredMeters).toHaveLength(3)

    // Select route 10 -> filters to meters with route_id === 10
    act(() => {
      result.current.setSelectedRouteId(10)
    })

    await waitFor(() => {
      expect(result.current.filteredMeters.map((m) => m.meter_id)).toEqual([1, 3])
    })

    // Reset to All Routes (null) -> all meters shown again
    act(() => {
      result.current.setSelectedRouteId(null)
    })

    expect(result.current.filteredMeters).toHaveLength(3)
  })
})
