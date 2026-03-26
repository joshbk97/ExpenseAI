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
from sqlalchemy import select
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

        receipt.raw_text = json.dumps(structured)
        
        receipt.merchant = structured.get("merchant", "Unknown")
        receipt.total = float(structured.get("total", 0))
        receipt.currency = structured.get("currency", "AUD")
        receipt.structured_json = json.dumps(structured)

        date_str = structured.get("date")
        if date_str:
            try:
                receipt.receipt_date = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                pass

        items_data = structured.get("items", [])
        if items_data:
            logger.info(f"[Pipeline] Step 2: Categorising {len(items_data)} items for receipt {receipt_id} with LLM")
            
            # Extract just the names into a clean list for the categorisation prompt
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

        receipt.status = ReceiptStatus.COMPLETED
        await db.flush()
        logger.info(f"[Pipeline] Receipt {receipt_id} processed successfully in 2 steps")

    except Exception as e:
        logger.error(f"[Pipeline] Failed to process receipt {receipt_id}: {e}")
        receipt.status = ReceiptStatus.FAILED
        await db.flush()
        raise
