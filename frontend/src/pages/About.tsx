import { Sparkles, Target, Layers, Mail } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { cardBase, pageShell, sectionGap } from "@/lib/styles"
import { cn } from "@/lib/utils"

const SECTIONS = [
  {
    icon: Sparkles,
    accent: "bg-violet-100 text-violet-600",
    title: "What it does",
    body: (
      <>
        Instead of juggling a separate app for tasks, planning, finances,
        habits, and so on, Buddy is a single assistant that switches
        "skills" depending on what you're doing — planning your day, tasks,
        finances, learning, and more. It remembers things you tell it (your
        preferences, routines, recurring details) and carries that
        knowledge across skills and sessions, so you don't have to repeat
        yourself.
      </>
    ),
  },
  {
    icon: Target,
    accent: "bg-amber-100 text-amber-600",
    title: "Track: Concierge Agents",
    body: (
      <>
        Buddy is built for the Concierge Agents track — agents whose job is
        to act as a personal, ever-present helper across many domains,
        rather than a single-purpose tool. The emphasis is on one
        consistent assistant that understands context about you (your
        schedule, your habits) and adapts its behaviour to whatever you
        need help with in the moment.
      </>
    ),
  },
  {
    icon: Layers,
    accent: "bg-blue-100 text-blue-600",
    title: "How it's built",
    body: (
      <div className="space-y-2">
        <p>
          The frontend is a React app: a home screen listing available
          skills, and a shared chat layout each skill plugs into. The
          backend is a FastAPI service built around Google's Agent
          Development Kit (ADK), with a single root agent ("Buddy") powered
          by Gemini.
        </p>
        <p>
          Each skill is just a folder with a short description and a set of
          instructions. Buddy only loads a skill's full instructions when
          it's actually relevant to what you're asking — this keeps things
          fast and lets new skills get added without bloating every
          conversation.
        </p>
        <p>
          Memory works at two levels: short-term conversation state (so
          Buddy remembers what you just said, within one chat) and
          long-term memory (durable facts about you, stored with vector
          embeddings in Postgres via pgvector, so Buddy can recall them in
          any future conversation, under any skill). Every conversation is
          traced with LangSmith, so behaviour can be inspected and
          debugged.
        </p>
      </div>
    ),
  },
]

export default function About() {
  return (
    <div className={cn(pageShell, "mx-auto max-w-5xl")}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">
          About Buddy
        </h1>
        <p className="mt-2 text-muted-foreground">
          Buddy is a personal productivity assistant: one agent, adaptable
          across the different parts of your life it helps you manage.
        </p>
      </div>

      <div className={cn(sectionGap, "grid grid-cols-1 gap-4 md:grid-cols-2")}>
        {SECTIONS.map(({ icon: Icon, accent, title, body }, i) => (
          <Card
            key={title}
            className={cn(cardBase, i === SECTIONS.length - 1 && "md:col-span-2")}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    accent
                  )}
                >
                  <Icon className="size-4.5" />
                </div>
                <CardTitle>{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className={cn(
                "text-sm text-muted-foreground",
                i === SECTIONS.length - 1 && "md:columns-2 md:gap-6"
              )}
            >
              {body}
            </CardContent>
          </Card>
        ))}

        <Card className={cn(cardBase, "md:col-span-2")}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                <Mail className="size-4.5" />
              </div>
              <div>
                <CardTitle>Get in touch</CardTitle>
                <CardDescription>
                  Questions, feedback, or just want to say hi?
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <a
              href="mailto:hello@buddy.ai"
              className="text-sm font-medium text-primary hover:underline"
            >
              hello@buddy.ai
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
