import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { Bell, House, Info, LogOut, Settings, User } from "lucide-react"
import { showSuccess } from "@/lib/toast"
import UserAvatar from "@/components/UserAvatar"
import { getUnreadNotificationCount } from "@/components/notifications/api"
import { SKILLS } from "@/config/skills"
import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"

/** Shared base for the 9 skill nav buttons — same color for every one,
 * regardless of that skill's own accent used elsewhere (e.g. Home page
 * cards). Active route gets a solid-fill variant of the same color family. */
const SKILL_BUTTON_BASE =
  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150"
const SKILL_BUTTON_INACTIVE = "bg-primary-50 text-primary hover:bg-primary-100"
const SKILL_BUTTON_ACTIVE = "bg-primary text-white"

export default function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    showSuccess("Logged out.", { duration: 5000 })
    navigate("/login", { replace: true })
  }

  useEffect(() => {
    let cancelled = false

    function refresh() {
      getUnreadNotificationCount()
        .then((count) => {
          if (!cancelled) setUnreadCount(count)
        })
        .catch(() => {})
    }

    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("mousedown", handleClick)
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("mousedown", handleClick)
      window.removeEventListener("keydown", handleKey)
    }
  }, [menuOpen])

  return (
    <header className="flex items-center gap-4 border-b border-border-subtle bg-gradient-to-r from-primary-50 via-white to-accent-50 px-6 py-3">
      <Link
        to="/"
        className="shrink-0 font-script text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
      >
        Buddy
      </Link>

      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-base font-semibold transition-colors duration-150",
            isActive
              ? "bg-primary text-white"
              : "bg-primary-50 text-primary hover:bg-primary-100"
          )
        }
      >
        <House className="size-4.5" />
        Home
      </NavLink>

      <nav className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {SKILLS.map((skill) => (
          <NavLink
            key={skill.id}
            to={`/skills/${skill.id}`}
            className={({ isActive }) =>
              cn(SKILL_BUTTON_BASE, isActive ? SKILL_BUTTON_ACTIVE : SKILL_BUTTON_INACTIVE)
            }
          >
            {skill.title}
          </NavLink>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-3">
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-primary"
          >
            <UserAvatar />
            {authUser?.name && (
              <span className="hidden max-w-32 truncate text-sm font-medium text-foreground sm:inline">
                {authUser.name}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border-subtle bg-surface py-1 shadow-card-hover">
              {authUser?.name && (
                <div className="border-b border-border-subtle px-3 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {authUser.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{authUser.username}</p>
                </div>
              )}
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
              >
                <User className="size-4" />
                Profile
              </Link>
              <Link
                to="/about"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
              >
                <Info className="size-4" />
                About
              </Link>
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
              >
                <Settings className="size-4" />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 border-t border-border-subtle px-3 py-2 text-left text-sm text-destructive transition-colors duration-150 hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
