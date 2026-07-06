import { useEffect, useState } from "react"
import { type AnalyticsOverview, type DateRange, getAnalyticsOverview } from "@/components/analytics/api"
import {
  CareerCard,
  FinanceCard,
  GoalsCard,
  HabitsCard,
  LearningCard,
  ProductivityCard,
} from "@/components/analytics/DomainCards"
import { WeeklyReportCard } from "@/components/analytics/WeeklyReportCard"
import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget"
import { CardSkeleton } from "@/components/ui/skeleton"
import { pageShell, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const SKILL_ID = "analytics"

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
]

export default function AnalyticsSkill() {
  const [range, setRange] = useState<DateRange>("week")
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    setLoading(true)
    getAnalyticsOverview(range)
      .then(setOverview)
      .finally(() => setLoading(false))
  }, [range, refreshToken])

  return (
    <div className={pageShell}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Cross-module trends across everything Buddy helps you manage.
        </p>
        <div className="mt-4 flex gap-1.5">
          {RANGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={cn(
                pillBase,
                range === value
                  ? "bg-primary text-white"
                  : "border border-border-subtle text-slate-500 hover:border-primary/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <WeeklyReportCard range={range} />

        {loading || !overview ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <ProductivityCard data={overview.productivity} />
            <GoalsCard data={overview.goals} />
            <FinanceCard data={overview.finance} />
            <LearningCard data={overview.learning} />
            <HabitsCard data={overview.habits} />
            <CareerCard data={overview.career} />
          </div>
        )}
      </div>

      <FloatingChatWidget skillId={SKILL_ID} onTurnComplete={() => setRefreshToken((t) => t + 1)} />
    </div>
  )
}
