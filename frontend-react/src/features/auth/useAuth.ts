import { useState } from 'react'

export type UserRole = 'admin' | 'tabwater_staff' | 'finance_staff' | 'user'

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

export function useAuth() {
  const [jwtToken, setJwtToken] = useState('demo-jwt-hsg-2569-active')
  const [currentRole, setCurrentRole] = useState<UserRole>('admin')
  const [blacklistedTokens, setBlacklistedTokens] = useState<string[]>([])
  const [showKeycloakModal, setShowKeycloakModal] = useState(false)

  function handleLogoutAndBlacklistJwt() {
    if (!blacklistedTokens.includes(jwtToken)) {
      setBlacklistedTokens([jwtToken, ...blacklistedTokens])
    }
    setShowKeycloakModal(true)
  }

  function handleSignInWithKeycloak() {
    setJwtToken(`demo-jwt-hsg-${Date.now()}`)
    setShowKeycloakModal(false)
  }

  return {
    jwtToken,
    currentRole,
    setCurrentRole,
    blacklistedTokens,
    showKeycloakModal,
    setShowKeycloakModal,
    handleLogout: handleLogoutAndBlacklistJwt,
    handleLogoutAndBlacklistJwt,
    handleSignInWithKeycloak,
  }
}
