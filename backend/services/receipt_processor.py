"""
Receipt processing pipeline:
1. Multimodal LLM structuring (Gemini Vision)
2. Text-only categorisation (Gemini Text)
→ DB save.
"""
import json
import logging
from datetime import datetime
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import Receipt, ReceiptItem, Category, ReceiptStatus
from services.llm import call_llm_json

logger = logging.getLogger(__name__)

VISION_EXTRACTION_PROMPT = """You are an advanced receipt processing AI. Analyze the provided receipt image and extract the structured data.

Return a JSON object with EXACTLY this schema:
{
  "merchant": "Store name",
  "date": "YYYY-MM-DD" or null,
  "currency": "AUD",
  "items": [
    {
      "name": "Original item name EXACTLY as written on receipt",
      "quantity": 1.0,
      "unit_price": 5.99,
      "total_price": 5.99
    }
  ],
  "subtotal": 0.0,
  "tax": 0.0,
  "total": 0.0
}

Rules:
- Extract ALL line items visible on the receipt
- If quantity is not clear, default to 1
- total_price = quantity * unit_price
- Currency should be a 3-letter ISO code
- If date is not visible, use null
- Return ONLY valid JSON, no explanations or markdown parsing"""

VISION_EXTRACTION_RETRY_PROMPT = """You are an advanced receipt processing AI. Re-check the same receipt image and produce corrected structured data.

Return a JSON object with EXACTLY this schema:
{
  "merchant": "Store name",
  "date": "YYYY-MM-DD" or null,
  "currency": "AUD",
  "items": [
    {
      "name": "Original item name EXACTLY as written on receipt",
      "quantity": 1.0,
      "unit_price": 5.99,
      "total_price": 5.99
    }
  ],
  "subtotal": 0.0,
  "tax": 0.0,
  "total": 0.0
}

Rules (important):
- You MUST account for the receipt's final "total" by ensuring that sum(items.total_price) matches "total" within a few cents.
- Extract ALL bill lines that affect the final total.
- If the receipt shows discounts, vouchers, coupons, or staff/team discounts, include them as line items with negative total_price (and negative unit_price). Keep quantity positive.
- If the receipt shows tax (GST/VAT) as a separate line, include it as a line item so the totals can reconcile.
- If "total" is clearly present on the receipt, treat it as authoritative.
- total_price = quantity * unit_price (after applying any sign changes for discounts).
- Return ONLY valid JSON, no explanations or markdown parsing"""

CATEGORISE_PROMPT = """You are an expert expense categoriser. For each item in the list, assign the single MOST appropriate category from the exact allowed list below.

Allowed Categories: Groceries, Dining, Transport, Utilities, Entertainment, Shopping, Health, Education, Travel, Subscriptions, Office, Personal Care, Home, Other

Return a JSON array where each element matches the input items exactly:
[
  {
    "item_name": "Original item name",
    "category": "Exact Category Name from the allowed list above",
    "confidence": 0.95
  }
]

Rules:
- You MUST only use categories from the Allowed Categories list.
- confidence should be between 0 and 1, reflecting how certain you are.
- Return ONLY valid JSON, no explanations."""

async def process_receipt(receipt_id: int, db: AsyncSession) -> None:
    """Full processing pipeline for a receipt using Gemini Vision in a two-step process."""
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalar_one_or_none()
    if not receipt:
        logger.error(f"Receipt {receipt_id} not found")
        return

    receipt.status = ReceiptStatus.PROCESSING
    await db.flush()

    try:
        logger.info(f"[Pipeline] Step 1: Extracting receipt {receipt_id} text and structure with Gemini Vision")
        
        image = Image.open(receipt.image_path)
        
        structured = await call_llm_json(
            system=VISION_EXTRACTION_PROMPT,
            user_content=[
                image,
                "Extract all data from this receipt image strictly following the schema."
            ]
        )

        if not structured:
            receipt.status = ReceiptStatus.FAILED
            await db.flush()
            return

        def _to_float(value, default=0.0) -> float:
            try:
                return float(value)
            except (TypeError, ValueError):
                return default

        def _sum_line_items_to_cents(items: list[dict]) -> tuple[float, int]:
            sum_cents = 0
            for item in items:
                qty = _to_float(item.get("quantity", 1), default=1.0)
                unit_price = _to_float(item.get("unit_price", 0), default=0.0)
                if item.get("total_price") is not None:
                    line_total = _to_float(item.get("total_price"), default=qty * unit_price)
                else:
                    line_total = qty * unit_price
                # Sum in cents to avoid float drift
                sum_cents += int(round(line_total * 100))
            sum_line_total = round(sum_cents / 100.0, 2)
            return sum_line_total, sum_cents

        # In-memory sanity check (before saving) so we can retry OCR if needed.
        extracted_total = float(structured.get("total", 0) or 0)
        items_data = structured.get("items", []) or []
        sum_line_total, sum_line_total_cents = _sum_line_items_to_cents(items_data)
        extracted_total_cents = int(round(extracted_total * 100))
        diff_cents = abs(extracted_total_cents - sum_line_total_cents)
        tolerance_cents = max(2, int(round(abs(extracted_total_cents) * 0.005)))  # 0.5% of extracted total, min 2c

        # If totals don't reconcile, re-run Gemini with instructions for discounts/vouchers/tax.
        if diff_cents > tolerance_cents or (not items_data and extracted_total_cents != 0):
            logger.warning(
                "Receipt %s totals mismatch after first Gemini: extracted total=%s (%dc) vs sum(line items)=%s (%dc), diff=%dc; retrying extraction",
                receipt_id,
                extracted_total,
                extracted_total_cents,
                sum_line_total,
                sum_line_total_cents,
                diff_cents,
            )
            structured_retry = await call_llm_json(
                system=VISION_EXTRACTION_RETRY_PROMPT,
                user_content=[
                    image,
                    "Re-extract and ensure totals reconcile; include discounts/vouchers/staff discounts and tax lines as needed."
                ]
            )
            if structured_retry:
                structured = structured_retry
                extracted_total = float(structured.get("total", 0) or 0)
                items_data = structured.get("items", []) or []

        # Persist final extracted/possibly retried structured data.
        receipt.raw_text = json.dumps(structured)
        receipt.merchant = structured.get("merchant", "Unknown")
        receipt.total = extracted_total
        receipt.currency = structured.get("currency", "AUD")
        receipt.structured_json = json.dumps(structured)

        date_str = structured.get("date")
        if date_str:
            try:
                receipt.receipt_date = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                pass

        if items_data:
            logger.info(f"[Pipeline] Step 2: Categorising {len(items_data)} items for receipt {receipt_id} with LLM")

            item_names = [item.get("name", "Unknown Item") for item in items_data]
            
            categories_result = await call_llm_json(
                system=CATEGORISE_PROMPT,
                user_content=f"Items to categorise strictly into allowed categories:\n{json.dumps(item_names, indent=2)}"
            )

            # Build category lookup from DB
            cat_result = await db.execute(select(Category))
            all_categories = {c.name.lower(): c for c in cat_result.scalars().all()}

            # Map results from categorisation response
            cat_map = {}
            if isinstance(categories_result, list):
                for cat_entry in categories_result:
                    cat_map[cat_entry.get("item_name", "").lower()] = cat_entry

            # Create ReceiptItem records by combining extracted items and their new categories
            for item_data in items_data:
                item_name = item_data.get("name", "Unknown").strip()
                cat_info = cat_map.get(item_name.lower(), {})
                cat_name = cat_info.get("category", "Other").lower()
                confidence = float(cat_info.get("confidence", 0.5))
                
                # Default to 'other' if category somehow doesn't match standard list
                category = all_categories.get(cat_name)

                db_item = ReceiptItem(
                    receipt_id=receipt.id,
                    category_id=category.id if category else (all_categories.get("other").id if "other" in all_categories else None),
                    name=item_name,
                    quantity=float(item_data.get("quantity", 1)),
                    unit_price=float(item_data.get("unit_price", 0)),
                    total_price=float(item_data.get("total_price", 0)),
                    category_confidence=confidence,
                )
                db.add(db_item)
            await db.flush()

            # Post-(possibly retried) sanity check: warn if totals still don't reconcile.
            sum_result = await db.execute(
                select(func.coalesce(func.sum(ReceiptItem.total_price), 0)).where(ReceiptItem.receipt_id == receipt.id)
            )
            sum_line_total = float(sum_result.scalar() or 0)
            sum_line_total = round(sum_line_total, 2)

            extracted_total_cents = int(round(extracted_total * 100))
            sum_line_total_cents = int(round(sum_line_total * 100))
            diff_cents = abs(extracted_total_cents - sum_line_total_cents)
            tolerance_cents = max(2, int(round(abs(extracted_total_cents) * 0.005)))  # 0.5% of extracted total, min 2c

            if diff_cents > tolerance_cents:
                logger.warning(
                    "Receipt %s totals mismatch after Gemini: extracted total=%s (%dc) vs sum(line items)=%s (%dc), diff=%dc",
                    receipt_id,
                    extracted_total,
                    extracted_total_cents,
                    sum_line_total,
                    sum_line_total_cents,
                    diff_cents,
                )

        receipt.status = ReceiptStatus.COMPLETED
        await db.flush()
        logger.info(f"[Pipeline] Receipt {receipt_id} processed successfully in 2 steps")

    except Exception as e:
        logger.error(f"[Pipeline] Failed to process receipt {receipt_id}: {e}")
        receipt.status = ReceiptStatus.FAILED
        await db.flush()
        raise
