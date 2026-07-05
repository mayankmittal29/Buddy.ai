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
import { TaskPanel } from "@/components/tasks/TaskPanel"
import { cn } from "@/lib/utils"

const SKILL_ID = "tasks"
const CONVERSATION_STORAGE_KEY = "buddy:conversation:tasks"

export default function TasksSkill() {
  const [conversationId, setConversationId] = useState<number | null>(() => {
    const stored = localStorage.getItem(CONVERSATION_STORAGE_KEY)
    return stored ? Number(stored) : null
  })
  const [refreshToken, setRefreshToken] = useState(0)
  const [taskRefreshToken, setTaskRefreshToken] = useState(0)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  function handleConversationIdChange(id: number | null) {
    setConversationId(id)
    if (id === null) localStorage.removeItem(CONVERSATION_STORAGE_KEY)
    else localStorage.setItem(CONVERSATION_STORAGE_KEY, String(id))
  }

  function handleTurnComplete() {
    // Refresh soon (new conversation showing up / title updated from the
    // opening exchange) and again shortly after (background summarization
    // finishes a couple seconds later).
    setRefreshToken((t) => t + 1)
    setTimeout(() => setRefreshToken((t) => t + 1), 3500)
    // The turn may have created/updated/deleted tasks via tools — refresh
    // the tasks list live instead of requiring a page refresh to see it.
    setTaskRefreshToken((t) => t + 1)
  }

  return (
    <Workspace>
      <WorkspaceLeftPanel className="w-96">
        <TaskPanel refreshToken={taskRefreshToken} />
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
          conversationId={conversationId}
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
            activeConversationId={conversationId}
            onSelect={handleConversationIdChange}
            refreshToken={refreshToken}
          />
        </div>
      </WorkspaceRightPanel>
    </Workspace>
  )
}
