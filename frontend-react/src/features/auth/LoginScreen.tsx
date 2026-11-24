import { useState, type FormEvent } from 'react'
import { DEMO_ACCOUNTS } from './authApi'

export interface LoginScreenProps {
  isLoggingIn: boolean
  authError: string | null
  logoutNotice: string | null
  onLogin: (username: string, password: string) => Promise<boolean>
}

export function LoginScreen({
  isLoggingIn,
  authError,
  logoutNotice,
  onLogin,
}: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onLogin(username, password)
  }

  function fillDemoAccount(demoUsername: string, demoPassword: string) {
    setUsername(demoUsername)
    setPassword(demoPassword)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-slate-50 to-cyan-50 p-4 text-slate-900">
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-2xl font-bold text-white shadow-md">
            💧
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            Water Smart Bill
          </h1>
          <p className="mt-1 text-xs font-medium text-sky-700">
            ระบบบริหารจัดการค่าน้ำประปา อบต. (Keycloak OIDC + RBAC)
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-900">เข้าสู่ระบบ</h2>
          <p className="mt-1 text-xs text-slate-500">
            กรุณาลงชื่อเข้าใช้งาน ระบบจะแสดงเมนูและหน้าจอตามสิทธิ์ (Role) ของบัญชีคุณ
          </p>

          {logoutNotice && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
            >
              {logoutNotice}
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-700"
              >
                ชื่อผู้ใช้
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น admin_hsg, somchai_staff"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700"
              >
                รหัสผ่าน
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                required
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          {/* Quick Demo Accounts Reference */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              บัญชีทดสอบตามบทบาท (รหัสผ่าน: water1234)
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => fillDemoAccount(acc.username, acc.password)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-left text-xs transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <span className="text-base">{acc.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-800">
                      {acc.username}
                    </div>
                    <div className="truncate text-[10px] text-slate-500">
                      {acc.roleLabel}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
