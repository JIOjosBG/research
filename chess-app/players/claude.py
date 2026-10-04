import os

from .base import SYSTEM, LLMPlayer


class ClaudePlayer(LLMPlayer):
    def __init__(self, model: str | None = None):
        import anthropic

        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        self.client = anthropic.Anthropic(api_key=key)
        self.model = model or os.environ.get("CHESS_CLAUDE_MODEL", "claude-sonnet-5-5")

    def _complete(self, prompt: str) -> str:
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in resp.content if b.type == "text")
