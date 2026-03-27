import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from database import get_db
from models import User, Receipt, ReceiptItem, ReceiptStatus, Category
from schemas import (
    ReceiptOut,
    ReceiptDetail,
    ReceiptListResponse,
    CategoryOut,
    ReceiptItemsUpdateRequest,
    ManualReceiptCreateRequest,
)
from auth import get_current_user
from config import get_settings

router = APIRouter(prefix="/api/receipts", tags=["receipts"])
settings = get_settings()


@router.post("/upload", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type
    allowed = {"image/jpeg", "image/png", "image/webp", "image/tiff"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not supported")

    # Save file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filename = f"{user.id}_{int(__import__('time').time())}_{file.filename}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create receipt record
    receipt = Receipt(
        user_id=user.id,
        image_path=filepath,
        status=ReceiptStatus.PENDING,
    )
    db.add(receipt)
    await db.flush()
    await db.refresh(receipt)

    # Trigger async processing (import here to avoid circular)
    from services.receipt_processor import process_receipt
    try:
        await process_receipt(receipt.id, db)
    except Exception as e:
        receipt.status = ReceiptStatus.FAILED
        await db.flush()
        # Don't fail the upload request — receipt is saved with FAILED status

    return receipt


@router.post("/manual", response_model=ReceiptDetail, status_code=status.HTTP_201_CREATED)
async def create_manual_receipt(
    payload: ManualReceiptCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Postgres column is TIMESTAMP WITHOUT TIME ZONE; asyncpg rejects tz-aware datetimes.
    receipt_date = payload.receipt_date
    if receipt_date is not None and receipt_date.tzinfo is not None:
        receipt_date = receipt_date.replace(tzinfo=None)

    category_ids = {item.category_id for item in payload.items if item.category_id is not None}
    if category_ids:
        categories_result = await db.execute(select(Category.id).where(Category.id.in_(category_ids)))
        valid_category_ids = set(categories_result.scalars().all())
        if valid_category_ids != category_ids:
            raise HTTPException(status_code=400, detail="Invalid category selected")

    receipt_total = sum(item.quantity * item.unit_price for item in payload.items)
    receipt = Receipt(
        user_id=user.id,
        merchant=payload.merchant.strip() or "Unknown",
        total=receipt_total,
        currency="AUD",
        receipt_date=receipt_date,
        raw_text="",
        structured_json="{}",
        image_path="",
        status=ReceiptStatus.COMPLETED,
    )
    db.add(receipt)
    await db.flush()

    for item in payload.items:
        db.add(
            ReceiptItem(
                receipt_id=receipt.id,
                name=item.name.strip(),
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item.quantity * item.unit_price,
                category_id=item.category_id,
                category_confidence=1.0 if item.category_id else 0.0,
            )
        )

    await db.flush()
    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.category))
        .where(Receipt.id == receipt.id, Receipt.user_id == user.id)
    )
    return result.scalar_one()


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    merchant: str = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Receipt).where(Receipt.user_id == user.id)
    count_query = select(func.count(Receipt.id)).where(Receipt.user_id == user.id)

    if status_filter:
        query = query.where(Receipt.status == status_filter)
        count_query = count_query.where(Receipt.status == status_filter)
    if merchant:
        query = query.where(Receipt.merchant.ilike(f"%{merchant}%"))
        count_query = count_query.where(Receipt.merchant.ilike(f"%{merchant}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(desc(Receipt.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    receipts = result.scalars().all()

    return ReceiptListResponse(receipts=receipts, total=total, page=page, page_size=page_size)


@router.get("/{receipt_id}", response_model=ReceiptDetail)
async def get_receipt(
    receipt_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.category))
        .where(Receipt.id == receipt_id, Receipt.user_id == user.id)
    )
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.get("/categories/list", response_model=list[CategoryOut])
async def list_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _ = user
    result = await db.execute(select(Category).order_by(Category.name.asc()))
    return result.scalars().all()


@router.put("/{receipt_id}/items", response_model=ReceiptDetail)
async def update_receipt_items(
    receipt_id: int,
    payload: ReceiptItemsUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    receipt_result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.category))
        .where(Receipt.id == receipt_id, Receipt.user_id == user.id)
    )
    receipt = receipt_result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    payload_ids = {item.id for item in payload.items if item.id is not None}
    existing_items = {item.id: item for item in receipt.items}
    if not payload_ids.issubset(existing_items.keys()):
        raise HTTPException(status_code=400, detail="One or more items do not belong to this receipt")

    if payload.deleted_item_ids:
        invalid_delete_ids = set(payload.deleted_item_ids) - set(existing_items.keys())
        if invalid_delete_ids:
            raise HTTPException(status_code=400, detail="One or more deleted items do not belong to this receipt")
        for delete_id in payload.deleted_item_ids:
            await db.delete(existing_items[delete_id])

    existing_items_after_delete = {item.id: item for item in receipt.items if item.id not in set(payload.deleted_item_ids)}
    category_ids = {item.category_id for item in payload.items if item.category_id is not None}
    valid_category_ids = set()
    if category_ids:
        categories_result = await db.execute(select(Category.id).where(Category.id.in_(category_ids)))
        valid_category_ids = set(categories_result.scalars().all())
        if valid_category_ids != category_ids:
            raise HTTPException(status_code=400, detail="Invalid category selected")

    for item_update in payload.items:
        if item_update.id is None:
            new_item = ReceiptItem(
                receipt_id=receipt.id,
                name=item_update.name.strip(),
                quantity=item_update.quantity,
                unit_price=item_update.unit_price,
                total_price=item_update.unit_price * item_update.quantity,
                category_id=item_update.category_id,
            )
            db.add(new_item)
            continue

        item = existing_items_after_delete[item_update.id]
        item.name = item_update.name.strip()
        item.quantity = item_update.quantity
        item.unit_price = item_update.unit_price
        item.category_id = item_update.category_id
        item.total_price = item.unit_price * item.quantity

    await db.flush()
    total_result = await db.execute(
        select(func.coalesce(func.sum(ReceiptItem.total_price), 0)).where(ReceiptItem.receipt_id == receipt.id)
    )
    receipt.total = float(total_result.scalar() or 0)
    await db.flush()

    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.category))
        .where(Receipt.id == receipt_id, Receipt.user_id == user.id)
    )
    return result.scalar_one()


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_receipt(
    receipt_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Receipt).where(Receipt.id == receipt_id, Receipt.user_id == user.id)
    )
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    # Remove uploaded file
    if receipt.image_path and os.path.exists(receipt.image_path):
        os.remove(receipt.image_path)

    await db.delete(receipt)
