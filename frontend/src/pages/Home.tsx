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
import { cardBase, cardHover, pageShell } from "@/lib/styles"
import { cn } from "@/lib/utils"

export default function Home() {
  return (
    <div className={cn(pageShell, "flex gap-6")}>
      <div className="relative hidden w-80 shrink-0 flex-col justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 via-accent-50 to-primary-50 p-8 md:flex">
        <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-accent/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 size-48 rounded-full bg-primary/20 blur-2xl" />
        <h1 className="font-script text-5xl leading-tight font-bold text-primary">
          Hey there!
        </h1>
        <p className="mt-4 text-lg font-medium text-foreground">
          What shall we <span className="text-primary">achieve</span> today?
        </p>
        <p className="mt-2 text-muted-foreground">
          Pick a skill to get started. 🚀
        </p>
      </div>

      <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
        {SKILLS.map((skill) => {
          const Icon = icons[skill.icon as keyof typeof icons]
          const isActive = skill.status === "active"

          const card = (
            <Card
              className={cn(
                cardBase,
                "h-full",
                isActive ? cardHover : "opacity-60"
              )}
            >
              <CardHeader>
                {Icon && (
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      skill.accent.bg
                    )}
                  >
                    <Icon className={cn("size-5", skill.accent.text)} />
                  </div>
                )}
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
