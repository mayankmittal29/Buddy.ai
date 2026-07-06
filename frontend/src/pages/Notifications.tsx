import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, Search, X } from "lucide-react"
import {
  type Notification,
  listNotifications,
  markNotificationRead,
} from "@/components/notifications/api"
import { NotificationDetailModal } from "@/components/notifications/NotificationDetailModal"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { fuzzyMatch, fuzzyScore } from "@/lib/fuzzy"
import { cardBase, pageShell, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const DAY_FILTERS: { value: number | "all"; label: string }[] = [
  { value: "all", label: "All time" },
  { value: 1, label: "Today" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
]

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        pillBase,
        active
          ? "bg-primary text-white"
          : "border border-border-subtle text-slate-500 hover:border-primary/40"
      )}
    >
      {children}
    </button>
  )
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [dayFilter, setDayFilter] = useState<number | "all">("all")
  const [customDays, setCustomDays] = useState("")
  const [search, setSearch] = useState("")
  const [detail, setDetail] = useState<Notification | null>(null)

  const effectiveDays =
    customDays.trim() && Number(customDays) > 0 ? Number(customDays) : dayFilter

  const refresh = useCallback(async () => {
    const result = await listNotifications(
      effectiveDays === "all" ? undefined : effectiveDays
    )
    setNotifications(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDays])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const visible = useMemo(() => {
    const query = search.trim()
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    if (!query) return sorted
    return sorted
      .filter((n) => fuzzyMatch(query, n.title) || fuzzyMatch(query, n.body))
      .sort(
        (a, b) =>
          fuzzyScore(query, b.title + " " + b.body) -
          fuzzyScore(query, a.title + " " + a.body)
      )
  }, [notifications, search])

  async function handleOpen(notification: Notification) {
    setDetail(notification)
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }
  }

  return (
    <div className={cn(pageShell, "mx-auto flex h-full max-w-3xl flex-col")}>
      <div className="mb-6 shrink-0">
        <h1 className="flex items-center gap-2 font-script text-4xl font-bold text-primary">
          <Bell className="size-8" />
          Notifications
        </h1>
        <p className="mt-2 text-muted-foreground">
          Everything Buddy has let you know about, in one place.
        </p>
      </div>

      <div className="shrink-0 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications…"
            className="h-9 w-full rounded-full border border-border-subtle bg-surface pr-8 pl-9 text-sm outline-none transition-colors duration-150 focus:border-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DAY_FILTERS.map(({ value, label }) => (
            <FilterPill
              key={value}
              active={!customDays.trim() && dayFilter === value}
              onClick={() => {
                setDayFilter(value)
                setCustomDays("")
              }}
            >
              {label}
            </FilterPill>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">or last</span>
            <Input
              type="number"
              min={1}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="N"
              className="h-7 w-16 px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Buddy will let you know here when something needs your attention."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching notifications"
            description={`Nothing matches "${search}".`}
          />
        ) : (
          <ul className="space-y-1.5">
            {visible.map((notification) => (
              <li
                key={notification.id}
                onClick={() => handleOpen(notification)}
                className={cn(
                  cardBase,
                  "flex cursor-pointer items-start gap-3 p-3 shadow-none transition-colors duration-150 hover:border-primary/40",
                  !notification.read && "border-primary/30 bg-primary-50/40"
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    notification.read ? "bg-transparent" : "bg-primary"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm text-foreground",
                      !notification.read && "font-medium"
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {notification.body}
                  </p>
                </div>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                  {timeAgo(notification.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NotificationDetailModal notification={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
