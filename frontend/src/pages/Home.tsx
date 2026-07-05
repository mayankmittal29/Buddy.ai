import { Link } from "react-router-dom"
import { icons } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SKILLS } from "@/config/skills"

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a skill to get started.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SKILLS.map((skill) => {
          const Icon = icons[skill.icon as keyof typeof icons]
          const isActive = skill.status === "active"

          const card = (
            <Card
              className={
                isActive
                  ? "h-full transition-shadow hover:shadow-md"
                  : "h-full opacity-60"
              }
            >
              <CardHeader>
                {Icon && <Icon className="size-6 text-muted-foreground" />}
                <CardTitle>{skill.title}</CardTitle>
                <CardDescription>{skill.description}</CardDescription>
                {!isActive && (
                  <CardAction>
                    <Badge variant="secondary">Coming soon</Badge>
                  </CardAction>
                )}
              </CardHeader>
            </Card>
          )

          return isActive ? (
            <Link key={skill.id} to={`/skills/${skill.id}`}>
              {card}
            </Link>
          ) : (
            <div key={skill.id} aria-disabled="true">
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}
