import { useParams } from "react-router-dom"
import { SKILLS } from "@/config/skills"

export default function Skill() {
  const { skillId } = useParams<{ skillId: string }>()
  const skill = SKILLS.find((s) => s.id === skillId)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{skill?.title ?? skillId}</h1>
      <p className="mt-2 text-muted-foreground">
        {skill ? skill.description : "Unknown skill."}
      </p>
    </div>
  )
}
