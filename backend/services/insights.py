"""
AI-generated spending insights service.
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import Receipt, ReceiptItem, Category
from services.llm import call_llm
from schemas import InsightResponse

logger = logging.getLogger(__name__)

INSIGHTS_PROMPT = """You are a personal finance advisor AI. Based on the user's spending data, generate 4-6 actionable insights.

Each insight should be:
- Specific and data-backed (reference actual numbers)
- Actionable with a clear suggestion
- Written in a friendly, conversational tone
- 1-2 sentences each

Focus on: spending patterns, unusual expenses, savings opportunities, category trends, comparisons to previous periods.

Return ONLY a JSON array of strings, each string being one insight. Example:
["Your grocery spending of $450 this month is 15% higher than usual — consider meal planning to reduce costs.", "You spent $0 on entertainment, which is great for savings but remember to budget for fun!"]"""


async def generate_insights(user_id: int, days: int, db: AsyncSession) -> InsightResponse:
    """Generate AI-powered spending insights."""
    actual_date = func.coalesce(Receipt.receipt_date, Receipt.created_at)
    conditions = [Receipt.user_id == user_id, Receipt.status == "completed"]
    cat_conditions = [Receipt.user_id == user_id, ReceiptItem.total_price > 0]
    if days > 0:
        cutoff = datetime.utcnow() - timedelta(days=days)
        conditions.append(actual_date >= cutoff)
        cat_conditions.append(actual_date >= cutoff)

    # Gather spending data
    receipt_result = await db.execute(
        select(
            func.coalesce(func.sum(Receipt.total), 0).label("total_spent"),
            func.count(Receipt.id).label("receipt_count"),
            func.coalesce(func.avg(Receipt.total), 0).label("avg_receipt"),
        )
        .where(*conditions)
    )
    summary = receipt_result.one()

    # Category breakdown
    cat_result = await db.execute(
        select(Category.name, func.sum(ReceiptItem.total_price).label("total"))
        .join(ReceiptItem, ReceiptItem.category_id == Category.id)
        .join(Receipt, ReceiptItem.receipt_id == Receipt.id)
        .where(*cat_conditions)
        .group_by(Category.name)
        .order_by(func.sum(ReceiptItem.total_price).desc())
    )
    categories = [{"name": r.name, "total": round(float(r.total), 2)} for r in cat_result.all()]

    # Top merchants
    merchant_result = await db.execute(
        select(Receipt.merchant, func.sum(Receipt.total).label("total"), func.count(Receipt.id).label("visits"))
        .where(*conditions)
        .group_by(Receipt.merchant)
        .order_by(func.sum(Receipt.total).desc())
        .limit(5)
    )
    merchants = [{"name": r.merchant, "total": round(float(r.total), 2), "visits": r.visits} for r in merchant_result.all()]

    data_summary = {
        "period_days": days,
        "total_spent": round(float(summary.total_spent), 2),
        "receipt_count": summary.receipt_count,
        "avg_receipt": round(float(summary.avg_receipt), 2),
        "categories": categories,
        "top_merchants": merchants,
    }

    # Guard: no data
    if summary.receipt_count == 0:
        return InsightResponse(
            insights=["You haven't uploaded any receipts yet! Start by uploading a receipt to get personalised spending insights."],
            generated_at=datetime.utcnow(),
            data_summary=data_summary,
        )

    # Generate insights via LLM
    from services.llm import call_llm_json
    import json

    insights_raw = await call_llm_json(
        system=INSIGHTS_PROMPT,
        user_content=f"Spending data for the last {days} days:\n{json.dumps(data_summary, indent=2)}",
    )

    insights = insights_raw if isinstance(insights_raw, list) else [str(insights_raw)]

    return InsightResponse(
        insights=insights,
        generated_at=datetime.utcnow(),
        data_summary=data_summary,
    )
