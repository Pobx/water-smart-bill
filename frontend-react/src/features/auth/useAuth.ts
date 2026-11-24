import { useState } from 'react'
import { authApi, type AuthSession, type UserRole } from './authApi'

export type { UserRole, AuthSession }

export interface RoleOption {
  id: UserRole
  name: string
  icon: string
  description: string
}

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'admin', name: 'ผู้ดูแลระบบ (Admin)', icon: '👑', description: 'เข้าถึงได้ทุกโมดูล' },
  { id: 'tabwater_staff', name: 'ช่างประปา / จดมิเตอร์', icon: '🔧', description: 'จดมิเตอร์ภาคสนาม & บลูทูธ' },
  { id: 'finance_staff', name: 'เจ้าหน้าที่การเงิน', icon: '💰', description: 'แคชเชียร์รับชำระ & รายงาน' },
  { id: 'user', name: 'ประชาชน / ลูกบ้าน', icon: '🏠', description: 'ตรวจสอบค่าน้ำผ่าน LINE LIFF' },
]

const SESSION_STORAGE_KEY = 'wsb_auth_session_v1'

function loadStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (
      !parsed ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.username !== 'string' ||
      !Array.isArray(parsed.roles) ||
      parsed.roles.length === 0
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function saveStoredSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession())
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    () => loadStoredSession()?.roles[0] ?? 'user'
  )
  const [revokedTokens, setRevokedTokens] = useState<string[]>([])
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null)

  const assignedRoles: UserRole[] = session?.roles ?? []
  const currentRole: UserRole =
    assignedRoles.length > 0
      ? assignedRoles.includes(selectedRole)
        ? selectedRole
        : assignedRoles[0]
      : 'user'

  function setCurrentRole(role: UserRole) {
    // Enforce RBAC: only allow switching among roles actually assigned to the logged-in user
    if (assignedRoles.includes(role)) {
      setSelectedRole(role)
    }
  }

  async function handleLogin(username: string, password: string): Promise<boolean> {
    setIsLoggingIn(true)
    setAuthError(null)
    setLogoutNotice(null)
    try {
      const nextSession = await authApi.login(username, password)
      saveStoredSession(nextSession)
      setSession(nextSession)
      setSelectedRole(nextSession.roles[0])
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบได้'
      setAuthError(msg)
      return false
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    const tokenToRevoke = session?.accessToken ?? ''
    if (tokenToRevoke) {
      if (!revokedTokens.includes(tokenToRevoke)) {
        setRevokedTokens((prev) => [tokenToRevoke, ...prev])
      }
      try {
        await authApi.logout(tokenToRevoke)
      } catch {
        // Best-effort server-side revocation; always clear local session
      }
    }
    saveStoredSession(null)
    setSession(null)
    setSelectedRole('user')
    setAuthError(null)
    setLogoutNotice('ออกจากระบบเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่เพื่อใช้งาน')
  }

  return {
    session,
    isAuthenticated: session !== null,
    jwtToken: session?.accessToken ?? '',
    username: session?.username ?? '',
    displayName: session?.displayName ?? '',
    authSource: session?.authSource ?? null,
    assignedRoles,
    currentRole,
    setCurrentRole,
    revokedTokens,
    isLoggingIn,
    authError,
    logoutNotice,
    handleLogin,
    handleLogout,
  }
}
