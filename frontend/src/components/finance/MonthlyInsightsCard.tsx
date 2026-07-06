import { useEffect, useState } from "react"
import { AlertTriangle, Sparkles } from "lucide-react"
import { type MonthlyInsights, getMonthlyInsights } from "@/components/finance/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface MonthlyInsightsCardProps {
  refreshToken?: number
}

export function MonthlyInsightsCard({ refreshToken }: MonthlyInsightsCardProps) {
  const [insights, setInsights] = useState<MonthlyInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getMonthlyInsights()
      .then(setInsights)
      .finally(() => setLoading(false))
  }, [refreshToken])

  return (
    <div className={cn(cardBase, "flex flex-col gap-3 bg-gradient-to-br from-primary-50 to-accent-50")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-primary" />
        Monthly Insights
      </h2>

      {loading || !insights ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground">{insights.insight}</p>

          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(pillBase, "bg-surface text-foreground")}>
              Total: {insights.total_spend.toLocaleString()}
            </span>
            {insights.top_categories.map((c) => (
              <span key={c.category} className={cn(pillBase, "border border-border-subtle text-slate-600")}>
                {c.category}: {c.amount.toLocaleString()}
              </span>
            ))}
          </div>

          {insights.budget_overruns.length > 0 && (
            <div className="space-y-1">
              {insights.budget_overruns.map((o) => (
                <div
                  key={o.category}
                  className="flex items-center gap-1.5 text-xs font-medium text-danger"
                >
                  <AlertTriangle className="size-3.5" />
                  {o.category} is over budget by {o.over_by.toLocaleString()}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
