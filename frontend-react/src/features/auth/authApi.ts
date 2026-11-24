import { apiRequest } from '@/shared/api/httpClient'

export type UserRole = 'admin' | 'tabwater_staff' | 'finance_staff' | 'user'

export interface AuthSession {
  accessToken: string
  username: string
  displayName: string
  roles: UserRole[]
  authSource: 'keycloak' | 'demo'
}

export interface LogoutResponse {
  status: string
  revoked_jti: string
}

export interface DemoAccount {
  username: string
  password: string
  displayName: string
  roles: UserRole[]
  roleLabel: string
  icon: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'admin_hsg',
    password: 'water1234',
    displayName: 'ผู้ดูแลระบบ อบต.ห้องแซง',
    roles: ['admin'],
    roleLabel: 'ผู้ดูแลระบบ (Admin)',
    icon: '👑',
  },
  {
    username: 'somchai_staff',
    password: 'water1234',
    displayName: 'สมชาย การประปา',
    roles: ['tabwater_staff'],
    roleLabel: 'ช่างประปา / จดมิเตอร์',
    icon: '🔧',
  },
  {
    username: 'finance_naree',
    password: 'water1234',
    displayName: 'นารี การเงิน',
    roles: ['finance_staff'],
    roleLabel: 'เจ้าหน้าที่การเงิน',
    icon: '💰',
  },
  {
    username: 'resident_sommai',
    password: 'water1234',
    displayName: 'สมหมาย ใจดี',
    roles: ['user'],
    roleLabel: 'ประชาชน / ลูกบ้าน',
    icon: '🏠',
  },
]

interface RuntimeAppConfig {
  KEYCLOAK_AUTHORITY?: string
  KEYCLOAK_CLIENT_ID?: string
  API_BASE_URL?: string
}

interface JwtPayload {
  preferred_username?: string
  name?: string
  sub?: string
  realm_access?: {
    roles?: string[]
  }
  exp?: number
}

const VALID_ROLES_PRIORITY: UserRole[] = [
  'admin',
  'tabwater_staff',
  'finance_staff',
  'user',
]

export function getAuthConfig() {
  const cfg = (
    typeof window !== 'undefined'
      ? (window as Window & { __APP_CONFIG__?: RuntimeAppConfig }).__APP_CONFIG__
      : undefined
  ) ?? {}

  return {
    keycloakAuthority:
      cfg.KEYCLOAK_AUTHORITY || 'http://localhost:8081/realms/water-smart-bill',
    keycloakClientId: cfg.KEYCLOAK_CLIENT_ID || 'water-web',
    apiBaseUrl: cfg.API_BASE_URL || '/api',
  }
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
    const decoded = new TextDecoder().decode(bytes)
    return JSON.parse(decoded) as JwtPayload
  } catch {
    return null
  }
}

export function extractAppRoles(rawRoles: string[] = []): UserRole[] {
  const normalized = new Set<UserRole>()
  for (const role of rawRoles) {
    if (role === 'super_admin' || role === 'admin') {
      normalized.add('admin')
    } else if (role === 'tabwater_staff' || role === 'finance_staff' || role === 'user') {
      normalized.add(role)
    }
  }
  const ordered = VALID_ROLES_PRIORITY.filter((r) => normalized.has(r))
  return ordered.length > 0 ? ordered : ['user']
}

function loginWithDemoFallback(username: string, password: string): AuthSession {
  const matched = DEMO_ACCOUNTS.find(
    (acc) => acc.username.toLowerCase() === username.toLowerCase() && acc.password === password
  )
  if (!matched) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }
  const primaryRole = matched.roles[0]
  return {
    accessToken: `demo-jwt-role-${primaryRole}-${Date.now()}`,
    username: matched.username,
    displayName: matched.displayName,
    roles: [...matched.roles],
    authSource: 'demo',
  }
}

export const authApi = {
  async login(username: string, password: string): Promise<AuthSession> {
    const trimmedUser = username.trim()
    if (!trimmedUser || !password) {
      throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
    }

    const { keycloakAuthority, keycloakClientId } = getAuthConfig()
    const tokenEndpoint = `${keycloakAuthority.replace(/\/$/, '')}/protocol/openid-connect/token`

    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: keycloakClientId,
      username: trimmedUser,
      password,
      scope: 'openid profile email',
    })

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (response.ok) {
        const data = (await response.json()) as { access_token?: string }
        if (!data.access_token) {
          throw new Error('ไม่พบ access_token จาก Keycloak')
        }
        const payload = parseJwtPayload(data.access_token)
        const roles = extractAppRoles(payload?.realm_access?.roles ?? [])
        return {
          accessToken: data.access_token,
          username: payload?.preferred_username || trimmedUser,
          displayName: payload?.name || payload?.preferred_username || trimmedUser,
          roles,
          authSource: 'keycloak',
        }
      }

      // If Keycloak explicitly rejected credentials, do NOT fall back to demo bypass.
      if (response.status === 400 || response.status === 401) {
        throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      }

      // Keycloak gateway/service unavailable -> fall back to demo accounts
      return loginWithDemoFallback(trimmedUser, password)
    } catch (err) {
      if (err instanceof Error && err.message === 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') {
        throw err
      }
      // Network error (Keycloak unreachable / offline dev / unit test) -> demo fallback
      return loginWithDemoFallback(trimmedUser, password)
    }
  },

  logout: (token: string) => {
    const { apiBaseUrl } = getAuthConfig()
    const base = apiBaseUrl.replace(/\/$/, '')
    return apiRequest<LogoutResponse>(`${base}/v1/auth/logout`, {
      method: 'POST',
      token,
    })
  },
}
