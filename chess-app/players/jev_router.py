"""Jev router: each move, Jev picks which LLM should play it.

Jev gets the position, the legal moves, and every model your API keys can
use with its price, as one "choice" question. The chosen model then picks
the move. The move's cost is the Jev request plus the chosen model's
requests.
"""
import os

import chess

from .base import UsageMixin, describe_position
from .jev import JevPlayer
from .pricing import price_for

# Player types that can be routed to (text LLMs only).
ROUTABLE = ("claude", "openai", "grok")

INSTRUCTIONS = (
    "Pick the AI model that should choose the next chess move in this position. "
    "Balance playing strength against price: use a strong, expensive model for "
    "complex or critical positions (tactics, checks, captures, close endgames) "
    "and a cheap model for simple or forced positions."
)


class JevRouterPlayer(UsageMixin):
    label = "Jev router"
    key_env = "TYPESAFE_API_KEY"

    @staticmethod
    def list_models() -> list[dict]:
        if not os.environ.get("TYPESAFE_API_KEY"):
            raise RuntimeError("TYPESAFE_API_KEY is not set")
        return [{"id": "auto", "name": "Jev router (Jev picks a model each move)"}]

    def __init__(self, model: str | None = None):
        self.jev = JevPlayer()
        self.players: dict[str, object] = {}  # "type|model" -> player, reused across moves
        self.last_choice: str | None = None
        self.reset_usage()

    @staticmethod
    def candidates() -> dict[str, str]:
        """{"type|model": description with price} for every usable text model."""
        from . import available_models  # late import: players/__init__ imports this module

        out = {}
        for provider in available_models():
            if provider["type"] not in ROUTABLE:
                continue
            for m in provider["models"]:
                p = price_for(m["id"])
                price = (f"${p[0]:g} per 1M input tokens, ${p[1]:g} per 1M output tokens"
                         if p else "price unknown")
                out[f'{provider["type"]}|{m["id"]}'] = f'{provider["label"]} model {m["name"]}: {price}'
        return out

    def _merge(self, usage: dict):
        self.add_usage(usage["input_tokens"], usage["output_tokens"], usage["cost_usd"])
        self.usage["requests"] += usage["requests"] - 1  # add_usage counted one request

    def choose_move(self, board: chess.Board) -> chess.Move:
        from . import make_player

        self.reset_usage()
        self.last_choice = None
        criteria = self.candidates()
        if not criteria:
            raise RuntimeError("no models to route to: set ANTHROPIC_API_KEY, OPENAI_API_KEY or XAI_API_KEY")
        legal = ", ".join(board.san(m) for m in board.legal_moves)
        state = describe_position(board) + f"Legal moves: {legal}\n"
        choice, _ = self.jev.ask_choice(state, INSTRUCTIONS, criteria)
        self._merge(self.jev.usage)
        self.jev.reset_usage()
        self.last_choice = choice

        if choice not in self.players:
            kind, model = choice.split("|", 1)
            self.players[choice] = make_player({"type": kind, "model": model})
        player = self.players[choice]
        try:
            return player.choose_move(board)
        finally:
            self._merge(player.usage)  # also counts requests of a failed move
