import os

from .base import SYSTEM, LLMPlayer
from .pricing import cost


def _client():
    import anthropic

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    return anthropic.Anthropic(api_key=key)


class ClaudePlayer(LLMPlayer):
    label = "Claude"
    key_env = "ANTHROPIC_API_KEY"

    def __init__(self, model: str | None = None):
        self.client = _client()
        self.model = model or os.environ.get("CHESS_CLAUDE_MODEL", "claude-opus-5-5")
        self.reset_usage()

    @staticmethod
    def list_models() -> list[dict]:
        return [{"id": m.id, "name": m.display_name} for m in _client().models.list()]

    def _complete(self, prompt: str) -> str:
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=16000,  # room for thinking tokens before the answer
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        u = resp.usage
        self.add_usage(u.input_tokens, u.output_tokens, cost(
            self.model, u.input_tokens, u.output_tokens,
            getattr(u, "cache_creation_input_tokens", 0) or 0,
            getattr(u, "cache_read_input_tokens", 0) or 0,
        ))
        return "".join(b.text for b in resp.content if b.type == "text")
