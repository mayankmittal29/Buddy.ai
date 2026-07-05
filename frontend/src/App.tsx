import { Link, Route, Routes } from 'react-router-dom'
import UserAvatar from '@/components/UserAvatar'
import Home from '@/pages/Home'
import Profile from '@/pages/Profile'
import About from '@/pages/About'
import Skill from '@/pages/Skill'
import TasksSkill from '@/pages/skills/TasksSkill'
import PlannerSkill from '@/pages/skills/PlannerSkill'

export default function App() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border-subtle bg-gradient-to-r from-primary-50 via-white to-accent-50 px-6 py-3">
        <Link
          to="/"
          className="font-script text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        >
          Buddy
        </Link>
        <nav className="flex gap-6 text-sm font-medium">
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <Link to="/profile" className="hover:text-primary">
            Profile
          </Link>
          <Link to="/about" className="hover:text-primary">
            About
          </Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {/* Hardcoded until signup/login + JWT session cookies land — then
              this becomes the authenticated user's actual name. */}
          <span className="text-sm font-medium text-foreground">Mayank</span>
          <UserAvatar />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/skills/tasks" element={<TasksSkill />} />
          <Route path="/skills/planner" element={<PlannerSkill />} />
          <Route path="/skills/:skillId" element={<Skill />} />
        </Routes>
      </div>
    </div>
  )
}
