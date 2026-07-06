export type SkillStatus = "active" | "coming-soon"

/** Soft icon-badge background + icon color pair, e.g. "bg-violet-100 text-violet-600". */
export type SkillAccent = { bg: string; text: string }

export interface SkillConfig {
  id: string
  title: string
  description: string
  /** lucide-react icon component name, e.g. "Calendar" */
  icon: string
  status: SkillStatus
  accent: SkillAccent
}

export const SKILLS: SkillConfig[] = [
  {
    id: "planner",
    title: "Planner",
    description: "Plan your day and week around what actually matters.",
    icon: "Calendar",
    status: "active",
    accent: { bg: "bg-violet-100", text: "text-violet-600" },
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Track to-dos and get gentle nudges to follow through.",
    icon: "ListChecks",
    status: "active",
    accent: { bg: "bg-blue-100", text: "text-blue-600" },
  },
  {
    id: "news",
    title: "News",
    description: "A quick, curated briefing on what's happening today.",
    icon: "Newspaper",
    status: "coming-soon",
    accent: { bg: "bg-rose-100", text: "text-rose-600" },
  },
  {
    id: "career",
    title: "Career",
    description: "Track goals, applications, and growth opportunities.",
    icon: "Briefcase",
    status: "active",
    accent: { bg: "bg-amber-100", text: "text-amber-600" },
  },
  {
    id: "learning",
    title: "Learning",
    description: "Keep momentum on courses, books, and new skills.",
    icon: "GraduationCap",
    status: "active",
    accent: { bg: "bg-teal-100", text: "text-teal-600" },
  },
  {
    id: "finance",
    title: "Finance",
    description: "Keep an eye on spending, budgets, and savings goals.",
    icon: "Wallet",
    status: "coming-soon",
    accent: { bg: "bg-green-100", text: "text-green-600" },
  },
  {
    id: "habits",
    title: "Habits",
    description: "Build routines and keep streaks alive.",
    icon: "Repeat",
    status: "coming-soon",
    accent: { bg: "bg-pink-100", text: "text-pink-600" },
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Your personal notes and reference material, searchable.",
    icon: "BookOpen",
    status: "coming-soon",
    accent: { bg: "bg-purple-100", text: "text-purple-600" },
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "See trends across everything Buddy helps you manage.",
    icon: "BarChart3",
    status: "coming-soon",
    accent: { bg: "bg-sky-100", text: "text-sky-600" },
  },
]
