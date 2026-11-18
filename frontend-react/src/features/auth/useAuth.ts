import { useState } from 'react'

export function useAuth() {
  const [jwtToken, setJwtToken] = useState('demo-jwt-hsg-2569-active')
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
    blacklistedTokens,
    showKeycloakModal,
    setShowKeycloakModal,
    handleLogoutAndBlacklistJwt,
    handleSignInWithKeycloak,
  }
}
