import { useState } from "react"
import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget"
import { ExpensesPanel } from "@/components/finance/ExpensesPanel"
import { CategoryBreakdownChart } from "@/components/finance/CategoryBreakdownChart"
import { BudgetVsActualChart } from "@/components/finance/BudgetVsActualChart"
import { SubscriptionsPanel } from "@/components/finance/SubscriptionsPanel"
import { SavingsGoalsPanel } from "@/components/finance/SavingsGoalsPanel"
import { SavingsEntriesPanel } from "@/components/finance/SavingsEntriesPanel"
import { MonthlyInsightsCard } from "@/components/finance/MonthlyInsightsCard"
import { pageShell } from "@/lib/styles"

const SKILL_ID = "finance"

export default function FinanceSkill() {
  const [refreshToken, setRefreshToken] = useState(0)
  const bump = () => setRefreshToken((t) => t + 1)

  return (
    <div className={pageShell}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">Finance</h1>
        <p className="mt-2 text-muted-foreground">
          Track expenses, budgets, subscriptions, and savings goals — all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <ExpensesPanel refreshToken={refreshToken} onChange={bump} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryBreakdownChart refreshToken={refreshToken} />
            <BudgetVsActualChart refreshToken={refreshToken} />
          </div>
          <SubscriptionsPanel refreshToken={refreshToken} onChange={bump} />
        </div>
        <div className="space-y-6">
          <MonthlyInsightsCard refreshToken={refreshToken} />
          <SavingsGoalsPanel refreshToken={refreshToken} onChange={bump} />
          <SavingsEntriesPanel refreshToken={refreshToken} onChange={bump} />
        </div>
      </div>

      <FloatingChatWidget skillId={SKILL_ID} onTurnComplete={bump} />
    </div>
  )
}
