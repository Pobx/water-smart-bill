import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '@/app/App'
import {
  IncidentDashboard,
  IncidentDetailModal,
  type Incident,
} from '@/features/incidents'

const mockOpenIncident: Incident = {
  id: '11111111-1111-4111-8111-111111111111',
  org_id: 1,
  reporter_user_id: 10,
  reporter_name: 'นายสมหมาย ใจดี',
  incident_type: 'broken_pipe',
  description: 'ท่อเมนหน้าปากซอยแตก น้ำพุ่งแรง',
  photo_url: '/uploads/incidents/inc-1.jpg',
  status: 'open',
  created_at: '2026-11-28T08:30:00Z',
}

const mockInProgressIncident: Incident = {
  id: '22222222-2222-4222-8222-222222222222',
  org_id: 1,
  reporter_user_id: 11,
  reporter_name: 'นางมาลี รักน้ำ',
  incident_type: 'cloudy_water',
  description: 'น้ำประปามีสีขุ่นเหลืองตั้งแต่เช้า',
  status: 'in_progress',
  assigned_to: 2,
  assigned_at: '2026-11-28T09:00:00Z',
  created_at: '2026-11-28T07:15:00Z',
}

const mockResolvedIncident: Incident = {
  id: '33333333-3333-4333-8333-333333333333',
  org_id: 1,
  reporter_user_id: 12,
  reporter_name: 'นายวิชัย สายน้ำ',
  incident_type: 'no_water',
  description: 'น้ำไม่ไหลทั้งซอย',
  status: 'resolved',
  assigned_to: 2,
  assigned_at: '2026-11-27T10:00:00Z',
  resolved_at: '2026-11-27T14:00:00Z',
  resolution_note: 'ซ่อมวาล์วเมนเรียบร้อย',
  created_at: '2026-11-27T09:30:00Z',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function signInAs(username: string, password = 'water1234') {
  fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/i }))
  await waitFor(() => {
    expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
  })
}

describe('incidents feature (Staff Dashboard)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('shows incident list with status badges and filters by status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/incidents') {
        return jsonResponse({
          items: [mockOpenIncident, mockInProgressIncident, mockResolvedIncident],
        })
      }
      if (url === '/api/v1/incidents?status=open') {
        return jsonResponse({
          items: [mockOpenIncident],
        })
      }
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<IncidentDashboard token="staff-token" currentStaffId={2} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมหมาย ใจดี')).toBeInTheDocument()
    })

    expect(screen.getByText('นางมาลี รักน้ำ')).toBeInTheDocument()
    expect(screen.getByText('นายวิชัย สายน้ำ')).toBeInTheDocument()

    // Check incident types in Thai
    expect(screen.getByText(/ท่อแตก/)).toBeInTheDocument()
    expect(screen.getByText(/น้ำขุ่น/)).toBeInTheDocument()
    expect(screen.getByText(/น้ำไม่ไหล/)).toBeInTheDocument()

    // Check status badges (open=red, in_progress=yellow/amber, resolved=green/emerald)
    const openBadge = screen.getByTestId(`status-badge-${mockOpenIncident.id}`)
    const inProgressBadge = screen.getByTestId(`status-badge-${mockInProgressIncident.id}`)
    const resolvedBadge = screen.getByTestId(`status-badge-${mockResolvedIncident.id}`)

    expect(openBadge.className).toMatch(/rose|red/)
    expect(inProgressBadge.className).toMatch(/amber|yellow/)
    expect(resolvedBadge.className).toMatch(/emerald|green/)

    // Filter dropdown -> open
    const filterSelect = screen.getByLabelText('กรองตามสถานะ')
    fireEvent.change(filterSelect, { target: { value: 'open' } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/incidents?status=open',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      )
      expect(screen.queryByText('นางมาลี รักน้ำ')).not.toBeInTheDocument()
    })
    expect(screen.getByText('นายสมหมาย ใจดี')).toBeInTheDocument()
  })

  it('assign button changes status to in_progress', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/v1/incidents' && (!init?.method || init.method === 'GET')) {
        return jsonResponse({ items: [mockOpenIncident] })
      }
      if (
        url === `/api/v1/incidents/${mockOpenIncident.id}/assign` &&
        init?.method === 'PATCH'
      ) {
        return jsonResponse({
          ...mockOpenIncident,
          status: 'in_progress',
          assigned_to: 7,
          assigned_at: '2026-11-28T10:00:00Z',
        })
      }
      return jsonResponse({ detail: 'unexpected call' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<IncidentDashboard token="staff-token" currentStaffId={7} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมหมาย ใจดี')).toBeInTheDocument()
    })

    const row = screen.getByText('นายสมหมาย ใจดี').closest('tr')!
    const assignBtn = within(row).getByRole('button', { name: /รับงาน/i })
    fireEvent.click(assignBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/incidents/${mockOpenIncident.id}/assign`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ staff_id: 7 }),
        })
      )
    })

    const badge = screen.getByTestId(`status-badge-${mockOpenIncident.id}`)
    expect(badge).toHaveTextContent('กำลังดำเนินการ')
    expect(within(row).queryByRole('button', { name: /รับงาน/i })).not.toBeInTheDocument()
  })

  it('resolve requires resolution_note not empty', async () => {
    const onResolve = vi.fn(async (id: string, note: string): Promise<Incident> => ({
      ...mockInProgressIncident,
      id,
      status: 'resolved',
      resolution_note: note,
      resolved_at: '2026-11-28T12:00:00Z',
    }))
    const onFetchDetail = vi.fn(async (): Promise<Incident> => mockInProgressIncident)

    render(
      <IncidentDetailModal
        open={true}
        incidentId={mockInProgressIncident.id}
        onFetchDetail={onFetchDetail}
        onAssign={vi.fn()}
        onResolve={onResolve}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('นางมาลี รักน้ำ')).toBeInTheDocument()
    })

    const noteTextarea = screen.getByLabelText(/บันทึกการแก้ไข/i)
    fireEvent.change(noteTextarea, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /ปิดงาน/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/กรุณาระบุบันทึกการแก้ไข/i)
    expect(onResolve).not.toHaveBeenCalled()

    fireEvent.change(noteTextarea, { target: { value: '  ล้างท่อเมนและระบายตะกอนแล้ว  ' } })
    fireEvent.click(screen.getByRole('button', { name: /ปิดงาน/i }))

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith(
        mockInProgressIncident.id,
        'ล้างท่อเมนและระบายตะกอนแล้ว'
      )
    })
  })

  it('detail modal opens from dashboard, fetches detail, and shows google maps link when lat/lng present', async () => {
    const detailWithCoords: Incident = {
      ...mockOpenIncident,
      lat: 13.7,
      lng: 100.5,
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/incidents') {
        return jsonResponse({ items: [mockOpenIncident, mockInProgressIncident] })
      }
      if (url === `/api/v1/incidents/${mockOpenIncident.id}`) {
        return jsonResponse(detailWithCoords)
      }
      if (url === `/api/v1/incidents/${mockInProgressIncident.id}`) {
        return jsonResponse(mockInProgressIncident)
      }
      return jsonResponse({ detail: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<IncidentDashboard token="staff-token" currentStaffId={2} />)

    await waitFor(() => {
      expect(screen.getByText('นายสมหมาย ใจดี')).toBeInTheDocument()
    })

    const row1 = screen.getByText('นายสมหมาย ใจดี').closest('tr')!
    fireEvent.click(within(row1).getByRole('button', { name: /ดูรายละเอียด/i }))

    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(within(dialog).getByText('ท่อเมนหน้าปากซอยแตก น้ำพุ่งแรง')).toBeInTheDocument()
    })

    const mapLink = within(dialog).getByRole('link', { name: /เปิดใน Google Maps/i })
    expect(mapLink).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=13.7%2C100.5'
    )
    expect(mapLink).toHaveAttribute('target', '_blank')
    expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer')

    const photo = within(dialog).getByRole('img', { name: /ภาพประกอบเหตุขัดข้อง/i })
    expect(photo).toHaveAttribute('src', '/uploads/incidents/inc-1.jpg')

    // Close modal and open an incident without GPS coordinates -> state resets cleanly
    fireEvent.click(within(dialog).getByRole('button', { name: /ปิดหน้าต่าง/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const row2 = screen.getByText('นางมาลี รักน้ำ').closest('tr')!
    fireEvent.click(within(row2).getByRole('button', { name: /ดูรายละเอียด/i }))

    const dialog2 = await screen.findByRole('dialog')
    await waitFor(() => {
      expect(within(dialog2).getByText('น้ำประปามีสีขุ่นเหลืองตั้งแต่เช้า')).toBeInTheDocument()
    })
    expect(within(dialog2).queryByRole('link', { name: /เปิดใน Google Maps/i })).not.toBeInTheDocument()
    expect(within(dialog2).getByText(/ไม่มีพิกัด GPS/i)).toBeInTheDocument()
  })

  it('wires incidents tab into App with RBAC restricted to admin and tabwater_staff', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline fallback for RBAC test'))
    )

    render(<App />)
    await signInAs('somchai_staff')

    const sidebar = screen.getByLabelText('Left Sidebar')
    const incidentsTabBtn = within(sidebar).getByRole('button', { name: /8\. แจ้งเหตุขัดข้อง/i })
    expect(incidentsTabBtn).toBeInTheDocument()
    fireEvent.click(incidentsTabBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /รายการแจ้งเหตุขัดข้องน้ำประปา/i })).toBeInTheDocument()
    })

    // Logout and login as resident -> must NOT see incidents tab in sidebar
    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    })
    await signInAs('resident_sommai')
    expect(
      within(screen.getByLabelText('Left Sidebar')).queryByRole('button', {
        name: /8\. แจ้งเหตุขัดข้อง/i,
      })
    ).not.toBeInTheDocument()

    // Logout and login as finance_staff -> must NOT see incidents tab in sidebar
    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    })
    await signInAs('finance_naree')
    expect(
      within(screen.getByLabelText('Left Sidebar')).queryByRole('button', {
        name: /8\. แจ้งเหตุขัดข้อง/i,
      })
    ).not.toBeInTheDocument()
  })
})
