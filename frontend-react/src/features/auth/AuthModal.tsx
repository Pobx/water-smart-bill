
export interface AuthModalProps {
  jwtToken: string
  showKeycloakModal: boolean
  onSignIn: () => void
}

export function AuthModal({ jwtToken, showKeycloakModal, onSignIn }: AuthModalProps) {
  if (!showKeycloakModal) return null

  return (
    <div
      role="dialog"
      aria-label="Keycloak Custom Login"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
          ออกจากระบบแล้ว ({jwtToken})
        </span>
        <h3 className="mt-3 text-lg font-bold text-slate-900">
          Keycloak OIDC Login (Customized with Tailwind CSS)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          เซสชันเดิมถูกยกเลิกเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่เพื่อใช้งาน
        </p>
        <div className="mt-4 space-y-3">
          <input
            defaultValue="somchai_staff"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            defaultValue="••••••••"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onSignIn}
            className="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-bold text-white hover:bg-sky-700"
          >
            Sign In with Keycloak OIDC
          </button>
        </div>
      </div>
    </div>
  )
}
