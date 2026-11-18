import { apiRequest } from '@/shared/api/httpClient'

export interface LogoutResponse {
  status: string
  revoked_jti: string
}

export const authApi = {
  logout: (token: string) =>
    apiRequest<LogoutResponse>('/api/v1/auth/logout', {
      method: 'POST',
      token,
    }),
}
