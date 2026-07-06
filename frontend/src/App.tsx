import { Route, Routes } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'
import Home from '@/pages/Home'
import Profile from '@/pages/Profile'
import About from '@/pages/About'
import Settings from '@/pages/Settings'
import Notifications from '@/pages/Notifications'
import Skill from '@/pages/Skill'
import TasksSkill from '@/pages/skills/TasksSkill'
import PlannerSkill from '@/pages/skills/PlannerSkill'
import LearningSkill from '@/pages/skills/LearningSkill'
import CareerSkill from '@/pages/skills/CareerSkill'
import HabitsSkill from '@/pages/skills/HabitsSkill'
import FinanceSkill from '@/pages/skills/FinanceSkill'
import NewsSkill from '@/pages/skills/NewsSkill'
import KnowledgeBaseSkill from '@/pages/skills/KnowledgeBaseSkill'
import AnalyticsSkill from '@/pages/skills/AnalyticsSkill'

export default function App() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <Navbar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/skills/tasks" element={<TasksSkill />} />
          <Route path="/skills/planner" element={<PlannerSkill />} />
          <Route path="/skills/learning" element={<LearningSkill />} />
          <Route path="/skills/career" element={<CareerSkill />} />
          <Route path="/skills/habits" element={<HabitsSkill />} />
          <Route path="/skills/finance" element={<FinanceSkill />} />
          <Route path="/skills/news" element={<NewsSkill />} />
          <Route path="/skills/knowledge-base" element={<KnowledgeBaseSkill />} />
          <Route path="/skills/analytics" element={<AnalyticsSkill />} />
          <Route path="/skills/:skillId" element={<Skill />} />
        </Routes>
      </div>
    </div>
  )
}
