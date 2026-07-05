export default function About() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">About Buddy</h1>
      <p className="mt-2 text-muted-foreground">
        Buddy is a personal productivity assistant: one agent, adaptable
        across the different parts of your life it helps you manage.
      </p>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-medium">What it does</h2>
        <p className="text-sm text-muted-foreground">
          Instead of juggling a separate app for tasks, planning, finances,
          habits, and so on, Buddy is a single assistant that switches
          "skills" depending on what you're doing — planning your day, tasks,
          finances, learning, and more. It remembers things you tell it (your
          preferences, routines, recurring details) and carries that
          knowledge across skills and sessions, so you don't have to repeat
          yourself.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-medium">Track: Concierge Agents</h2>
        <p className="text-sm text-muted-foreground">
          Buddy is built for the Concierge Agents track — agents whose job is
          to act as a personal, ever-present helper across many domains,
          rather than a single-purpose tool. The emphasis is on one
          consistent assistant that understands context about you (your
          schedule, your habits) and adapts its behaviour to whatever you
          need help with in the moment.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-medium">How it's built</h2>
        <p className="text-sm text-muted-foreground">
          The frontend is a React app: a home screen listing available
          skills, and a shared chat layout each skill plugs into. The
          backend is a FastAPI service built around Google's Agent
          Development Kit (ADK), with a single root agent ("Buddy") powered
          by Gemini.
        </p>
        <p className="text-sm text-muted-foreground">
          Each skill is just a folder with a short description and a set of
          instructions. Buddy only loads a skill's full instructions when
          it's actually relevant to what you're asking — this keeps things
          fast and lets new skills get added without bloating every
          conversation.
        </p>
        <p className="text-sm text-muted-foreground">
          Memory works at two levels: short-term conversation state (so
          Buddy remembers what you just said, within one chat) and long-term
          memory (durable facts about you, stored with vector embeddings in
          Postgres via pgvector, so Buddy can recall them in any future
          conversation, under any skill). Every conversation is traced with
          LangSmith, so behaviour can be inspected and debugged.
        </p>
      </section>
    </div>
  )
}
