import { useEffect, useState } from "react"
import { PieChartIcon } from "lucide-react"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { getExpenseSummary } from "@/components/finance/api"
import { EmptyState } from "@/components/ui/empty-state"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface CategoryBreakdownChartProps {
  refreshToken?: number
}

const COLORS = ["#4F46E5", "#8B5CF6", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4", "#EC4899"]

export function CategoryBreakdownChart({ refreshToken }: CategoryBreakdownChartProps) {
  const [data, setData] = useState<{ name: string; value: number }[]>([])
  const [month, setMonth] = useState("")

  useEffect(() => {
    getExpenseSummary().then((summary) => {
      setMonth(summary.month)
      setData(
        Object.entries(summary.by_category).map(([name, value]) => ({ name, value }))
      )
    })
  }, [refreshToken])

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PieChartIcon className="size-4 text-primary" />
          Spending by Category
        </h2>
        {month && <span className="text-xs text-muted-foreground">{month}</span>}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={PieChartIcon}
          title="No spending yet"
          description="Log an expense to see the breakdown."
        />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => Number(value).toLocaleString()} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
