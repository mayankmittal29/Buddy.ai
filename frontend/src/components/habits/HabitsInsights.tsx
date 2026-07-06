import { useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarPlus, Flame, Sparkles } from "lucide-react"
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { type Habit, listHabits } from "@/components/habits/api"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const COLORS = ["#4F46E5", "#8B5CF6", "#10B981", "#F59E0B", "#F43F5E", "#06B6D4", "#EC4899"]
const DAILY_TREND_DAYS = 14

interface HabitsInsightsProps {
  refreshToken?: number
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isSameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

export function HabitsInsights({ refreshToken }: HabitsInsightsProps) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listHabits()
      .then(setHabits)
      .finally(() => setLoading(false))
  }, [refreshToken])

  const stats = useMemo(() => {
    const now = new Date()
    const newThisMonth = habits.filter((h) => isSameMonth(h.created_at, now)).length
    const totalCompletions = habits.reduce((sum, h) => sum + h.times_done, 0)
    return { totalHabits: habits.length, newThisMonth, totalCompletions }
  }, [habits])

  const dailyTrend = useMemo(() => {
    const today = new Date()
    const days: { date: string; label: string; count: number }[] = []
    for (let i = DAILY_TREND_DAYS - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = toIsoDate(d)
      days.push({
        date: iso,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: 0,
      })
    }
    const byDate = new Map(days.map((d) => [d.date, d]))
    for (const habit of habits) {
      for (const log of habit.logs) {
        const entry = byDate.get(log.log_date)
        if (entry && log.done) entry.count += 1
      }
    }
    return days
  }, [habits])

  const streakData = useMemo(
    () => habits.map((h) => ({ name: h.title, value: h.current_streak })),
    [habits]
  )

  if (loading) {
    return (
      <div className={cn(cardBase, "h-40 animate-pulse")} />
    )
  }

  if (habits.length === 0) return null

  return (
    <div className={cn(cardBase, "flex flex-col gap-4")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-primary" />
        Insights
      </h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas px-3 py-2.5">
          <Flame className="size-4 shrink-0 text-primary" />
          <div>
            <p className="text-lg font-bold text-foreground">{stats.totalHabits}</p>
            <p className="text-[11px] text-muted-foreground">Habits tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas px-3 py-2.5">
          <CalendarPlus className="size-4 shrink-0 text-accent" />
          <div>
            <p className="text-lg font-bold text-foreground">{stats.newThisMonth}</p>
            <p className="text-[11px] text-muted-foreground">New this month</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-canvas px-3 py-2.5">
          <BarChart3 className="size-4 shrink-0 text-success" />
          <div>
            <p className="text-lg font-bold text-foreground">{stats.totalCompletions}</p>
            <p className="text-[11px] text-muted-foreground">Total completions</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Completions, last {DAILY_TREND_DAYS} days
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={20} />
                <Tooltip />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {dailyTrend.map((entry, i) => (
                    <Cell key={entry.date} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Current streak by habit</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={streakData} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  width={80}
                  tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
                />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {streakData.map((entry, i) => (
                    <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
