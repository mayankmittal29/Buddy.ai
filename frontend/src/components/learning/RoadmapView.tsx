import { useEffect, useState } from "react"
import { CheckCircle2, Circle, Map } from "lucide-react"
import { type Course, listCourses } from "@/components/learning/api"
import { EmptyState } from "@/components/ui/empty-state"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface RoadmapViewProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have (re)generated the roadmap. */
  refreshToken?: number
}

export function RoadmapView({ refreshToken }: RoadmapViewProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    listCourses()
      .then(setCourses)
      .finally(() => setLoading(false))
  }, [refreshToken])

  const roadmap = courses
    .filter((c) => c.roadmap_position != null)
    .sort((a, b) => (a.roadmap_position ?? 0) - (b.roadmap_position ?? 0))

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Map className="size-4 text-primary" />
        Learning Roadmap
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : roadmap.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No roadmap yet"
          description='Tell Buddy your goal in chat (e.g. "I want to be job-ready for backend roles") and it will lay out an ordered plan here.'
        />
      ) : (
        <ol className="relative space-y-4 border-l-2 border-border-subtle pl-6">
          {roadmap.map((course) => {
            const isDone = course.status === "done"
            return (
              <li key={course.id} className="relative">
                <span
                  className={cn(
                    "absolute top-0.5 -left-[1.85rem] flex size-5 items-center justify-center rounded-full",
                    isDone ? "bg-success text-white" : "bg-primary-50 text-primary"
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <Circle className="size-3" />
                  )}
                </span>
                <p
                  className={cn(
                    "text-sm font-medium text-foreground",
                    isDone && "text-muted-foreground line-through"
                  )}
                >
                  {course.roadmap_position}. {course.title}
                </p>
                {course.roadmap_rationale && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {course.roadmap_rationale}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
