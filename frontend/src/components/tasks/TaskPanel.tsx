import { useCallback, useEffect, useMemo, useState } from "react"
import { KanbanSquare, ListTodo, Plus, Search, TrendingUp, X } from "lucide-react"
import {
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdateInput,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "@/components/tasks/api"
import { TaskRow } from "@/components/tasks/TaskRow"
import { AddTaskSheet } from "@/components/tasks/AddTaskSheet"
import { TaskDetailModal } from "@/components/tasks/TaskDetailModal"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { fuzzyMatch, fuzzyScore } from "@/lib/fuzzy"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const STATUS_GROUPS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "done", label: "Done" },
]

const STATUS_FILTERS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "done", label: "Done" },
]

const PRIORITY_FILTERS: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "normal", label: "Normal" },
  { value: "light", label: "Light" },
]

const PRIORITY_FILTER_COLORS: Record<TaskPriority, { active: string; inactive: string }> = {
  urgent: {
    active: "bg-rose-500 text-white",
    inactive: "border border-rose-200 text-rose-600 hover:bg-rose-50",
  },
  normal: {
    active: "bg-amber-500 text-white",
    inactive: "border border-amber-200 text-amber-600 hover:bg-amber-50",
  },
  light: {
    active: "bg-emerald-500 text-white",
    inactive: "border border-emerald-200 text-emerald-600 hover:bg-emerald-50",
  },
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, normal: 1, light: 2 }

/** Urgent > normal > light; within the same priority, nearest due date
 * first — tasks with no due date sort to the end of their priority group. */
function compareTasks(a: Task, b: Task): number {
  const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  if (priorityDiff !== 0) return priorityDiff
  if (a.due_at && b.due_at) {
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  }
  if (a.due_at) return -1
  if (b.due_at) return 1
  return 0
}

function FilterPill({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  className?: string
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
          : "border border-border-subtle text-slate-500 hover:border-primary/40",
        className
      )}
    >
      {children}
    </button>
  )
}

interface TaskPanelProps {
  /** Bump this (e.g. increment a counter) whenever a chat turn just
   * finished — it may have created/updated/deleted tasks via tools, so the
   * list is quietly refetched without flashing the loading skeleton. */
  refreshToken?: number
}

export function TaskPanel({ refreshToken }: TaskPanelProps = {}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("pending")
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const result = await listTasks({ status: statusFilter, priority: priorityFilter })
        setTasks(result)
        setError(null)
      } catch (err) {
        if (!opts?.silent) {
          setError(err instanceof Error ? err.message : "Failed to load tasks.")
        }
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [statusFilter, priorityFilter]
  )

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  useEffect(() => {
    if (refreshToken === undefined) return
    refresh({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  const visibleTasks = useMemo(() => {
    const query = search.trim()
    if (!query) return tasks
    return tasks
      .filter((t) => fuzzyMatch(query, t.title))
      .sort((a, b) => fuzzyScore(query, b.title) - fuzzyScore(query, a.title))
  }, [tasks, search])

  async function handleCreate(input: Parameters<typeof createTask>[0]) {
    await createTask(input)
    await refresh()
  }

  async function handleComplete(id: number) {
    await updateTask(id, { status: "done" })
    await refresh()
  }

  async function handleUpdate(id: number, input: TaskUpdateInput) {
    await updateTask(id, input)
    await refresh()
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this task?")) return
    await deleteTask(id)
    if (detailTask?.id === id) setDetailTask(null)
    await refresh()
  }

  const pendingCount = tasks.filter((t) => t.status === "pending").length
  const dueTodayCount = tasks.filter(
    (t) => t.status === "pending" && t.due_at && isToday(t.due_at)
  ).length
  const showSummary = !loading && !search && tasks.length > 0 && tasks.length <= 5

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <KanbanSquare className="size-4 text-primary" />
        Tasks
      </h2>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
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

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={statusFilter === value}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </FilterPill>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRIORITY_FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={priorityFilter === value}
            onClick={() => setPriorityFilter(value)}
            className={
              value === "all"
                ? undefined
                : priorityFilter === value
                  ? PRIORITY_FILTER_COLORS[value].active
                  : PRIORITY_FILTER_COLORS[value].inactive
            }
          >
            {label}
          </FilterPill>
        ))}
      </div>

      <Button
        className="w-full bg-gradient-to-r from-primary to-accent shadow-card hover:opacity-90"
        onClick={() => setSheetOpen(true)}
      >
        <Plus /> New Task
      </Button>
      <AddTaskSheet open={sheetOpen} onOpenChange={setSheetOpen} onCreate={handleCreate} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && tasks.length === 0 && (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}
      {!loading && tasks.length === 0 && !error && (
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Whatever's on your plate, add it here or just tell Buddy in chat."
          action={{ label: "Add your first task", onClick: () => setSheetOpen(true) }}
        />
      )}
      {!loading && tasks.length > 0 && visibleTasks.length === 0 && (
        <EmptyState
          icon={Search}
          title="No matching tasks"
          description={`Nothing matches "${search}".`}
        />
      )}

      {showSummary && (
        <div className={cn(cardBase, "flex items-center justify-between py-3")}>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{pendingCount}</span> pending
            {dueTodayCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{dueTodayCount}</span> due
                today
              </>
            )}
          </p>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <TrendingUp className="size-4 text-primary" />
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto">
        {search
          ? visibleTasks.length > 0 && (
              <ul className="space-y-1.5">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onOpenDetail={setDetailTask}
                  />
                ))}
              </ul>
            )
          : STATUS_GROUPS.map(({ status, label }) => {
              const group = visibleTasks
                .filter((t) => t.status === status)
                .sort(compareTasks)
              if (group.length === 0) return null
              return (
                <div key={status}>
                  <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label} ({group.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {group.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onComplete={handleComplete}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onOpenDetail={setDetailTask}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
      </div>

      <TaskDetailModal task={detailTask} onClose={() => setDetailTask(null)} />
    </div>
  )
}
