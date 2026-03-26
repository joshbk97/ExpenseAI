"""
OCR service using Tesseract for receipt text extraction.
Falls back to a basic placeholder if Tesseract is not installed.
"""
import logging

logger = logging.getLogger(__name__)


async def extract_text_from_image(image_path: str) -> str:
    """Extract text from a receipt image using Tesseract OCR."""
    try:
        import pytesseract
        from PIL import Image
        import os

        tess_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(tess_path):
            pytesseract.pytesseract.tesseract_cmd = tess_path

        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        logger.info(f"[ENGINE: TESSERACT] Extracted {len(text)} characters from {image_path}")
        return text.strip()
    except ImportError:
        logger.warning("pytesseract not installed — using LLM vision fallback")
        return await _vision_fallback(image_path)
    except Exception as e:
        logger.error(f"OCR failed for {image_path}: {e}")
        return await _vision_fallback(image_path)


async def _vision_fallback(image_path: str) -> str:
    """Use Gemini Vision API as OCR fallback."""
    from PIL import Image
    from services.llm import call_llm
    from config import get_settings

    settings = get_settings()

    image = Image.open(image_path)

    result = str(await call_llm(
        system="You are an OCR system. Extract ALL text visible in this receipt image. Return only the raw text, preserving layout as much as possible.",
        user_content=[
            image,
            "Extract all text from this receipt image.",
        ],
        model=settings.GEMINI_MODEL_MINI
    ))
    logger.info(f"[ENGINE: GEMINI VISION] Extracted {len(result)} characters from {image_path}")
    return result
