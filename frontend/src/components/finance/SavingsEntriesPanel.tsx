import { useEffect, useState } from "react"
import { showSuccess, showError } from "@/lib/toast"
import { PiggyBank, Plus, Trash2 } from "lucide-react"
import {
  type SavingsEntry,
  createSavingsEntry,
  deleteSavingsEntry,
  listSavingsEntries,
} from "@/components/finance/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SavingsEntriesPanelProps {
  refreshToken?: number
  onChange?: () => void
}

export function SavingsEntriesPanel({ refreshToken, onChange }: SavingsEntriesPanelProps) {
  const [entries, setEntries] = useState<SavingsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [savedAt, setSavedAt] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setEntries(await listSavingsEntries())
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
      await createSavingsEntry({
        name: name.trim(),
        amount: parsed,
        saved_at: savedAt || null,
        notes: notes.trim() || null,
      })
      setName("")
      setAmount("")
      setSavedAt("")
      setNotes("")
      await refresh()
      onChange?.()
      showSuccess("Savings entry added.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't add the savings entry.", { duration: 5000 })
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSavingsEntry(id)
      await refresh()
      onChange?.()
      showSuccess("Savings entry deleted.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't delete the savings entry.", { duration: 5000 })
      throw err
    }
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PiggyBank className="size-4 text-primary" />
          Savings
        </h2>
        {entries.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            Total saved: <span className="text-foreground">{total.toLocaleString()}</span>
          </span>
        )}
      </div>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="What did you save for/from?" />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount saved"
          type="number"
          min="0"
          step="0.01"
        />
        <Input value={savedAt} onChange={(e) => setSavedAt(e.target.value)} type="date" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !amount || !name.trim()}
          className="sm:col-span-2 bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Log Saving
        </Button>
      </form>

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings logged yet"
          description="Log one above, or tell Buddy in chat."
        />
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {entry.name}
                  {entry.notes && <span className="ml-1.5 font-normal text-slate-500">— {entry.notes}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{entry.saved_at}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-success">
                +{entry.amount.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(entry.id)}
                aria-label="Delete savings entry"
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
