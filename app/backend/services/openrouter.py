import os
import httpx
from fastapi import HTTPException
from .prompts import get_system_prompt, build_user_content

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
MODEL = "meta-llama/llama-3.3-8b-instruct:free"

async def generate_message(intent: str | None, profile_info: dict, extended_profile: dict) -> str:
    """
    Generate a LinkedIn outreach message using OpenRouter API.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenRouter API key not configured on server")

    system = get_system_prompt()
    user_content = build_user_content(intent, profile_info, extended_profile)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://salesai-backend",
                "X-Title": "Sales.ai Backend",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_content},
                ],
                "max_tokens": 320,
                "temperature": 0.85,
            },
        )

    if resp.status_code >= 400:
        try:
            text = resp.text[:300]
        except Exception:
            text = ""
        raise HTTPException(status_code=resp.status_code, detail=f"OpenRouter error: {text}")

    data = resp.json()
    content: str = ""
    try:
        choices = data.get("choices", [])
        if choices:
            msg = choices[0].get("message", {})
            c = msg.get("content")
            if isinstance(c, str):
                content = c.strip()
            elif isinstance(c, list):
                content = "".join(part if isinstance(part, str) else part.get("text", "") for part in c).strip()
    except Exception:
        content = ""

    if not content:
        raise HTTPException(status_code=502, detail="No content returned from model")

    # Normalize whitespace and strip surrounding quotes/backticks if present
    content = " ".join(content.split())
    if len(content) >= 2:
        pairs = [
            ("`", "`"),
            ("\"", "\""),
            ("'", "'"),
            ("", ""),  # alt quotes if any
            ("", ""),
            ("", ""),
        ]
        for left, right in pairs:
            if content.startswith(left) and content.endswith(right):
                content = content[len(left):-len(right)].strip()
                break
    
    return content
