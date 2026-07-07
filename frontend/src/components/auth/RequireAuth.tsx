import { useEffect } from "react"
import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"

/** Gates every "real app" route behind a valid session — tries /api/auth/me,
 * falls back to one /api/auth/refresh attempt (covers the common case of a
 * page reload after the short-lived access token has expired but the
 * refresh token is still valid), and redirects to /login if both fail. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const initAuth = useAuthStore((s) => s.initAuth)
  const location = useLocation()

  useEffect(() => {
    if (status === "idle") initAuth()
  }, [status, initAuth])

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-svh items-center justify-center bg-canvas">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
