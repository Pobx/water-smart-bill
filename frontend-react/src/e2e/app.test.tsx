import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '@/app/App'

describe('Water Smart Bill E2E User Journeys (shadcn/ui + v0.app style)', () => {
  it('renders Master Data (อบต., ตำบล, หมู่บ้าน, เจ้าของบ้าน + Default Avatar) and allows adding a homeowner', async () => {
    render(<App />)

    expect(screen.getByText(/Water Smart Bill/i)).toBeInTheDocument()
    expect(screen.getAllByText(/องค์การบริหารส่วนตำบลห้องแซง/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/นายสมหมาย ใจดี/i).length).toBeGreaterThan(0)

    // Verify Default Avatar img is rendered for homeowner without uploaded image
    const avatarImgs = screen.getAllByRole('img', { name: /Avatar/i })
    expect(avatarImgs.length).toBeGreaterThan(0)

    // Add a new homeowner without uploading an avatar -> gets automatic Default Avatar
    fireEvent.change(screen.getByLabelText('ชื่อเจ้าของบ้าน'), { target: { value: 'วิภา' } })
    fireEvent.change(screen.getByLabelText('นามสกุลเจ้าของบ้าน'), { target: { value: 'สุขใจ' } })
    fireEvent.change(screen.getByLabelText('บ้านเลขที่'), { target: { value: '309/2' } })
    fireEvent.click(screen.getByRole('button', { name: /บันทึกเจ้าของบ้าน/i }))

    await waitFor(() => {
      expect(screen.getAllByText(/วิภา สุขใจ/i).length).toBeGreaterThan(0)
    })
  })

  it('supports Offline-First meter reading, AI OCR scan, and Bluetooth ESC/POS receipt printing', async () => {
    render(<App />)

    // Navigate to Field Meter Reader tab
    fireEvent.click(screen.getByRole('button', { name: /จดมิเตอร์ & ออกบิล Bluetooth/i }))

    // Trigger AI OCR meter scan
    fireEvent.click(screen.getByRole('button', { name: /AI OCR อ่านเลขมิเตอร์จากรูป/i }))
    const readingInput = screen.getByLabelText('เลขมิเตอร์ครั้งนี้') as HTMLInputElement
    expect(Number(readingInput.value)).toBeGreaterThan(120)

    // Record meter reading & open Bluetooth ESC/POS receipt modal
    fireEvent.click(screen.getByRole('button', { name: /บันทึกมิเตอร์ & พิมพ์บิล Bluetooth/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Bluetooth ESC\/POS Receipt/i })).toBeInTheDocument()
    })
  })

  it('renders LINE LIFF Resident Portal for homeowners to inspect water bills and payment history', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /LINE LIFF ลูกบ้าน/i }))

    expect(screen.getByText(/LINE LIFF • ระบบเช็คค่าน้ำประปาสำหรับเจ้าของบ้าน/i)).toBeInTheDocument()
    expect(screen.getAllByText(/HSG-0001/i).length).toBeGreaterThan(0)
  })
})
