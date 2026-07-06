import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

export const CHART_COLORS = ["#4F46E5", "#8B5CF6", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4", "#EC4899"]

interface MiniDonutProps {
  data: { name: string; value: number }[]
  size?: number
}

/** A small, multi-coloured donut chart — used across every Analytics
 * domain card so each one reads at a glance without needing a legend. */
export function MiniDonut({ data, size = 96 }: MiniDonutProps) {
  const hasData = data.some((d) => d.value > 0)

  if (!hasData) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-subtle text-center text-[10px] text-muted-foreground"
      >
        No data
      </div>
    )
  }

  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={size / 2 - 16}
            outerRadius={size / 2}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
