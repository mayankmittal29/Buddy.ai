import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import RequireAuth from '@/components/auth/RequireAuth'
import RedirectIfAuthed from '@/components/auth/RedirectIfAuthed'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
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
  // Clicking anywhere outside an active toast dismisses it — toasts render
  // inside the container below (tagged via containerClassName), so a click
  // that doesn't land inside that container closes whatever's showing.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('.buddy-toaster-root')) {
        toast.dismiss()
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <>
      <Toaster
        position="top-center"
        containerClassName="buddy-toaster-root"
        toastOptions={{
          duration: 3000,
          className: 'font-sans text-sm',
          style: {
            background: 'var(--color-surface)',
            color: 'var(--foreground)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: '0.75rem',
            boxShadow: 'var(--shadow-card-hover)',
            minWidth: '280px',
          },
        }}
      />
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthed>
              <Signup />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthed>
              <ForgotPassword />
            </RedirectIfAuthed>
          }
        />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/*"
          element={
            <RequireAuth>
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
            </RequireAuth>
          }
        />
      </Routes>
    </>
  )
}
