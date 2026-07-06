import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget"
import { NotesTab } from "@/components/knowledge/NotesTab"
import { DocumentsTab } from "@/components/knowledge/DocumentsTab"
import { BookmarksTab } from "@/components/knowledge/BookmarksTab"

// Backend folder/module names can't contain hyphens (see
// app/skills/loader.py — the skill_id is the literal folder name, imported
// as a Python package), so this differs from the "knowledge-base" route
// slug/nav id in config/skills.ts — that mismatch is fine, the route and
// the chat skill_id are otherwise unrelated.
const SKILL_ID = "knowledge_base"

export default function KnowledgeBaseSkill() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="shrink-0 border-b border-border-subtle bg-canvas px-8 py-4">
        <h1 className="font-script text-4xl font-bold text-primary">Knowledge Base</h1>
        <p className="mt-1 text-muted-foreground">
          Notes, bookmarks, and true semantic search over your uploaded documents — ask Buddy
          anything and get answers grounded in what you've added.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <NotesTab />
          <DocumentsTab />
          <BookmarksTab />
        </div>
      </div>

      <FloatingChatWidget skillId={SKILL_ID} />
    </div>
  )
}
