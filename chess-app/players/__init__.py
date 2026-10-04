"""Player registry. Each AI player is a class with `choose_move(board) -> chess.Move`.

To add a text LLM: subclass `LLMPlayer`, implement `_complete`, and register
it in PROVIDERS below. Non-text models (like Jev) just need `choose_move`.
"""
from .claude import ClaudePlayer
from .jev import JevPlayer

PROVIDERS = {
    "claude": ClaudePlayer,
    "jev": JevPlayer,
}


def make_player(spec: dict):
    """spec: {"type": "human"} or {"type": "claude" | "jev"[, "model": ...]}"""
    kind = spec.get("type", "human")
    if kind == "human":
        return None
    if kind not in PROVIDERS:
        raise ValueError(f"unknown player type: {kind}")
    return PROVIDERS[kind](model=spec.get("model") or None)
