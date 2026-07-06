import type { LucideIcon } from "lucide-react"
import { Briefcase, Flame, GraduationCap, ListChecks, Target, Wallet } from "lucide-react"
import type {
  CareerStats,
  FinanceStats,
  GoalsStats,
  HabitsStats,
  LearningStats,
  ProductivityStats,
} from "@/components/analytics/api"
import { MiniDonut } from "@/components/analytics/MiniDonut"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

function DomainCard({
  icon: Icon,
  title,
  chart,
  stats,
}: {
  icon: LucideIcon
  title: string
  chart: React.ReactNode
  stats: { label: string; value: string }[]
}) {
  return (
    <div className={cn(cardBase, "flex flex-col gap-4")}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </h3>
      <div className="flex items-center gap-4">
        {chart}
        <div className="flex flex-1 flex-col gap-2.5">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProductivityCard({ data }: { data: ProductivityStats }) {
  return (
    <DomainCard
      icon={ListChecks}
      title="Productivity"
      chart={
        <MiniDonut
          data={[
            { name: "Done", value: data.done },
            { name: "Remaining", value: Math.max(0, data.total - data.done) },
          ]}
        />
      }
      stats={[
        { label: `Tasks, last ${data.days} days`, value: `${data.done}/${data.total}` },
        { label: "Completion rate", value: `${data.completion_rate}%` },
      ]}
    />
  )
}

export function GoalsCard({ data }: { data: GoalsStats }) {
  return (
    <DomainCard
      icon={Target}
      title="Goals"
      chart={
        <MiniDonut
          data={[
            { name: "Completed", value: data.completed },
            { name: "Remaining", value: Math.max(0, data.planned - data.completed) },
          ]}
        />
      }
      stats={[
        { label: `Planner items, last ${data.days} days`, value: `${data.completed}/${data.planned}` },
        { label: "Adherence rate", value: `${data.adherence_rate}%` },
      ]}
    />
  )
}

export function FinanceCard({ data }: { data: FinanceStats }) {
  const categories = Object.entries(data.by_category).map(([name, value]) => ({ name, value }))
  return (
    <DomainCard
      icon={Wallet}
      title="Finance"
      chart={<MiniDonut data={categories} />}
      stats={[
        { label: `Spent this month (${data.month})`, value: data.spend.toLocaleString() },
        {
          label: data.budget > 0 ? "Of budget" : "Budget",
          value: data.pct_used != null ? `${data.pct_used}%` : "Not set",
        },
      ]}
    />
  )
}

export function LearningCard({ data }: { data: LearningStats }) {
  return (
    <DomainCard
      icon={GraduationCap}
      title="Learning"
      chart={
        <MiniDonut
          data={[
            { name: "Done", value: data.done },
            { name: "In progress", value: data.in_progress },
            { name: "Planned", value: data.planned },
          ]}
        />
      }
      stats={[
        { label: "Courses done", value: `${data.done}/${data.total}` },
        { label: "Completion rate", value: `${data.completion_rate}%` },
      ]}
    />
  )
}

export function HabitsCard({ data }: { data: HabitsStats }) {
  return (
    <DomainCard
      icon={Flame}
      title="Habits"
      chart={
        <MiniDonut
          data={[
            { name: "Done today", value: data.done_today },
            { name: "Not yet", value: Math.max(0, data.total_habits - data.done_today) },
          ]}
        />
      }
      stats={[
        { label: "Habits tracked", value: `${data.total_habits}` },
        {
          label: "Avg / best streak",
          value: `${data.avg_current_streak}d / ${data.longest_current_streak}d`,
        },
      ]}
    />
  )
}

const STATUS_LABELS: Record<keyof CareerStats["by_status"], string> = {
  just_found: "Just found",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export function CareerCard({ data }: { data: CareerStats }) {
  const chartData = (Object.keys(data.by_status) as (keyof CareerStats["by_status"])[])
    .map((status) => ({ name: STATUS_LABELS[status], value: data.by_status[status] }))
    .filter((d) => d.value > 0)

  return (
    <DomainCard
      icon={Briefcase}
      title="Career"
      chart={<MiniDonut data={chartData} />}
      stats={[
        { label: "Applications tracked", value: `${data.total}` },
        { label: "Offer rate", value: `${data.offer_rate}%` },
      ]}
    />
  )
}
