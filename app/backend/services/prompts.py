def get_system_prompt() -> str:
    """
    Return the system prompt used for LinkedIn outreach message generation.
    
    Edit this function to adjust tone, constraints, and behavior.
    """
    return (
        "Write one LinkedIn outreach message (180–300 characters), friendly and specific."
        " Use ONLY provided data; do not assume facts about sender or recipient."
        " Prioritize the most impressive/relevant achievement or experience (from experiences, awards, or recent posts)."
        " If numbers or measurable outcomes are present, include one."
        " Avoid salesy language, emojis, hashtags, bullet points, or placeholders."
        " If a first name is present, use it; otherwise omit."
        " End with a low‑friction question that proposes a concrete next step (e.g., a quick 10–15 min chat next week, or permission to share a 2‑line idea)."
        " Do NOT ask open‑ended questions that put the burden on them (e.g., 'What would you like to discuss?' or 'What works for you?')."
        " Output plain text only (no surrounding quotes or code blocks)."
    )

def build_user_payload(intent: str | None, profile_info: dict, extended_profile: dict) -> dict:
    """
    Return a safe, compact payload used to construct the user message to the model.
    Only include fields that are safe to reference and avoid assumptions.
    """
    return {
        "instruction": (
            "Generate one friendly, personalized LinkedIn message (180–300 chars). Use ONLY facts below; if unknown, omit."
            " Highlight the most impressive/relevant achievement or experience (or recent post) and weave one concrete detail."
            " Prefer measurable outcomes if present. If the intent provides a specific CTA, use it; otherwise propose a concrete, low‑friction next step (e.g., 10–15 min chat next week or permission to send a 2‑line idea)."
            " Avoid open‑ended questions like 'What would you like to discuss?'. Do not wrap the message in quotes."
        ),
        "intent": (intent or "Polite intro with value and a soft ask to connect"),
        "profile": {
            "profileInfo": profile_info,
            "extendedProfile": extended_profile,
        },
    }

def build_user_content(intent: str | None, profile_info: dict, extended_profile: dict) -> str:
    """
    Return the final user content string sent to the chat API.
    """
    import json
    payload = build_user_payload(intent, profile_info, extended_profile)
    return (
        "Please generate a concise, friendly, highly personalized LinkedIn message based on the following JSON.\n"
        + json.dumps(payload, separators=(",", ":"))
    )
