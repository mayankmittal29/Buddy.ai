import { useState } from "react"
import { RefreshCw, Sparkles } from "lucide-react"
import { type DateRange, generateWeeklyReport } from "@/components/analytics/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

export function WeeklyReportCard({ range }: { range: DateRange }) {
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await generateWeeklyReport(range)
      setReport(result.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the report.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3 bg-gradient-to-br from-primary-50 to-accent-50")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          Weekly Report
        </h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-primary shadow-card transition-colors duration-150 hover:bg-primary-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          {report ? "Regenerate" : "Generate"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : report ? (
        <p className="text-sm text-foreground">{report}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tap "Generate" for a short natural-language summary of what went well, what slipped, and
          one suggestion — grounded in your real data below.
        </p>
      )}
    </div>
  )
}
