import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '@/app/App'

function loginAs(username: string, password = 'water1234') {
  fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/i }))
}

describe('Login Gate & Role-Based UI (Keycloak + Fallback)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Keycloak offline in unit test'))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('shows Login Screen first when unauthenticated and does not auto-login somchai_staff', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /เข้าสู่ระบบ/i })).toBeInTheDocument()
    expect(screen.getByLabelText('ชื่อผู้ใช้')).toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.queryByText(/ผู้ใช้: somchai_staff/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Left Sidebar')).not.toBeInTheDocument()
  })

  it('rejects invalid credentials and keeps user on Login Screen', async () => {
    render(<App />)

    loginAs('somchai_staff', 'wrong-password')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/i)
    })
    expect(screen.queryByLabelText('Left Sidebar')).not.toBeInTheDocument()
  })

  it('shows only tabwater_staff UI when logging in as somchai_staff without a free role switcher', async () => {
    render(<App />)

    loginAs('somchai_staff')

    await waitFor(() => {
      expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
    })
    expect(screen.getByText(/somchai_staff/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2. อัตราค่าน้ำ & ทะเบียนมิเตอร์น้ำ/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /4. การเงิน & รับชำระ/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /5. LINE LIFF ลูกบ้าน/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('เลือกบทบาท (Role)')).not.toBeInTheDocument()
  })

  it('shows only finance_staff UI when logging in as finance_naree', async () => {
    render(<App />)

    loginAs('finance_naree')

    await waitFor(() => {
      expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
    })
    expect(screen.getByText(/finance_naree/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2. อัตราค่าน้ำ & ทะเบียนมิเตอร์น้ำ/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4. การเงิน & รับชำระ/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /5. LINE LIFF ลูกบ้าน/i })).not.toBeInTheDocument()
  })

  it('shows only LINE LIFF UI when logging in as resident_sommai (user)', async () => {
    render(<App />)

    loginAs('resident_sommai')

    await waitFor(() => {
      expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /5. LINE LIFF ลูกบ้าน/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /3. จดมิเตอร์ & ออกบิล Bluetooth/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /4. การเงิน & รับชำระ/i })).not.toBeInTheDocument()
  })

  it('returns to Login Screen after clicking logout', async () => {
    render(<App />)

    loginAs('admin_hsg')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1. ข้อมูล อบต./i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ออกจากระบบ/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /เข้าสู่ระบบ/i })).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Left Sidebar')).not.toBeInTheDocument()
  })

  it('authenticates against Keycloak token endpoint when available and decodes UTF-8 JWT roles', async () => {
    const payloadObj = {
      preferred_username: 'kc_finance',
      name: 'นารี จากคีย์โคลก',
      realm_access: { roles: ['finance_staff'] },
    }
    const base64Payload = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payloadObj)))
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const fakeJwt = `eyJhbGciOiJSUzI1NiJ9.${base64Payload}.signature`

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ access_token: fakeJwt }),
      })
    )

    render(<App />)
    loginAs('kc_finance', 'secret123')

    await waitFor(() => {
      expect(screen.getByLabelText('Left Sidebar')).toBeInTheDocument()
    })
    expect(screen.getByText(/นารี จากคีย์โคลก/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4. การเงิน & รับชำระ/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1. ข้อมูล อบต./i })).not.toBeInTheDocument()
  })
})
