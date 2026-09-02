from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from database import get_db
from models import User, Receipt, ReceiptItem, Category
from schemas import ExpenseSummary, CategorySpending, SpendingTrend
from auth import get_current_user
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("/summary", response_model=ExpenseSummary)
async def expense_summary(
    days: int = Query(30, ge=0, le=3650),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    actual_date = func.coalesce(Receipt.receipt_date, Receipt.created_at)
    conditions = [Receipt.user_id == user.id, Receipt.status == "completed"]
    if days > 0:
        cutoff = datetime.utcnow() - timedelta(days=days)
        conditions.append(actual_date >= cutoff)

    # Total spent, receipt count, min date, max date
    receipt_result = await db.execute(
        select(
            func.coalesce(func.sum(Receipt.total), 0).label("total_spent"),
            func.count(Receipt.id).label("receipt_count"),
            func.min(actual_date).label("min_date"),
            func.max(actual_date).label("max_date"),
        )
        .where(*conditions)
    )
    row = receipt_result.one()
    total_spent = float(row.total_spent)
    receipt_count = row.receipt_count

    # Period bounds: selected timeframe start (or earliest expense if all time) to now
    now = datetime.utcnow()
    if days > 0:
        period_start = now - timedelta(days=days)
    else:
        period_start = row.min_date if row.min_date else (now - timedelta(days=30))
    period_end = now

    # Item count
    item_conditions = [Receipt.user_id == user.id]
    if days > 0:
        cutoff = datetime.utcnow() - timedelta(days=days)
        item_conditions.append(actual_date >= cutoff)

    item_result = await db.execute(
        select(func.count(ReceiptItem.id))
        .join(Receipt)
        .where(*item_conditions)
    )
    item_count = item_result.scalar() or 0

    # Top merchant
    merchant_result = await db.execute(
        select(Receipt.merchant, func.sum(Receipt.total).label("s"))
        .where(*conditions)
        .group_by(Receipt.merchant)
        .order_by(func.sum(Receipt.total).desc())
        .limit(1)
    )
    merchant_row = merchant_result.first()
    top_merchant = merchant_row.merchant if merchant_row else None

    return ExpenseSummary(
        total_spent=total_spent,
        receipt_count=receipt_count,
        item_count=item_count,
        avg_receipt=total_spent / receipt_count if receipt_count > 0 else 0,
        top_merchant=top_merchant,
        period_start=period_start,
        period_end=period_end,
    )


@router.get("/by-category", response_model=list[CategorySpending])
async def spending_by_category(
    days: int = Query(30, ge=0, le=3650),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    actual_date = func.coalesce(Receipt.receipt_date, Receipt.created_at)
    conditions = [Receipt.user_id == user.id, ReceiptItem.total_price > 0]
    if days > 0:
        cutoff = datetime.utcnow() - timedelta(days=days)
        conditions.append(actual_date >= cutoff)

    result = await db.execute(
        select(
            Category.name,
            Category.icon,
            func.coalesce(func.sum(ReceiptItem.total_price), 0).label("total"),
            func.count(ReceiptItem.id).label("item_count"),
        )
        .join(ReceiptItem, ReceiptItem.category_id == Category.id)
        .join(Receipt, ReceiptItem.receipt_id == Receipt.id)
        .where(*conditions)
        .group_by(Category.name, Category.icon)
        .having(func.sum(ReceiptItem.total_price) > 0)
        .order_by(func.sum(ReceiptItem.total_price).desc())
    )
    rows = result.all()

    grand_total = sum(float(r.total) for r in rows) or 1.0
    return [
        CategorySpending(
            category_name=r.name,
            category_icon=r.icon,
            total=float(r.total),
            item_count=r.item_count,
            percentage=round(float(r.total) / grand_total * 100, 1),
        )
        for r in rows
    ]


@router.get("/trends", response_model=list[SpendingTrend])
async def spending_trends(
    days: int = Query(30, ge=0, le=3650),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    actual_date = func.coalesce(Receipt.receipt_date, Receipt.created_at)
    conditions = [Receipt.user_id == user.id, Receipt.status == "completed"]
    if days > 0:
        cutoff = datetime.utcnow() - timedelta(days=days)
        conditions.append(actual_date >= cutoff)

    day_trunc = func.date(actual_date)
    result = await db.execute(
        select(
            day_trunc.label("day"),
            func.coalesce(func.sum(Receipt.total), 0).label("total"),
            func.count(Receipt.id).label("receipt_count"),
        )
        .where(*conditions)
        .group_by(day_trunc)
        .order_by(day_trunc)
    )
    rows = result.all()
    return [
        SpendingTrend(
            date=str(r.day.date()) if hasattr(r.day, "date") else str(r.day or ""),
            total=float(r.total),
            receipt_count=r.receipt_count,
        )
        for r in rows
    ]

