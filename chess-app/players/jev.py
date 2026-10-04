"""TypeSafe Jev player (System One decision model).

Jev returns typed decisions instead of text. We ask one "choice" question
whose criteria are the legal moves, and play the chosen move.
See jev_router.py for the player that uses Jev to pick a model instead.
"""
import json
import os
import urllib.error
import urllib.request

import chess

from .base import UsageMixin, describe_position
from .pricing import PRICES

DEFAULT_BASE_URL = "https://api.typesafe.ai"


class JevPlayer(UsageMixin):
    label = "Jev"
    key_env = "TYPESAFE_API_KEY"

    @staticmethod
    def list_models() -> list[dict]:
        if not os.environ.get("TYPESAFE_API_KEY"):
            raise RuntimeError("TYPESAFE_API_KEY is not set")
        return [{"id": os.environ.get("JEV_MODEL", "jev-latest"), "name": "Jev (latest)"}]

    def __init__(self, model: str | None = None):
        self.key = os.environ.get("TYPESAFE_API_KEY")
        if not self.key:
            raise RuntimeError("TYPESAFE_API_KEY is not set")
        self.model = model or os.environ.get("JEV_MODEL", "jev-latest")
        self.url = os.environ.get("TYPESAFE_BASE_URL", DEFAULT_BASE_URL).rstrip("/") + "/v1/systemone"
        self.input_price = PRICES["jev"][0]  # output tokens are free
        self.reset_usage()

    def _evaluate(self, body: dict) -> dict:
        req = urllib.request.Request(
            self.url,
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Jev API error {e.code}: {e.read().decode(errors='replace')[:300]}")

    def ask_choice(self, state: str, instructions: str, criteria: dict[str, str]) -> tuple[str, dict]:
        """Ask Jev one choice question. Returns (chosen key, full answer).

        Uses Jev's choice; if it is missing or not a criterion, takes the most
        probable criterion. Token usage is added to `self.usage`.
        """
        data = self._evaluate({
            "model": self.model,
            "state": state,
            "questions": {
                "pick": {"type": "choice", "instructions": instructions, "criteria": criteria}
            },
        })
        usage = data.get("usage", {})
        in_tok, out_tok = usage.get("input_tokens", 0), usage.get("output_tokens", 0)
        self.add_usage(in_tok, out_tok, in_tok * self.input_price / 1_000_000)
        answer = data.get("answers", {}).get("pick", {})
        probs = answer.get("probabilities", {})
        for key in [answer.get("choice")] + sorted(probs, key=lambda k: -probs[k]):
            if key in criteria:
                return key, answer
        raise RuntimeError(f"Jev returned no valid choice: {json.dumps(answer)[:300]}")

    def choose_move(self, board: chess.Board) -> chess.Move:
        self.reset_usage()
        criteria = {m.uci(): f"Play {board.san(m)}" for m in board.legal_moves}
        uci, _ = self.ask_choice(
            describe_position(board),
            "Pick the strongest chess move for the side to move.",
            criteria,
        )
        return chess.Move.from_uci(uci)
