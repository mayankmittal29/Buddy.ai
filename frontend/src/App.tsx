import { Link, Route, Routes } from 'react-router-dom'
import HealthStatus from '@/components/HealthStatus'
import Home from '@/pages/Home'
import Profile from '@/pages/Profile'
import About from '@/pages/About'
import Skill from '@/pages/Skill'
import TasksSkill from '@/pages/skills/TasksSkill'

export default function App() {
  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <HealthStatus />
      <nav className="flex gap-4 border-b border-border px-4 py-3 text-sm">
        <Link to="/">Home</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/about">About</Link>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/skills/tasks" element={<TasksSkill />} />
          <Route path="/skills/:skillId" element={<Skill />} />
        </Routes>
      </div>
    </div>
  )
}
