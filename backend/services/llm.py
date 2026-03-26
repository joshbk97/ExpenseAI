"""
Shared Gemini LLM client wrapper.
"""
import json
import logging
import google.generativeai as genai
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

genai.configure(api_key=settings.GEMINI_API_KEY)


async def call_llm(
    system: str,
    user_content,
    model: str = None,
    temperature: float = 0.2,
    max_tokens: int = 2000,
) -> str:
    """Call Gemini chat completions. user_content can be a string or list of content blocks."""
    model_name = model or settings.GEMINI_MODEL

    gemini_model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system,
        generation_config=genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
    )

    contents = [user_content] if isinstance(user_content, str) else user_content

    response = await gemini_model.generate_content_async(contents)
    return response.text.strip()


async def call_llm_json(
    system: str,
    user_content: str,
    model: str = None,
    temperature: float = 0.1,
) -> dict:
    """Call LLM and parse response as JSON."""
    model_name = model or settings.GEMINI_MODEL

    gemini_model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system,
        generation_config=genai.types.GenerationConfig(
            temperature=temperature,
            response_mime_type="application/json",
        )
    )

    contents = [user_content] if isinstance(user_content, str) else user_content
    response = await gemini_model.generate_content_async(contents)
    raw = response.text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        raw = "\n".join(lines)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM JSON response: {raw[:200]}")
        return {}
