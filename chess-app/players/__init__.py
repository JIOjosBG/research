"""Player registry. Each AI player is a class with `choose_move(board) -> chess.Move`.

To add another LLM provider: subclass `LLMPlayer` in a new module,
implement `_complete`, and register it in PROVIDERS below.
"""
from .claude import ClaudePlayer

PROVIDERS = {
    "claude": ClaudePlayer,
}


def make_player(spec: dict):
    """spec: {"type": "human"} or {"type": "claude"[, "model": ...]}"""
    kind = spec.get("type", "human")
    if kind == "human":
        return None
    if kind not in PROVIDERS:
        raise ValueError(f"unknown player type: {kind}")
    return PROVIDERS[kind](model=spec.get("model") or None)
