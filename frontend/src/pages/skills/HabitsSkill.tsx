import { useState } from "react"
import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget"
import { HabitsList } from "@/components/habits/HabitsList"
import { HabitsInsights } from "@/components/habits/HabitsInsights"

const SKILL_ID = "habits"

export default function HabitsSkill() {
  const [refreshToken, setRefreshToken] = useState(0)
  const bump = () => setRefreshToken((t) => t + 1)

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="shrink-0 border-b border-border-subtle bg-canvas px-8 py-4">
        <h1 className="font-script text-4xl font-bold text-primary">Habits</h1>
        <p className="mt-1 text-muted-foreground">
          Simple habit logging with streak tracking and milestone notifications.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <HabitsInsights refreshToken={refreshToken} />
          <HabitsList refreshToken={refreshToken} onChange={bump} />
        </div>
      </div>

      <FloatingChatWidget skillId={SKILL_ID} onTurnComplete={bump} />
    </div>
  )
}
