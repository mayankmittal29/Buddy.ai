import { useEffect } from "react"
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"

/** Wraps the public auth pages (Login/Signup/...) — if a session is already
 * valid, bounces straight to the app instead of showing the form again. */
export default function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const initAuth = useAuthStore((s) => s.initAuth)

  useEffect(() => {
    if (status === "idle") initAuth()
  }, [status, initAuth])

  if (status === "authenticated") {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
