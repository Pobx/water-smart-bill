import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LiffPortalScreen,
  ReportIncidentForm,
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

function LiffPortalHarness() {
  const liffPortal = useLiffPortal(mockMeters, 'resident-jwt-token')
  return (
    <LiffPortalScreen
      {...liffPortal}
      orgName="องค์การบริหารส่วนตำบลห้องแซง"
      meters={mockMeters}
    />
  )
}

describe('ReportIncidentForm', () => {
  const originalGeolocation = navigator.geolocation
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.restoreAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:mock-incident-photo')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeolocation,
    })
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('shows all 4 incident type selector buttons as first step', () => {
    render(<ReportIncidentForm />)

    expect(screen.getByRole('button', { name: /น้ำไม่ไหล/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /น้ำขุ่น/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ท่อแตก/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /อื่น ๆ/ })).toBeInTheDocument()
  })

  it('calls geolocation API when user clicks GPS button and shows confirmation without raw coordinates', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 16.123456,
          longitude: 104.654321,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition)
    })

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })

    render(<ReportIncidentForm />)

    await user.click(screen.getByRole('button', { name: /ใช้ตำแหน่งปัจจุบัน/ }))

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/✅ ตำแหน่งถูกบันทึกแล้ว/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('16.123456')
    expect(document.body.textContent).not.toContain('104.654321')
  })

  it('allows submit without GPS and sends FormData without lat/lng or JSON Content-Type', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'inc-001',
          org_id: 1,
          reporter_user_id: 1,
          incident_type: 'broken_pipe',
          description: 'ท่อหน้าบ้านแตกน้ำพุ่ง',
          status: 'open',
          created_at: '2026-11-28T10:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ReportIncidentForm token="resident-token" />)

    await user.click(screen.getByRole('button', { name: /ท่อแตก/ }))
    await user.type(
      screen.getByPlaceholderText('อธิบายเหตุการณ์...'),
      'ท่อหน้าบ้านแตกน้ำพุ่ง'
    )
    await user.click(screen.getByRole('button', { name: /ส่งแจ้งเหตุ/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/incidents')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)

    const headers = init.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer resident-token')
    expect(headers.get('Content-Type')).toBeNull()

    const sentBody = init.body as FormData
    expect(sentBody.get('incident_type')).toBe('broken_pipe')
    expect(sentBody.get('description')).toBe('ท่อหน้าบ้านแตกน้ำพุ่ง')
    expect(sentBody.get('lat')).toBeNull()
    expect(sentBody.get('lng')).toBeNull()
    expect(sentBody.get('photo')).toBeNull()

    expect(await screen.findByText(/ส่งแจ้งเหตุเรียบร้อยแล้ว/)).toBeInTheDocument()
  })

  it('includes GPS coordinates in FormData when GPS succeeded', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 16.25,
          longitude: 104.75,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition)
    })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'inc-002',
          org_id: 1,
          reporter_user_id: 1,
          incident_type: 'no_water',
          description: '',
          status: 'open',
          created_at: '2026-11-28T10:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ReportIncidentForm />)

    await user.click(screen.getByRole('button', { name: /น้ำไม่ไหล/ }))
    await user.click(screen.getByRole('button', { name: /ใช้ตำแหน่งปัจจุบัน/ }))
    await user.click(screen.getByRole('button', { name: /ส่งแจ้งเหตุ/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const sentBody = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData
    expect(sentBody.get('lat')).toBe('16.25')
    expect(sentBody.get('lng')).toBe('104.75')
  })

  it('rejects non-image file (e.g. .pdf) and oversized file (>10MB) with error message', async () => {
    render(<ReportIncidentForm />)

    const fileInput = screen.getByLabelText(/แนบรูปภาพประกอบ/) as HTMLInputElement

    const pdfFile = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP/
    )
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    const bigBytes = new Uint8Array(10 * 1024 * 1024 + 1)
    const bigImage = new File([bigBytes], 'huge.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [bigImage] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/ไม่เกิน 10MB/)

    const svgFile = new File(['<svg></svg>'], 'xss.svg', { type: 'image/svg+xml' })
    fireEvent.change(fileInput, { target: { files: [svgFile] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG หรือ WebP/
    )
  })

  it('requires selecting an incident type before submitting', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ReportIncidentForm />)
    await user.click(screen.getByRole('button', { name: /ส่งแจ้งเหตุ/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/กรุณาเลือกประเภทเหตุ/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows submit even when GPS permission is denied and uploads valid photo in FormData', async () => {
    const user = userEvent.setup()
    const getCurrentPosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 1,
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError)
    })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'inc-003',
          org_id: 1,
          reporter_user_id: 1,
          incident_type: 'cloudy_water',
          description: 'น้ำขุ่นมาก',
          photo_url: '/uploads/incidents/inc-003.webp',
          status: 'open',
          created_at: '2026-11-28T10:05:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ReportIncidentForm />)

    await user.click(screen.getByRole('button', { name: /น้ำขุ่น/ }))
    await user.click(screen.getByRole('button', { name: /ใช้ตำแหน่งปัจจุบัน/ }))
    expect(screen.getByText(/ไม่สามารถระบุตำแหน่งได้/)).toBeInTheDocument()

    const fileInput = screen.getByLabelText(/แนบรูปภาพประกอบ/) as HTMLInputElement
    const webpFile = new File(['webp-bytes'], 'water.webp', { type: 'image/webp' })
    fireEvent.change(fileInput, { target: { files: [webpFile] } })

    await user.click(screen.getByRole('button', { name: /ส่งแจ้งเหตุ/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const sentBody = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData
    expect(sentBody.get('incident_type')).toBe('cloudy_water')
    expect(sentBody.get('lat')).toBeNull()
    expect(sentBody.get('lng')).toBeNull()
    expect(sentBody.get('photo')).toBe(webpFile)
  })

  it('creates and revokes object URL for valid photo preview on change and unmount', () => {
    const { unmount } = render(<ReportIncidentForm />)

    const fileInput = screen.getByLabelText(/แนบรูปภาพประกอบ/) as HTMLInputElement
    const img1 = new File(['jpg-bytes'], 'pipe1.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [img1] } })

    expect(URL.createObjectURL).toHaveBeenCalledWith(img1)
    expect(screen.getByAltText('ตัวอย่างรูปภาพเหตุการณ์')).toBeInTheDocument()

    const img2 = new File(['png-bytes'], 'pipe2.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [img2] } })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-incident-photo')

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('opens ReportIncidentForm from LiffPortalScreen when clicking แจ้งเหตุ', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    render(<LiffPortalHarness />)

    expect(screen.queryByPlaceholderText('อธิบายเหตุการณ์...')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /แจ้งเหตุ/ }))

    expect(screen.getByPlaceholderText('อธิบายเหตุการณ์...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /น้ำไม่ไหล/ })).toBeInTheDocument()
  })
})
