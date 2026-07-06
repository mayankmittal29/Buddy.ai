import { useCallback, useEffect, useMemo, useState } from "react"
import { Flame, Plus, Repeat, Search, Trash2, Trophy, X } from "lucide-react"
import {
  type Habit,
  listHabits,
  createHabit,
  toggleHabitToday,
  deleteHabit,
} from "@/components/habits/api"
import { HeatmapView } from "@/components/habits/HeatmapView"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fuzzyMatch, fuzzyScore } from "@/lib/fuzzy"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface HabitsListProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have added/logged a habit via tools. */
  refreshToken?: number
  /** Fired whenever a habit is added/toggled/deleted here. */
  onChange?: () => void
}

type DoneFilter = "all" | "done" | "not_done"

const DONE_FILTERS: { value: DoneFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "done", label: "Done today" },
  { value: "not_done", label: "Not done today" },
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isDoneToday(habit: Habit): boolean {
  const today = todayIso()
  return habit.logs.some((l) => l.log_date === today && l.done)
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

function HabitRow({
  habit,
  onToggle,
  onDelete,
}: {
  habit: Habit
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}) {
  const doneToday = isDoneToday(habit)

  return (
    <li className={cn(cardBase, "flex flex-col gap-3 p-4 shadow-none")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{habit.title}</p>
          {habit.description && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{habit.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(habit.id)}
          aria-label="Delete habit"
          className="shrink-0 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1">
          <Flame className="size-4 text-primary" />
          <span className="text-sm font-semibold text-primary">{habit.current_streak}</span>
          <span className="text-xs text-muted-foreground">
            day{habit.current_streak === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Trophy className="size-3.5" />
          Best: {habit.longest_streak}
        </div>
      </div>

      <div className="overflow-x-auto">
        <HeatmapView logs={habit.logs} />
      </div>

      <Button
        size="sm"
        onClick={() => onToggle(habit.id)}
        className={cn(
          "w-full",
          doneToday
            ? "bg-success/10 text-success hover:bg-success/20"
            : "bg-gradient-to-r from-primary to-accent"
        )}
      >
        {doneToday ? "Done today ✓" : "Mark done today"}
      </Button>
    </li>
  )
}

export function HabitsList({ refreshToken, onChange }: HabitsListProps) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [doneFilter, setDoneFilter] = useState<DoneFilter>("all")
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    const result = await listHabits()
    setHabits(result)
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (refreshToken === undefined) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const visible = useMemo(() => {
    let result = habits
    if (doneFilter !== "all") {
      result = result.filter((h) => isDoneToday(h) === (doneFilter === "done"))
    }
    const query = search.trim()
    if (query) {
      return result
        .filter((h) => fuzzyMatch(query, h.title))
        .sort((a, b) => fuzzyScore(query, b.title) - fuzzyScore(query, a.title))
    }
    return result
  }, [habits, doneFilter, search])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await createHabit({ title: title.trim(), description: description.trim() || null })
      setTitle("")
      setDescription("")
      setAdding(false)
      await refresh()
      onChange?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: number) {
    await toggleHabitToday(id)
    await refresh()
    onChange?.()
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this habit? This removes all its logged history.")) return
    await deleteHabit(id)
    await refresh()
    onChange?.()
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Repeat className="size-4 text-primary" />
          Habits
        </h2>
        <Button
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add Habit
        </Button>
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-xl border border-border-subtle bg-canvas p-3"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Habit title (e.g. "Morning run")'
            autoFocus
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim()}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search habits…"
          className="h-9 w-full rounded-full border border-border-subtle bg-canvas pr-8 pl-9 text-sm outline-none transition-colors duration-150 focus:border-primary/40"
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

      <div className="flex flex-wrap gap-1.5">
        {DONE_FILTERS.map(({ value, label }) => (
          <FilterPill key={value} active={doneFilter === value} onClick={() => setDoneFilter(value)}>
            {label}
          </FilterPill>
        ))}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Add one above, or tell Buddy in chat."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching habits"
          description="Try a different search or filter."
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
