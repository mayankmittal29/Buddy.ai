import { useState } from "react"
import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget"
import { RoadmapView } from "@/components/learning/RoadmapView"
import { CoursesList } from "@/components/learning/CoursesList"
import { CertificationsList } from "@/components/learning/CertificationsList"
import { RevisionPlanner } from "@/components/learning/RevisionPlanner"
import { pageShell } from "@/lib/styles"

const SKILL_ID = "learning"

export default function LearningSkill() {
  const [refreshToken, setRefreshToken] = useState(0)
  const bump = () => setRefreshToken((t) => t + 1)

  return (
    <div className={pageShell}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">Learning Hub</h1>
        <p className="mt-2 text-muted-foreground">
          Track courses and certifications, follow an AI-planned roadmap, and stay on top of
          revision.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <RoadmapView refreshToken={refreshToken} />
          <CoursesList refreshToken={refreshToken} onChange={bump} />
        </div>
        <div className="space-y-6">
          <CertificationsList refreshToken={refreshToken} onChange={bump} />
          <RevisionPlanner refreshToken={refreshToken} />
        </div>
      </div>

      <FloatingChatWidget skillId={SKILL_ID} onTurnComplete={bump} />
    </div>
  )
}
