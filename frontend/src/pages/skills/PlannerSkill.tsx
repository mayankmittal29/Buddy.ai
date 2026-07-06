import { useState } from "react"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import {
  Workspace,
  WorkspaceLeftPanel,
  WorkspaceCenterPanel,
  WorkspaceRightPanel,
} from "@/components/workspace/Workspace"
import { ChatPanel } from "@/components/workspace/ChatPanel"
import { ConversationsPanel } from "@/components/workspace/ConversationsPanel"
import { DailyPanel } from "@/components/planner/DailyPanel"
import { PlanTable } from "@/components/planner/PlanTable"
import type { PlannerMode } from "@/components/planner/api"
import { pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const SKILL_ID = "planner"

const MODES: { value: PlannerMode; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

function conversationStorageKey(mode: PlannerMode) {
  return `buddy:conversation:planner:${mode}`
}

export default function PlannerSkill() {
  const [mode, setMode] = useState<PlannerMode>("daily")
  const [conversationIds, setConversationIds] = useState<Record<PlannerMode, number | null>>(
    () => {
      const read = (m: PlannerMode) => {
        const stored = localStorage.getItem(conversationStorageKey(m))
        return stored ? Number(stored) : null
      }
      return { daily: read("daily"), weekly: read("weekly"), monthly: read("monthly") }
    }
  )
  const [refreshToken, setRefreshToken] = useState(0)
  const [itemsRefreshToken, setItemsRefreshToken] = useState(0)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  const activeConversationId = conversationIds[mode]

  function handleConversationIdChange(id: number | null) {
    setConversationIds((prev) => ({ ...prev, [mode]: id }))
    const key = conversationStorageKey(mode)
    if (id === null) localStorage.removeItem(key)
    else localStorage.setItem(key, String(id))
  }

  function handleTurnComplete() {
    // Refresh soon (new conversation showing up / title updated from the
    // opening exchange) and again shortly after (background summarization
    // finishes a couple seconds later).
    setRefreshToken((t) => t + 1)
    setTimeout(() => setRefreshToken((t) => t + 1), 3500)
    // The turn may have added/completed plan items via tools — refresh the
    // left panel live instead of requiring a page refresh to see it.
    setItemsRefreshToken((t) => t + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border-subtle bg-canvas px-8 py-4">
        <h1 className="font-script text-4xl font-bold text-primary">Planner</h1>
        <p className="mt-1 text-muted-foreground">
          Plan your day, week, and month around what actually matters, with Buddy alongside.
        </p>
        <div className="mt-3 flex gap-1.5">
          {MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                pillBase,
                "px-4 py-1.5 text-sm",
                mode === value
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-card"
                  : "border border-border-subtle text-slate-500 hover:border-primary/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Workspace>
        <WorkspaceLeftPanel className="w-96">
          {mode === "daily" ? (
            <DailyPanel refreshToken={itemsRefreshToken} />
          ) : (
            <PlanTable mode={mode} refreshToken={itemsRefreshToken} />
          )}
        </WorkspaceLeftPanel>
        <WorkspaceCenterPanel className="relative">
          <button
            type="button"
            onClick={() => setRightPanelOpen((open) => !open)}
            aria-label={
              rightPanelOpen ? "Collapse conversations panel" : "Expand conversations panel"
            }
            className="absolute top-6 right-6 z-10 flex size-8 items-center justify-center rounded-full border border-border-subtle bg-surface text-slate-500 shadow-card transition-colors duration-150 hover:text-primary"
          >
            {rightPanelOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
          </button>
          <ChatPanel
            skillId={SKILL_ID}
            mode={mode}
            conversationId={activeConversationId}
            onConversationIdChange={handleConversationIdChange}
            onTurnComplete={handleTurnComplete}
          />
        </WorkspaceCenterPanel>
        <WorkspaceRightPanel
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            rightPanelOpen ? "w-80" : "w-0 border-l-0 px-0 py-0"
          )}
        >
          {/* Fixed to the panel's open-state content-box width (w-80 minus
              pageShell's px-8 padding on both sides) so content doesn't
              squish/reflow while the outer panel's width animates. */}
          <div className="w-64">
            <ConversationsPanel
              skillId={SKILL_ID}
              mode={mode}
              activeConversationId={activeConversationId}
              onSelect={handleConversationIdChange}
              refreshToken={refreshToken}
            />
          </div>
        </WorkspaceRightPanel>
      </Workspace>
    </div>
  )
}
