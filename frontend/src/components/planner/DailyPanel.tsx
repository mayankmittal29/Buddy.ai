import { useCallback, useEffect, useState } from "react"
import { CalendarClock, ListTodo, Sunrise, Sunset } from "lucide-react"
import { showSuccess, showError } from "@/lib/toast"
import {
  type DailySchedule,
  type PlannerItem,
  getDailySchedule,
  listPlannerItems,
  updatePlannerItem,
} from "@/components/planner/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { MorningBriefingModal } from "@/components/planner/MorningBriefingModal"
import { EveningReviewModal } from "@/components/planner/EveningReviewModal"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface DailyPanelProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have added/completed a daily goal. */
  refreshToken?: number
}

export function DailyPanel({ refreshToken }: DailyPanelProps) {
  const [goals, setGoals] = useState<PlannerItem[]>([])
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const refresh = useCallback(async () => {
    const [items, sched] = await Promise.all([listPlannerItems("daily"), getDailySchedule()])
    setGoals(items)
    setSchedule(sched)
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

  async function handleComplete(id: number) {
    try {
      await updatePlannerItem(id, { status: "done" })
      await refresh()
      showSuccess("Planner item marked done.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't complete the planner item.", {
        duration: 5000,
      })
      throw err
    }
  }

  const pendingGoals = goals.filter((g) => g.status === "pending")

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarClock className="size-4 text-primary" />
        Today
      </h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setBriefingOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors duration-150 hover:border-primary/40"
        >
          <Sunrise className="size-3.5 text-amber-500" />
          Morning Briefing
        </button>
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-foreground transition-colors duration-150 hover:border-primary/40"
        >
          <Sunset className="size-3.5 text-violet-500" />
          Evening Review
        </button>
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Today's Goals ({pendingGoals.length})
        </h3>
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : pendingGoals.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No goals for today"
            description="Tell Buddy what you want to get done today in chat."
          />
        ) : (
          <ul className="space-y-1.5">
            {pendingGoals.map((goal) => (
              <li key={goal.id} className={cn(cardBase, "flex items-center gap-3 p-3")}>
                <button
                  type="button"
                  onClick={() => handleComplete(goal.id)}
                  aria-label="Mark as complete"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-subtle transition-colors duration-150 hover:border-success"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{goal.title}</p>
                  {goal.hours_needed != null && (
                    <p className="text-xs text-slate-500">{goal.hours_needed}h needed</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Suggested Schedule
        </h3>
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : schedule && schedule.schedule.length > 0 ? (
          <ul className="space-y-1">
            {schedule.schedule.map((block, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-1.5 text-xs",
                  block.activity === "Free time"
                    ? "bg-canvas text-slate-500"
                    : "bg-primary-50 font-medium text-primary"
                )}
              >
                <span>
                  {block.start} – {block.end}
                </span>
                <span className="truncate pl-2 text-right">{block.activity}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Set your wake/sleep time and meal times in Profile to see a schedule.
          </p>
        )}
        {schedule && schedule.unscheduled.length > 0 && (
          <p className="mt-2 text-xs text-amber-600">
            Couldn't fit today: {schedule.unscheduled.join(", ")}
          </p>
        )}
      </div>

      <MorningBriefingModal open={briefingOpen} onClose={() => setBriefingOpen(false)} />
      <EveningReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </div>
  )
}
