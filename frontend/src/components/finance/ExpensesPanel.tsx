import { useEffect, useState } from "react"
import { Plus, Receipt, Trash2 } from "lucide-react"
import { type Expense, createExpense, deleteExpense, listExpenses } from "@/components/finance/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ExpensesPanelProps {
  refreshToken?: number
  onChange?: () => void
}

export function ExpensesPanel({ refreshToken, onChange }: ExpensesPanelProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  async function refresh() {
    const result = await listExpenses()
    setExpenses(result)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(amount)
    if (!parsed || !category.trim()) return
    setSaving(true)
    try {
      await createExpense({ amount: parsed, category: category.trim(), note: note.trim() || null })
      setAmount("")
      setCategory("")
      setNote("")
      await refresh()
      onChange?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteExpense(id)
    await refresh()
    onChange?.()
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Receipt className="size-4 text-primary" />
        Expenses
      </h2>

      <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          min="0"
          step="0.01"
        />
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
        />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !amount || !category.trim()}
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
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          description="Add one above, or tell Buddy in chat."
        />
      ) : (
        <ul className="max-h-80 space-y-1.5 overflow-y-auto">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {expense.category}
                  {expense.note && (
                    <span className="ml-1.5 font-normal text-slate-500">— {expense.note}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{expense.spent_at}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {expense.amount.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(expense.id)}
                aria-label="Delete expense"
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
