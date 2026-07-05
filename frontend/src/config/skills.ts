export type SkillStatus = "active" | "coming-soon"

export interface SkillConfig {
  id: string
  title: string
  description: string
  /** lucide-react icon component name, e.g. "Calendar" */
  icon: string
  status: SkillStatus
}

export const SKILLS: SkillConfig[] = [
  {
    id: "planner",
    title: "Planner",
    description: "Plan your day and week around what actually matters.",
    icon: "Calendar",
    status: "active",
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Track to-dos and get gentle nudges to follow through.",
    icon: "ListChecks",
    status: "active",
  },
  {
    id: "news",
    title: "News",
    description: "A quick, curated briefing on what's happening today.",
    icon: "Newspaper",
    status: "coming-soon",
  },
  {
    id: "career",
    title: "Career",
    description: "Track goals, applications, and growth opportunities.",
    icon: "Briefcase",
    status: "coming-soon",
  },
  {
    id: "learning",
    title: "Learning",
    description: "Keep momentum on courses, books, and new skills.",
    icon: "GraduationCap",
    status: "coming-soon",
  },
  {
    id: "finance",
    title: "Finance",
    description: "Keep an eye on spending, budgets, and savings goals.",
    icon: "Wallet",
    status: "coming-soon",
  },
  {
    id: "habits",
    title: "Habits",
    description: "Build routines and keep streaks alive.",
    icon: "Repeat",
    status: "coming-soon",
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Your personal notes and reference material, searchable.",
    icon: "BookOpen",
    status: "coming-soon",
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "See trends across everything Buddy helps you manage.",
    icon: "BarChart3",
    status: "coming-soon",
  },
]
