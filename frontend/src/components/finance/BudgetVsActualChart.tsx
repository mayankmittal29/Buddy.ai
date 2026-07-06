import { useEffect, useState } from "react"
import { BarChart3 } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { getExpenseSummary, listBudgets } from "@/components/finance/api"
import { EmptyState } from "@/components/ui/empty-state"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface BudgetVsActualChartProps {
  refreshToken?: number
}

interface Row {
  category: string
  budget: number
  actual: number
}

export function BudgetVsActualChart({ refreshToken }: BudgetVsActualChartProps) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    Promise.all([listBudgets(), getExpenseSummary()]).then(([budgets, summary]) => {
      const categories = new Set([
        ...budgets.map((b) => b.category),
        ...Object.keys(summary.by_category),
      ])
      setRows(
        [...categories].map((category) => ({
          category,
          budget: budgets.find((b) => b.category === category)?.monthly_limit ?? 0,
          actual: summary.by_category[category] ?? 0,
        }))
      )
    })
  }, [refreshToken])

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BarChart3 className="size-4 text-primary" />
        Budget vs Actual
      </h2>

      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No budgets or spending yet"
          description="Set a budget or log an expense to compare."
        />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => Number(value).toLocaleString()} />
              <Bar dataKey="budget" name="Budget" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
