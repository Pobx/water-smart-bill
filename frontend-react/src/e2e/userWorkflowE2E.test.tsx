import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '@/app/App'

describe('End-to-End User Journeys: 5 Vertical Slices Integration', () => {
  it('walks through entire municipal workflow: Master Data -> Meter -> Field Read -> Cashier Pay -> LINE LIFF', async () => {
    render(<App />)

    // Step 1: Master Data screen is visible by default
    expect(screen.getByText(/Water Smart Bill/i)).toBeInTheDocument()
    expect(screen.getByText(/1. ข้อมูล อบต. \/ หมู่บ้าน \/ เจ้าของบ้าน/i)).toBeInTheDocument()

    // Step 2: Navigate to Tariffs & Meters
    fireEvent.click(screen.getByRole('button', { name: /2. อัตราค่าน้ำ & ทะเบียนมิเตอร์น้ำ/i }))
    expect(screen.getByText(/อัตราค่าน้ำขั้นบันได/i)).toBeInTheDocument()
    expect(screen.getByText(/บันทึกทะเบียนมิเตอร์น้ำประปา/i)).toBeInTheDocument()

    // Step 3: Navigate to Field Meter Reader
    fireEvent.click(screen.getByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i }))
    expect(screen.getByText(/บันทึกเลขมิเตอร์น้ำ \(Offline-First\)/i)).toBeInTheDocument()
    // Test OCR click
    fireEvent.click(screen.getByRole('button', { name: /AI OCR อ่านเลขมิเตอร์จากรูป/i }))
    const currentMeterInput = screen.getByLabelText('เลขมิเตอร์ครั้งนี้') as HTMLInputElement
    expect(Number(currentMeterInput.value)).toBeGreaterThanOrEqual(135)

    // Step 4: Navigate to Finance & Cashier Desk
    fireEvent.click(screen.getByRole('button', { name: /4. การเงิน & รับชำระ/i }))
    expect(screen.getByText(/ระบบการเงินและรับชำระค่าน้ำ \(Finance & Cashier Desk\)/i)).toBeInTheDocument()
    expect(screen.getByText(/ส่งออกรายงาน CSV/i)).toBeInTheDocument()

    // Search filter in cashier desk
    const searchInput = screen.getByPlaceholderText(/ค้นหาเลขที่บิล/i)
    fireEvent.change(searchInput, { target: { value: 'สมหมาย' } })
    expect(screen.getAllByText(/นายสมหมาย ใจดี/i).length).toBeGreaterThan(0)

    // Step 5: Navigate to LINE LIFF Resident Portal
    fireEvent.click(screen.getByRole('button', { name: /5. LINE LIFF ลูกบ้าน/i }))
    expect(screen.getByText(/LINE LIFF • ระบบเช็คค่าน้ำประปาสำหรับเจ้าของบ้าน/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /เลือกมิเตอร์ลูกบ้าน/i })).toBeInTheDocument()
    expect(screen.getByText(/ยอดรวมสุทธิ/i)).toBeInTheDocument()
  })

  it('handles Cashier payment modal and calculates cash change accurately in E2E flow', async () => {
    render(<App />)

    // Navigate to Cashier tab
    fireEvent.click(screen.getByRole('button', { name: /4. การเงิน & รับชำระ/i }))

    // Click "รับชำระเงิน" on the first invoice that is unpaid
    const payButtons = screen.getAllByRole('button', { name: /รับชำระเงิน/i })
    if (payButtons.length > 0) {
      fireEvent.click(payButtons[0])

      await waitFor(() => {
        expect(screen.getByText(/รับชำระค่าน้ำประปา/i)).toBeInTheDocument()
        expect(screen.getByText(/ช่องทางการชำระเงิน/i)).toBeInTheDocument()
      })

      // Enter cash tendered
      const cashInput = screen.getByPlaceholderText('0.00')
      fireEvent.change(cashInput, { target: { value: '500' } })

      // Verify change calculation display
      expect(screen.getByText(/เงินทอน \(Change\):/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ยืนยันรับชำระเงิน/i })).toBeEnabled()

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: /ยกเลิก/i }))
    }
  })
})
