const API_URL = import.meta.env.VITE_API_URL

export type BillingCycle = "weekly" | "monthly" | "yearly"

export interface Expense {
  id: number
  amount: number
  category: string
  note: string | null
  spent_at: string
}

export interface Budget {
  id: number
  category: string
  monthly_limit: number
}

export interface Subscription {
  id: number
  name: string
  amount: number
  billing_cycle: BillingCycle
  next_charge_at: string
}

export interface SavingsGoal {
  id: number
  title: string
  target_amount: number
  current_amount: number
  target_date: string | null
}

export interface SavingsEntry {
  id: number
  name: string
  amount: number
  saved_at: string
  notes: string | null
}

export interface ExpenseSummary {
  month: string
  total: number
  by_category: Record<string, number>
}

export interface BudgetStatus {
  category: string
  monthly_limit: number | null
  spent: number
  remaining: number | null
  pct_used: number | null
  over_budget: boolean
}

export interface MonthlyInsights {
  month: string
  total_spend: number
  top_categories: { category: string; amount: number }[]
  budget_overruns: { category: string; spent: number; monthly_limit: number; over_by: number }[]
  insight: string
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function get<T>(path: string): Promise<T> {
  return fetch(`${API_URL}/api/finance${path}`).then(unwrap<T>)
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return fetch(`${API_URL}/api/finance${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(unwrap<T>)
}

// Expenses
export const listExpenses = () => get<Expense[]>("/expenses")
export const createExpense = (input: { amount: number; category: string; note?: string | null }) =>
  send<Expense>("/expenses", "POST", input)
export const deleteExpense = (id: number) => send<void>(`/expenses/${id}`, "DELETE")

// Budgets
export const listBudgets = () => get<Budget[]>("/budgets")
export const createBudget = (input: { category: string; monthly_limit: number }) =>
  send<Budget>("/budgets", "POST", input)
export const updateBudget = (id: number, input: { category: string; monthly_limit: number }) =>
  send<Budget>(`/budgets/${id}`, "PUT", input)
export const deleteBudget = (id: number) => send<void>(`/budgets/${id}`, "DELETE")

// Subscriptions
export const listSubscriptions = () => get<Subscription[]>("/subscriptions")
export const createSubscription = (input: {
  name: string
  amount: number
  billing_cycle: BillingCycle
  next_charge_at?: string | null
}) => send<Subscription>("/subscriptions", "POST", input)
export const deleteSubscription = (id: number) => send<void>(`/subscriptions/${id}`, "DELETE")

// Savings goals
export const listSavingsGoals = () => get<SavingsGoal[]>("/savings-goals")
export const createSavingsGoal = (input: {
  title: string
  target_amount: number
  current_amount?: number
  target_date?: string | null
}) => send<SavingsGoal>("/savings-goals", "POST", input)
export const updateSavingsGoal = (
  id: number,
  input: { title: string; target_amount: number; current_amount: number; target_date?: string | null }
) => send<SavingsGoal>(`/savings-goals/${id}`, "PUT", input)
export const deleteSavingsGoal = (id: number) => send<void>(`/savings-goals/${id}`, "DELETE")

// Savings entries (a simple ledger of completed savings)
export const listSavingsEntries = () => get<SavingsEntry[]>("/savings-entries")
export const createSavingsEntry = (input: {
  name: string
  amount: number
  saved_at?: string | null
  notes?: string | null
}) => send<SavingsEntry>("/savings-entries", "POST", input)
export const updateSavingsEntry = (
  id: number,
  input: { name: string; amount: number; saved_at?: string | null; notes?: string | null }
) => send<SavingsEntry>(`/savings-entries/${id}`, "PUT", input)
export const deleteSavingsEntry = (id: number) => send<void>(`/savings-entries/${id}`, "DELETE")

// Derived views
export const getExpenseSummary = (month?: string) =>
  get<ExpenseSummary>(`/summary${month ? `?month=${month}` : ""}`)
export const getBudgetStatus = (category: string) =>
  get<BudgetStatus>(`/budget-status/${encodeURIComponent(category)}`)
export const getMonthlyInsights = () => get<MonthlyInsights>("/insights")
