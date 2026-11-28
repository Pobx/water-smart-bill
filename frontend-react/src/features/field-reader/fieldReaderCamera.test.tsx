import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { getOfflineQueue } from '@/features/offline/offlineStore'
import { fieldReaderApi } from './fieldReaderApi'

async function signInAsFieldReader() {
  fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: 'somchai_staff' } })
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'water1234' } })
  fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/i }))
  await waitFor(() => {
    expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
  })
  fireEvent.click(screen.getByRole('button', { name: /จดมิเตอร์ & ออกบิล Bluetooth/i }))
}

describe('Field Reader Camera OCR (getUserMedia + Canvas Capture + Photo Upload)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline fallback for unit test'))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('opens live camera via getUserMedia, captures a photo frame for OCR, and stops stream tracks cleanly', async () => {
    const stopTrack = vi.fn()
    const mockStream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream

    const getUserMediaMock = vi.fn().mockResolvedValue(mockStream)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    })

    // Stub HTMLMediaElement.play & HTMLCanvasElement.toDataURL for jsdom
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray([200, 200, 200, 255, 180, 180, 180, 255]),
      }),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,FAKEIMG')

    render(<App />)
    await signInAsFieldReader()

    // Click open camera button
    fireEvent.click(screen.getByRole('button', { name: /เปิดกล้องสแกนมิเตอร์/i }))

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('กล้องสแกนมิเตอร์น้ำ')).toBeInTheDocument()
    })

    // Click capture & run OCR
    fireEvent.click(screen.getByRole('button', { name: /ถ่ายภาพและอ่านเลข OCR/i }))

    await waitFor(() => {
      expect(screen.getByAltText('ภาพหน้าปัดมิเตอร์ที่ถ่าย')).toBeInTheDocument()
      expect(stopTrack).toHaveBeenCalledTimes(1)
    })

    const readingInput = screen.getByLabelText('เลขมิเตอร์ครั้งนี้') as HTMLInputElement
    expect(Number(readingInput.value)).toBeGreaterThanOrEqual(142)
  })

  it('displays clear Thai error alert when camera permission is denied', async () => {
    const deniedError = new DOMException('Permission denied', 'NotAllowedError')
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(deniedError) },
    })

    render(<App />)
    await signInAsFieldReader()

    fireEvent.click(screen.getByRole('button', { name: /เปิดกล้องสแกนมิเตอร์/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(/ไม่ได้รับอนุญาตให้เข้าถึงกล้อง|ไม่สามารถเปิดกล้องได้/i)
    })
  })

  it('rejects non-image uploads (e.g. SVG) and accepts valid JPEG photo upload for OCR', async () => {
    render(<App />)
    await signInAsFieldReader()

    const fileInput = screen.getByLabelText('อัปโหลดรูปหน้าปัดมิเตอร์') as HTMLInputElement

    // Reject SVG
    const badFile = new File(['<svg></svg>'], 'evil.svg', { type: 'image/svg+xml' })
    fireEvent.change(fileInput, { target: { files: [badFile] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/รองรับเฉพาะไฟล์ภาพ/i)
    })

    // Accept JPEG with meter digits in filename
    const goodFile = new File(['fake-jpg-bytes'], 'meter_00168.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [goodFile] } })

    await waitFor(() => {
      const readingInput = screen.getByLabelText('เลขมิเตอร์ครั้งนี้') as HTMLInputElement
      expect(readingInput.value).toBe('168')
      expect(screen.getByAltText('ภาพหน้าปัดมิเตอร์ที่ถ่าย')).toBeInTheDocument()
    })
  })
})

describe('Field Reader Recorded / Pending Tabs & Edit Mode', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline fallback for unit test'))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('shows recorded tab and pending tab with count badges', async () => {
    render(<App />)
    await signInAsFieldReader()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /บันทึกแล้ว \(1\)/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /ยังไม่บันทึก \(1\)/ })).toBeInTheDocument()
    })
  })

  it('shows edit button only on recorded tab items in current period and populates form on click', async () => {
    render(<App />)
    await signInAsFieldReader()

    // Switch to "บันทึกแล้ว" tab
    const recordedTab = await screen.findByRole('tab', { name: /บันทึกแล้ว \(1\)/ })
    fireEvent.click(recordedTab)

    // In current period (11/2569), HSG-0001 has an unfinalized invoice -> edit button must be visible
    const editBtn = await screen.findByRole('button', { name: /แก้ไข/i })
    expect(editBtn).toBeInTheDocument()

    // Clicking edit populates current reading input with recorded reading (120)
    fireEvent.click(editBtn)
    const readingInput = screen.getByLabelText('เลขมิเตอร์ครั้งนี้') as HTMLInputElement
    expect(readingInput.value).toBe('120')

    // Switch to past period (10/2569) -> edit button must NOT be shown
    const user = userEvent.setup()
    const periodCombobox = screen.getByRole('combobox', { name: 'ประจำงวดบิล' })
    await user.click(periodCombobox)
    await user.click(screen.getByText('10/2569'))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /แก้ไข/i })).not.toBeInTheDocument()
    })
  })

  it('calls GET /api/v1/tabwater/readings via useFieldReader when online and merges remote readings', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/v1/tabwater/readings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({
            items: [
              {
                id: 99,
                inv_no: 'INV-REMOTE-99',
                org_id: 1,
                meter_id: 99,
                meternumber: 'HSG-0099',
                homeowner_name: 'นายออนไลน์ ทดสอบ',
                house_no: '99/9',
                zone_name: 'หมู่ที่ 1',
                period_id: 1,
                period_name: '11/2569',
                lastmeter: 50,
                currentmeter: 65,
                water_used: 15,
                totalpaid: 101.65,
                reading_status: 'recorded',
                invoice_status: 'invoice',
              },
            ],
          }),
        })
      }
      return Promise.reject(new TypeError('Offline fallback'))
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await signInAsFieldReader()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tabwater/readings?period_id=1'),
        expect.objectContaining({ method: 'GET' }),
      )
      // Local HSG-0001 + remote HSG-0099 => 2 recorded items
      expect(screen.getByRole('tab', { name: /บันทึกแล้ว \(2\)/ })).toBeInTheDocument()
    })
  })

  it('persists edited reading to offlineStore and cancels edit mode when switching meter', async () => {
    localStorage.clear()
    render(<App />)
    await signInAsFieldReader()

    // Open recorded tab and start editing HSG-0001
    fireEvent.click(await screen.findByRole('tab', { name: /บันทึกแล้ว \(1\)/ }))
    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/i }))
    expect(screen.getByText(/โหมดแก้ไขข้อมูลการจดมิเตอร์งวดปัจจุบัน/)).toBeInTheDocument()

    // Switching to another meter cancels edit mode so edits cannot apply to wrong meter
    const meterCombobox = screen.getByRole('combobox', { name: 'เลือกมิเตอร์น้ำ / บ้านเลขที่' })
    fireEvent.focus(meterCombobox)
    fireEvent.change(meterCombobox, { target: { value: 'HSG-0002' } })
    fireEvent.click(await screen.findByRole('option', { name: /HSG-0002/ }))
    await waitFor(() => {
      expect(screen.queryByText(/โหมดแก้ไขข้อมูลการจดมิเตอร์งวดปัจจุบัน/)).not.toBeInTheDocument()
    })

    // Re-enter edit mode on HSG-0001, update reading to 130, and submit -> must enqueue in offlineStore
    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/i }))
    const readingInput = screen.getByLabelText('เลขมิเตอร์ครั้งนี้') as HTMLInputElement
    fireEvent.change(readingInput, { target: { value: '130' } })
    fireEvent.click(screen.getByRole('button', { name: /บันทึกการแก้ไขมิเตอร์/ }))

    await waitFor(() => {
      const queue = getOfflineQueue()
      expect(queue.length).toBeGreaterThanOrEqual(1)
      expect(queue[0].meternumber).toBe('HSG-0001')
      expect(queue[0].current_meter).toBe(130)
      expect(queue[0].last_meter).toBe(105)
    })
    localStorage.clear()
  })

  it('calls GET /api/v1/tabwater/readings with period_id, status, and route_id via fieldReaderApi.fetchReadings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ items: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fieldReaderApi.fetchReadings({ periodId: 1, status: 'recorded', routeId: 2 }, 'tok-1')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/tabwater/readings?period_id=1&status=recorded&route_id=2'),
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
