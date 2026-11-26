import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '@/app/App'

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
