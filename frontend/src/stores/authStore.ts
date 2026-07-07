import { create } from "zustand"

const API_URL = import.meta.env.VITE_API_URL

export type Gender = "male" | "female" | "other" | "prefer_not_to_say"

export interface AuthUser {
  id: number
  username: string
  name: string
  occupation: string
  current_ctc: number | null
  gender: Gender
  dob: string
}

export interface SignupPayload {
  username: string
  password: string
  name: string
  occupation: string
  current_ctc: number | null
  gender: Gender
  dob: string
}

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated"

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  initAuth: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => Promise<void>
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.detail ?? fallback
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" })
  if (!res.ok) return null
  return res.json()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "idle",

  async initAuth() {
    if (get().status === "loading") return
    set({ status: "loading" })

    let me = await fetchMe()
    if (!me) {
      const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (refreshed.ok) me = await refreshed.json()
    }
    set({ user: me, status: me ? "authenticated" : "unauthenticated" })
  },

  async login(username, password) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, "Incorrect username or password."))
    }
    const user: AuthUser = await res.json()
    set({ user, status: "authenticated" })
  },

  async signup(payload) {
    // Deliberately does NOT set user/status here — signup creates the
    // account only (no cookies are issued by the backend for this call),
    // so the caller (Signup.tsx) sends the user to /login afterward
    // rather than straight into the app.
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw new Error(await parseErrorDetail(res, "Could not create your account."))
    }
  },

  async logout() {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
    set({ user: null, status: "unauthenticated" })
  },
}))
