from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from schemas import QueryRequest, QueryResponse
from auth import get_current_user
from services.query_engine import run_nl_query

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("", response_model=QueryResponse)
async def natural_language_query(
    req: QueryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await run_nl_query(req.question, user.id, db)
    return result
