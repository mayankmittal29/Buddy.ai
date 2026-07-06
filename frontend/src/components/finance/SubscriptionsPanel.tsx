import { useEffect, useState } from "react"
import { CalendarClock, Plus, Repeat2, Trash2 } from "lucide-react"
import {
  type BillingCycle,
  type Subscription,
  createSubscription,
  deleteSubscription,
  listSubscriptions,
} from "@/components/finance/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SubscriptionsPanelProps {
  refreshToken?: number
  onChange?: () => void
}

const CYCLES: BillingCycle[] = ["weekly", "monthly", "yearly"]

export function SubscriptionsPanel({ refreshToken, onChange }: SubscriptionsPanelProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [cycle, setCycle] = useState<BillingCycle>("monthly")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    const result = await listSubscriptions()
    setSubscriptions(result)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!parsed || !name.trim()) return
    setSaving(true)
    try {
      await createSubscription({ name: name.trim(), amount: parsed, billing_cycle: cycle })
      setName("")
      setAmount("")
      setCycle("monthly")
      await refresh()
      onChange?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteSubscription(id)
    await refresh()
    onChange?.()
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Repeat2 className="size-4 text-primary" />
        Subscriptions
      </h2>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          min="0"
          step="0.01"
        />
        <select
          value={cycle}
          onChange={(e) => setCycle(e.target.value as BillingCycle)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring"
        >
          {CYCLES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="sm"
          disabled={saving || !amount || !name.trim()}
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
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={Repeat2}
          title="No subscriptions yet"
          description="Add one above, or tell Buddy in chat."
        />
      ) : (
        <ul className="space-y-1.5">
          {subscriptions.map((sub) => (
            <li
              key={sub.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{sub.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" />
                  Next charge {sub.next_charge_at} · {sub.billing_cycle}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {sub.amount.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(sub.id)}
                aria-label="Delete subscription"
                className="shrink-0 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
