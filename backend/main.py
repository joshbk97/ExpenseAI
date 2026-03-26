import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from config import get_settings
from seed_categories import seed_categories

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_categories()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info("🚀 Expense Tracker API started")
    yield
    # Shutdown
    await engine.dispose()
    logger.info("👋 Expense Tracker API stopped")


app = FastAPI(
    title="AI Expense Tracker",
    description="AI-powered expense tracking with OCR, smart categorisation, and natural language queries",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers.auth import router as auth_router
from routers.receipts import router as receipts_router
from routers.expenses import router as expenses_router
from routers.query import router as query_router
from routers.insights import router as insights_router

app.include_router(auth_router)
app.include_router(receipts_router)
app.include_router(expenses_router)
app.include_router(query_router)
app.include_router(insights_router)

# Serve uploaded files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
