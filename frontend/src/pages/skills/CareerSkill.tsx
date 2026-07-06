import { useState } from "react"
import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget"
import { ResumesPanel } from "@/components/career/ResumesPanel"
import { KanbanBoard } from "@/components/career/KanbanBoard"
import { SkillGapPanel } from "@/components/career/SkillGapPanel"
import { pageShell } from "@/lib/styles"

const SKILL_ID = "career"

export default function CareerSkill() {
  const [refreshToken, setRefreshToken] = useState(0)
  const [resumeRefreshToken, setResumeRefreshToken] = useState(0)
  const [chatTrigger, setChatTrigger] = useState({ text: "", nonce: 0 })

  function bump() {
    setRefreshToken((t) => t + 1)
  }

  function bumpResumes() {
    setResumeRefreshToken((t) => t + 1)
  }

  function handleAnalyze(message: string) {
    setChatTrigger((prev) => ({ text: message, nonce: prev.nonce + 1 }))
  }

  return (
    <div className={pageShell}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">Career Hub</h1>
        <p className="mt-2 text-muted-foreground">
          Manage resume versions, track applications, and check your resume against a job
          description.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <KanbanBoard refreshToken={refreshToken} />
          <ResumesPanel refreshToken={refreshToken} onChange={bumpResumes} />
        </div>
        <div>
          <SkillGapPanel refreshToken={resumeRefreshToken} onAnalyze={handleAnalyze} />
        </div>
      </div>

      <FloatingChatWidget
        skillId={SKILL_ID}
        onTurnComplete={bump}
        externalTrigger={chatTrigger}
      />
    </div>
  )
}
