from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import router as analytics_router
from app.api.career import router as career_router
from app.api.chat import router as chat_router
from app.api.conversations import router as conversations_router
from app.api.debug import router as debug_router
from app.api.finance import router as finance_router
from app.api.habits import router as habits_router
from app.api.knowledge import router as knowledge_router
from app.api.learning import router as learning_router
from app.api.news import router as news_router
from app.api.notifications import router as notifications_router
from app.api.planner import router as planner_router
from app.api.profile import router as profile_router
from app.api.tasks import router as tasks_router
from app.common.scheduler import start_scheduler, stop_scheduler
from app.core.agent import root_agent
from app.skills import load_skills

load_skills(root_agent)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Buddy API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics_router)
app.include_router(career_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(debug_router)
app.include_router(finance_router)
app.include_router(habits_router)
app.include_router(knowledge_router)
app.include_router(learning_router)
app.include_router(news_router)
app.include_router(planner_router)
app.include_router(profile_router)
app.include_router(tasks_router)
app.include_router(notifications_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
