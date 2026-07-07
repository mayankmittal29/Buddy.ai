import { useCallback, useEffect, useState } from "react"
import { Check, ExternalLink, Newspaper, RefreshCw, Star } from "lucide-react"
import { showSuccess, showError } from "@/lib/toast"
import {
  type NewsCategory,
  type NewsItem,
  generateDigest,
  listNews,
  updateNewsItem,
} from "@/components/news/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface NewsListPanelProps {
  refreshToken?: number
}

const CATEGORY_FILTERS: { value: NewsCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai", label: "AI" },
  { value: "tech", label: "Tech" },
  { value: "github", label: "GitHub" },
  { value: "research", label: "Research" },
  { value: "startup", label: "Startups" },
  { value: "jobs", label: "Jobs" },
]

const DAY_FILTERS: { value: number | "all"; label: string }[] = [
  { value: "all", label: "All time" },
  { value: 1, label: "Today" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
]

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

function NewsItemRow({
  item,
  onToggleRead,
  onToggleStar,
}: {
  item: NewsItem
  onToggleRead: (item: NewsItem) => void
  onToggleStar: (item: NewsItem) => void
}) {
  return (
    <li
      className={cn(
        cardBase,
        "flex flex-col gap-2 p-3 shadow-none",
        !item.read && "border-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-start gap-1 text-sm font-medium text-foreground hover:text-primary hover:underline"
        >
          <span className="line-clamp-2">{item.title}</span>
          <ExternalLink className="mt-0.5 size-3 shrink-0 text-slate-400" />
        </a>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleRead(item)}
            aria-label={item.read ? "Mark unread" : "Mark read"}
            className={cn(
              "rounded-full p-1 transition-colors duration-150",
              item.read ? "text-success" : "text-slate-300 hover:text-success"
            )}
          >
            <Check className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleStar(item)}
            aria-label={item.starred ? "Unstar" : "Star"}
            className={cn(
              "rounded-full p-1 transition-colors duration-150",
              item.starred ? "text-amber-500" : "text-slate-300 hover:text-amber-500"
            )}
          >
            <Star className="size-3.5" fill={item.starred ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className={cn(pillBase, "bg-primary-50 px-2 py-0.5 text-primary")}>
          {item.source}
        </span>
        <span>{timeAgo(item.published_at)}</span>
      </div>
    </li>
  )
}

export function NewsListPanel({ refreshToken }: NewsListPanelProps) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<NewsCategory | "all">("all")
  const [dayFilter, setDayFilter] = useState<number | "all">("all")
  const [customDays, setCustomDays] = useState("")
  const [starredOnly, setStarredOnly] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const effectiveDays = customDays.trim() && Number(customDays) > 0 ? Number(customDays) : dayFilter

  const refresh = useCallback(async () => {
    const result = await listNews({
      category: categoryFilter === "all" ? null : categoryFilter,
      starred: starredOnly || null,
      days: effectiveDays === "all" ? null : effectiveDays,
    })
    setItems(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, starredOnly, effectiveDays])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh, refreshToken])

  async function handleToggleRead(item: NewsItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: !item.read } : i)))
    await updateNewsItem(item.id, { read: !item.read })
  }

  async function handleToggleStar(item: NewsItem) {
    const nextStarred = !item.starred
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, starred: nextStarred } : i)))
    try {
      const result = await updateNewsItem(item.id, { starred: nextStarred })
      if (result === null) {
        // Unstarred while already past the 3-day retention window — the
        // backend deleted it outright instead of just updating it.
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      }
      showSuccess(nextStarred ? "Starred." : "Unstarred.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't update the item.", { duration: 5000 })
      throw err
    }
  }

  async function handleRefreshNow() {
    setRefreshing(true)
    try {
      const result = await generateDigest()
      await refresh()
      showSuccess(`Digest refreshed — ${result.added} new item(s).`, { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't refresh the digest.", { duration: 5000 })
      throw err
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Newspaper className="size-4 text-primary" />
          News
        </h2>
        <button
          type="button"
          onClick={handleRefreshNow}
          disabled={refreshing}
          aria-label="Fetch latest news"
          className="rounded-full p-1.5 text-slate-400 transition-colors duration-150 hover:bg-primary-50 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORY_FILTERS.map(({ value, label }) => (
          <FilterPill key={value} active={categoryFilter === value} onClick={() => setCategoryFilter(value)}>
            {label}
          </FilterPill>
        ))}
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
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={1}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder="N"
            className="h-6 w-14 px-2 text-xs"
          />
          <span className="text-[11px] text-muted-foreground">days</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStarredOnly((v) => !v)}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
          starredOnly
            ? "bg-amber-500 text-white"
            : "border border-border-subtle text-slate-500 hover:border-amber-400"
        )}
      >
        <Star className="size-3.5" fill={starredOnly ? "currentColor" : "none"} />
        Starred only
      </button>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="No news yet"
            description="Tap the refresh icon above to fetch today's digest."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <NewsItemRow
                key={item.id}
                item={item}
                onToggleRead={handleToggleRead}
                onToggleStar={handleToggleStar}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
