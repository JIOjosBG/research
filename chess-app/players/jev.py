"""TypeSafe Jev player (System One decision model).

Jev returns typed decisions instead of text. We ask one "choice" question
whose criteria are the legal moves, and play the chosen move.
"""
import json
import os
import urllib.error
import urllib.request

import chess

from .base import UsageMixin, describe_position

DEFAULT_BASE_URL = "https://api.typesafe.ai"
# USD per 1M input tokens; output tokens are free (TypeSafe list price).
DEFAULT_INPUT_PRICE = 0.04


class JevPlayer(UsageMixin):
    def __init__(self, model: str | None = None):
        self.key = os.environ.get("TYPESAFE_API_KEY")
        if not self.key:
            raise RuntimeError("TYPESAFE_API_KEY is not set")
        self.model = model or os.environ.get("JEV_MODEL", "jev-latest")
        self.url = os.environ.get("TYPESAFE_BASE_URL", DEFAULT_BASE_URL).rstrip("/") + "/v1/systemone"
        self.input_price = float(os.environ.get("JEV_INPUT_PRICE_PER_MTOK", DEFAULT_INPUT_PRICE))
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

    def choose_move(self, board: chess.Board) -> chess.Move:
        self.reset_usage()
        criteria = {m.uci(): f"Play {board.san(m)}" for m in board.legal_moves}
        data = self._evaluate({
            "model": self.model,
            "state": describe_position(board),
            "questions": {
                "move": {
                    "type": "choice",
                    "instructions": "Pick the strongest chess move for the side to move.",
                    "criteria": criteria,
                }
            },
        })
        usage = data.get("usage", {})
        in_tok, out_tok = usage.get("input_tokens", 0), usage.get("output_tokens", 0)
        self.add_usage(in_tok, out_tok, in_tok * self.input_price / 1_000_000)
        answer = data.get("answers", {}).get("move", {})
        # Use the chosen move; if missing or illegal, take the most probable legal one.
        ranked = [answer.get("choice")] + sorted(
            answer.get("probabilities", {}), key=lambda k: -answer["probabilities"][k]
        )
        for uci in ranked:
            if uci in criteria:
                return chess.Move.from_uci(uci)
        raise RuntimeError(f"Jev returned no legal move: {json.dumps(answer)[:300]}")
