import os
import time
from groq import AsyncGroq

client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))

FALLBACK_REPLY = "I am having trouble processing that right now. Please try again."

# ── Model selection ───────────────────────────────────────────────────────────
# Groq retires models over time; a hardcoded name that disappears makes every
# AI call fail. Callers ask for a *tier* (or pass a legacy model name, which is
# mapped to a tier), and we resolve it against the models Groq actually serves.
#
#   GROQ_MODEL       → preferred "chat" model (patient conversation)
#   GROQ_FAST_MODEL  → preferred "fast" model (extraction, classification)
#
# If the preferred model is missing or decommissioned, we fall through the
# preference list below, then any available general-purpose text model.

CHAT_PREFERENCE = [
    os.environ.get("GROQ_MODEL", ""),
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
]
FAST_PREFERENCE = [
    os.environ.get("GROQ_FAST_MODEL", ""),
    "llama-3.1-8b-instant",
    "openai/gpt-oss-20b",
    "llama-3.3-70b-versatile",
]
LEGACY_TIER = {
    "llama-3.1-8b-instant": "fast",
    "llama-3.3-70b-versatile": "chat",
}
NON_TEXT_HINTS = ("whisper", "tts", "guard", "playai", "distil", "embed", "vision")

_available = {"ids": None, "fetched_at": 0.0}
_MODEL_CACHE_SECONDS = 30 * 60


async def _available_models() -> list:
    """Model ids Groq currently serves (cached; empty list if lookup fails)."""
    now = time.time()
    if _available["ids"] is not None and now - _available["fetched_at"] < _MODEL_CACHE_SECONDS:
        return _available["ids"]
    try:
        page = await client.models.list()
        ids = [m.id for m in page.data if getattr(m, "active", True) is not False]
        _available.update(ids=ids, fetched_at=now)
        print(f"Groq models available: {', '.join(sorted(ids))}")
    except Exception as e:
        print(f"Groq model list unavailable ({type(e).__name__}: {e}); using preference order as-is")
        _available.update(ids=[], fetched_at=now)
    return _available["ids"]


async def _candidates(model: str = None) -> list:
    """Ordered, de-duplicated list of models to try for this request."""
    tier = LEGACY_TIER.get(model or "", None) or ("chat" if not model else None)
    if tier == "fast":
        wanted = FAST_PREFERENCE
    elif tier == "chat":
        wanted = CHAT_PREFERENCE
    else:
        wanted = [model] + CHAT_PREFERENCE  # explicit, non-legacy model name

    wanted = [m for m in dict.fromkeys(wanted) if m]
    available = await _available_models()
    if not available:
        return wanted

    ordered = [m for m in wanted if m in available]
    extras = [
        m for m in available
        if m not in ordered and not any(h in m.lower() for h in NON_TEXT_HINTS)
    ]
    return ordered + extras


def _is_model_problem(err: Exception) -> bool:
    """True when the failure is about the model itself, so another may work."""
    text = str(err).lower()
    status = getattr(err, "status_code", None)
    return status == 404 or any(
        k in text for k in ("decommissioned", "model_not_found", "does not exist", "not supported", "no longer")
    )


async def _complete(messages: list, model: str, max_tokens: int, temperature: float) -> str:
    last_error = None
    for candidate in (await _candidates(model))[:4]:
        try:
            kwargs = dict(model=candidate, messages=messages, max_tokens=max_tokens, temperature=temperature)
            if candidate.startswith("openai/gpt-oss"):
                # Reasoning models spend tokens thinking; keep it brief so the
                # visible answer isn't truncated to nothing.
                kwargs["extra_body"] = {"reasoning_effort": "low"}
            response = await client.chat.completions.create(**kwargs)
            content = (response.choices[0].message.content or "").strip()
            if content:
                return content
            last_error = RuntimeError(f"{candidate} returned an empty reply")
            print(f"Groq: {last_error}; trying next model")
        except Exception as e:
            last_error = e
            print(f"Groq error on {candidate}: {type(e).__name__}: {e}")
            if not _is_model_problem(e):
                break  # auth, rate limit, network: another model won't help
            _available["ids"] = None  # model list is stale; refresh next time
    print(f"Groq: all attempts failed ({type(last_error).__name__ if last_error else 'no candidates'})")
    return FALLBACK_REPLY


async def ask_gemini(prompt: str, system_context: str = "", model: str = None) -> str:
    """
    Drop-in replacement for the original ask_gemini.
    Used by triage_agent and medscan_agent.
    Sends a single prompt and returns the AI response.
    """
    messages = []
    if system_context:
        messages.append({"role": "system", "content": system_context})
    messages.append({"role": "user", "content": prompt})
    return await _complete(messages, model, max_tokens=2000, temperature=0.2)


async def ask_gemini_with_history(messages: list, system_context: str = "", model: str = None) -> str:
    """
    Drop-in replacement for the original ask_gemini_with_history.
    Used by the orchestrator to maintain conversation context.

    Accepts Gemini-style messages:
    [{"role": "user", "parts": ["..."]}, {"role": "model", "parts": ["..."]}]
    Converts them to Groq/OpenAI format automatically.
    """
    groq_messages = []
    if system_context:
        groq_messages.append({"role": "system", "content": system_context})

    for msg in messages:
        # Convert Gemini "model" role to "assistant", keep "user" as is
        role = "assistant" if msg["role"] == "model" else msg["role"]
        # Gemini uses "parts" list, Groq uses "content" string
        content = msg["parts"][0] if isinstance(msg.get("parts"), list) else msg.get("content", "")
        groq_messages.append({"role": role, "content": content})

    return await _complete(groq_messages, model, max_tokens=600, temperature=0.3)
