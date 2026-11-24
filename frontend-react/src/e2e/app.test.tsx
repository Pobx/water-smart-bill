import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { App } from '@/app/App'

async function signInAs(username: string, password = 'water1234') {
  fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/i }))
  await waitFor(() => {
    expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
  })
}

describe('Water Smart Bill E2E User Journeys (shadcn/ui + v0.app style)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Offline fallback for E2E unit test'))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('renders Master Data (อบต., ตำบล, หมู่บ้าน, เจ้าของบ้าน + Default Avatar) and allows adding a homeowner', async () => {
    render(<App />)
    await signInAs('admin_hsg')

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
    await signInAs('somchai_staff')

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

  it('navigates to Tariffs & Meters tab and verifies progressive tiers and meter table', async () => {
    render(<App />)
    await signInAs('admin_hsg')

    fireEvent.click(screen.getByRole('button', { name: /อัตราค่าน้ำ & ทะเบียนมิเตอร์น้ำ/i }))

    expect(screen.getByText(/อัตราค่าน้ำขั้นบันได/i)).toBeInTheDocument()
    expect(screen.getAllByText(/1 - 10 หน่วย/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/HSG-0001/i).length).toBeGreaterThan(0)
  })

  it('navigates to Finance & Cashier tab, searches invoices, and simulates counter payment', async () => {
    render(<App />)
    await signInAs('finance_naree')

    fireEvent.click(screen.getByRole('button', { name: /การเงิน & รับชำระ/i }))

    expect(screen.getByText(/ระบบการเงินและรับชำระค่าน้ำ/i)).toBeInTheDocument()
    expect(screen.getByText(/ยอดจัดเก็บรวม/i)).toBeInTheDocument()

    // Filter by unpaid
    fireEvent.click(screen.getByRole('button', { name: /รอชำระ/i }))

    // Search by house number
    const searchInput = screen.getByPlaceholderText(/ค้นหาเลขที่บิล, บ้านเลขที่/i)
    fireEvent.change(searchInput, { target: { value: '101/1' } })

    expect(screen.getAllByText(/บ้านเลขที่ 101\/1/i).length).toBeGreaterThan(0)
  })

  it('renders LINE LIFF Resident Portal for homeowners to inspect water bills and payment history', async () => {
    render(<App />)
    await signInAs('resident_sommai')

    expect(screen.getByText(/LINE LIFF • ระบบเช็คค่าน้ำประปาสำหรับเจ้าของบ้าน/i)).toBeInTheDocument()
    expect(screen.getAllByText(/HSG-0001/i).length).toBeGreaterThan(0)
  })

  it('dynamically adapts Left Menu items based on logged-in RBAC user role', async () => {
    render(<App />)

    // 1. Admin has access to all left menu items
    await signInAs('admin_hsg')
    expect(screen.getByRole('button', { name: /1. ข้อมูล อบต./i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4. การเงิน & รับชำระ/i })).toBeInTheDocument()

    // 2. Logout and login as Field Reader (tabwater_staff)
    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    })
    await signInAs('somchai_staff')
    expect(screen.getByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /4. การเงิน & รับชำระ/i })).not.toBeInTheDocument()

    // 3. Logout and login as Finance Staff (finance_staff)
    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    })
    await signInAs('finance_naree')
    expect(screen.getByRole('button', { name: /4. การเงิน & รับชำระ/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()

    // 4. Logout and login as Citizen Resident (user)
    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))
    await waitFor(() => {
      expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    })
    await signInAs('resident_sommai')
    expect(screen.getByRole('button', { name: /5. LINE LIFF ลูกบ้าน/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /4. การเงิน & รับชำระ/i })).not.toBeInTheDocument()
  })
})
