import asyncio
from PIL import Image
from services.llm import call_llm_json
from services.receipt_processor import VISION_EXTRACTION_PROMPT, CATEGORISE_PROMPT
import traceback
import sys
import json

async def main():
    try:
        image_path = r"uploads\1_1774283303_WhatsApp Image 2026-03-24 at 01.46.49.jpeg"
        print(f"Step 1: Vision parsing on {image_path}...")
        
        image = Image.open(image_path)
        
        structured = await call_llm_json(
            system=VISION_EXTRACTION_PROMPT,
            user_content=[
                image,
                "Extract all data from this receipt strictly following the schema."
            ]
        )
        
        print("\nSTRUCTURED RESULT:")
        print(json.dumps(structured, indent=2))
        
        items = structured.get("items", [])
        if items:
            print("\nStep 2: Categorizing Items...")
            item_names = [item.get("name") for item in items]
            
            categories = await call_llm_json(
                system=CATEGORISE_PROMPT,
                user_content=f"Items to categorise strictly into allowed categories:\n{json.dumps(item_names, indent=2)}"
            )
            print("\nCATEGORIES:")
            print(json.dumps(categories, indent=2))
            
    except Exception as e:
        print("EXCEPTION CAUGHT:")
        traceback.print_exc(file=sys.stdout)

if __name__ == "__main__":
    asyncio.run(main())
