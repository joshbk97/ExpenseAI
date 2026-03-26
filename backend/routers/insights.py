from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from schemas import InsightResponse
from auth import get_current_user
from services.insights import generate_insights

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("", response_model=InsightResponse)
async def get_insights(
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await generate_insights(user.id, days, db)
