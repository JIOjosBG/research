import os

from .base import SYSTEM, LLMPlayer

# USD per 1M tokens (input, output), Anthropic list prices. Thinking tokens
# are billed as output. Update this table when prices change.
PRICES = {
    "claude-fable-5-1": (10.00, 50.00),
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-4-5": (1.00, 5.00),
}


class ClaudePlayer(LLMPlayer):
    def __init__(self, model: str | None = None):
        import anthropic

        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        self.client = anthropic.Anthropic(api_key=key)
        self.model = model or os.environ.get("CHESS_CLAUDE_MODEL", "claude-opus-5-5")
        self.reset_usage()

    def _cost(self, u) -> float | None:
        if self.model not in PRICES:
            return None
        p_in, p_out = PRICES[self.model]
        cache_write = getattr(u, "cache_creation_input_tokens", 0) or 0
        cache_read = getattr(u, "cache_read_input_tokens", 0) or 0
        return (
            u.input_tokens * p_in
            + cache_write * p_in * 1.25
            + cache_read * p_in * 0.1
            + u.output_tokens * p_out
        ) / 1_000_000

    def _complete(self, prompt: str) -> str:
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=16000,  # room for thinking tokens before the answer
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        u = resp.usage
        self.add_usage(u.input_tokens, u.output_tokens, self._cost(u))
        return "".join(b.text for b in resp.content if b.type == "text")
