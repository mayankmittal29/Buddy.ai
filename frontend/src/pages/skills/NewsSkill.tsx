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
import { NewsListPanel } from "@/components/news/NewsListPanel"
import { cn } from "@/lib/utils"

const SKILL_ID = "news"

export default function NewsSkill() {
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [newsRefreshToken, setNewsRefreshToken] = useState(0)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  function handleTurnComplete() {
    setRefreshToken((t) => t + 1)
    setTimeout(() => setRefreshToken((t) => t + 1), 3500)
    // A chat turn may have triggered generate_daily_digest via tools —
    // refresh the news list live instead of requiring a page refresh.
    setNewsRefreshToken((t) => t + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border-subtle bg-canvas px-8 py-4">
        <h1 className="font-script text-4xl font-bold text-primary">News</h1>
        <p className="mt-1 text-muted-foreground">
          A daily digest from arXiv, GitHub Trending, and Hacker News — filter by category, and
          ask Buddy for a deeper summary on anything.
        </p>
      </div>

      <Workspace>
        <WorkspaceLeftPanel className="w-96">
          <NewsListPanel refreshToken={newsRefreshToken} />
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
            onConversationIdChange={setConversationId}
            onTurnComplete={handleTurnComplete}
          />
        </WorkspaceCenterPanel>
        <WorkspaceRightPanel
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            rightPanelOpen ? "w-80" : "w-0 border-l-0 px-0 py-0"
          )}
        >
          <div className="w-64">
            <ConversationsPanel
              skillId={SKILL_ID}
              activeConversationId={conversationId}
              onSelect={setConversationId}
              refreshToken={refreshToken}
            />
          </div>
        </WorkspaceRightPanel>
      </Workspace>
    </div>
  )
}
