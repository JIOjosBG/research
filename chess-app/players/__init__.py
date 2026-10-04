"""Player registry. Each AI player is a class with `choose_move(board) -> chess.Move`
and a `list_models()` static/class method used to fill the model dropdown.

To add a text LLM: subclass `LLMPlayer`, implement `_complete`, and register
it in PROVIDERS below. Non-text models (like Jev) just need `choose_move`.
"""
import time

from .claude import ClaudePlayer
from .jev import JevPlayer
from .jev_router import JevRouterPlayer
from .openai_compat import GrokPlayer, OpenAIPlayer

PROVIDERS = {
    "claude": ClaudePlayer,
    "openai": OpenAIPlayer,
    "grok": GrokPlayer,
    "jev": JevPlayer,
    "jev-router": JevRouterPlayer,
}

_cache: dict = {"at": 0.0, "data": None}
CACHE_SECONDS = 600


def available_models(refresh: bool = False) -> list[dict]:
    """Model list per provider, from each company's API. Cached for 10 min."""
    if not refresh and _cache["data"] and time.time() - _cache["at"] < CACHE_SECONDS:
        return _cache["data"]
    out = []
    for kind, cls in PROVIDERS.items():
        entry = {"type": kind, "label": cls.label, "models": [], "error": None}
        try:
            entry["models"] = cls.list_models()
        except Exception as e:
            entry["error"] = str(e)
        out.append(entry)
    _cache.update(at=time.time(), data=out)
    return out


def make_player(spec: dict):
    """spec: {"type": "human"} or {"type": "claude" | "openai" | "grok" | "jev" | "jev-router", "model": ...}"""
    kind = spec.get("type", "human")
    if kind == "human":
        return None
    if kind not in PROVIDERS:
        raise ValueError(f"unknown player type: {kind}")
    return PROVIDERS[kind](model=spec.get("model") or None)
