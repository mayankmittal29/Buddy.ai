import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Circle, Download, ListTodo } from "lucide-react"
import {
  type PlannerItem,
  type PlannerMode,
  exportUrl,
  listPlannerItems,
  updatePlannerItem,
} from "@/components/planner/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface PlanTableProps {
  mode: Exclude<PlannerMode, "daily">
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have added items to the plan. */
  refreshToken?: number
}

export function PlanTable({ mode, refreshToken }: PlanTableProps) {
  const [items, setItems] = useState<PlannerItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const result = await listPlannerItems(mode)
    setItems(result)
  }, [mode])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (refreshToken === undefined) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  async function handleToggle(item: PlannerItem) {
    await updatePlannerItem(item.id, { status: item.status === "done" ? "pending" : "done" })
    await refresh()
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListTodo className="size-4 text-primary" />
          {mode === "weekly" ? "Weekly Plan" : "Monthly Plan"}
        </h2>
        <a
          href={exportUrl(mode)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-white shadow-card transition-opacity duration-200 hover:opacity-90"
        >
          <Download className="size-3.5" />
          Export as PDF
        </a>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No plan yet"
          description="Describe what you need to do and your hours/day in chat, and Buddy will lay out a plan here."
        />
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className={cn(cardBase, "flex items-center gap-3 p-3")}>
              <button
                type="button"
                onClick={() => handleToggle(item)}
                aria-label={item.status === "done" ? "Mark as pending" : "Mark as done"}
                className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-success"
              >
                {item.status === "done" ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : (
                  <Circle className="size-5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm text-foreground",
                    item.status === "done" && "text-muted-foreground line-through"
                  )}
                >
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">
                  {item.hours_needed != null ? `${item.hours_needed}h` : "—"}
                  {item.deadline
                    ? ` · Due ${new Date(item.deadline).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
