import { useMemo } from "react"
import type { HabitLog } from "@/components/habits/api"
import { cn } from "@/lib/utils"

interface HeatmapViewProps {
  logs: HabitLog[]
  days?: number
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Mini GitHub-style contribution graph — each column is one calendar
 * week (Sun-Sat top-to-bottom), most recent week on the right, covering
 * the last `days` days. */
export function HeatmapView({ logs, days = 90 }: HeatmapViewProps) {
  const cells = useMemo(() => {
    const doneDates = new Set(logs.filter((l) => l.done).map((l) => l.log_date))
    const today = new Date()
    const dates: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      dates.push(toIsoDate(d))
    }
    const firstWeekday = new Date(dates[0]).getDay()
    const padding: (string | null)[] = Array(firstWeekday).fill(null)
    return [...padding, ...dates].map((date) => ({
      date,
      done: date ? doneDates.has(date) : false,
    }))
  }, [logs, days])

  return (
    <div
      className="grid grid-flow-col grid-rows-7 gap-0.5"
      role="img"
      aria-label={`Activity over the last ${days} days`}
    >
      {cells.map((cell, i) => (
        <div
          key={cell.date ?? `pad-${i}`}
          title={cell.date ? `${cell.date}${cell.done ? " — done" : ""}` : undefined}
          className={cn(
            "size-2.5 rounded-[2px]",
            !cell.date && "invisible",
            cell.date && (cell.done ? "bg-primary" : "bg-border-subtle")
          )}
        />
      ))}
    </div>
  )
}
