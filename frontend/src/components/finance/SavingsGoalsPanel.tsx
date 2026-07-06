import { useEffect, useState } from "react"
import { PiggyBank, Plus, Trash2 } from "lucide-react"
import {
  type SavingsGoal,
  createSavingsGoal,
  deleteSavingsGoal,
  listSavingsGoals,
} from "@/components/finance/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SavingsGoalsPanelProps {
  refreshToken?: number
  onChange?: () => void
}

function GoalRow({ goal, onDelete }: { goal: SavingsGoal; onDelete: (id: number) => void }) {
  const pct = goal.target_amount ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0

  return (
    <li className="rounded-xl border border-border-subtle bg-canvas px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{goal.title}</p>
          <p className="text-xs text-muted-foreground">
            {goal.current_amount.toLocaleString()} / {goal.target_amount.toLocaleString()}
            {goal.target_date && ` · by ${goal.target_date}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-primary">{pct.toFixed(0)}%</span>
          <button
            type="button"
            onClick={() => onDelete(goal.id)}
            aria-label="Delete savings goal"
            className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  )
}

export function SavingsGoalsPanel({ refreshToken, onChange }: SavingsGoalsPanelProps) {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [target, setTarget] = useState("")
  const [current, setCurrent] = useState("")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    const result = await listSavingsGoals()
    setGoals(result)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const parsedTarget = Number(target)
    if (!parsedTarget || !title.trim()) return
    setSaving(true)
    try {
      await createSavingsGoal({
        title: title.trim(),
        target_amount: parsedTarget,
        current_amount: Number(current) || 0,
      })
      setTitle("")
      setTarget("")
      setCurrent("")
      await refresh()
      onChange?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteSavingsGoal(id)
    await refresh()
    onChange?.()
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <PiggyBank className="size-4 text-primary" />
        Savings Goals
      </h2>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" />
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target"
          type="number"
          min="0"
          step="0.01"
        />
        <Input
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Saved so far"
          type="number"
          min="0"
          step="0.01"
        />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !target || !title.trim()}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add
        </Button>
      </form>

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings goals yet"
          description="Add one above, or tell Buddy in chat."
        />
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  )
}
