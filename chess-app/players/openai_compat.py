"""ChatGPT (OpenAI) and Grok (xAI) players.

Both companies serve the same Responses API (POST /v1/responses) and model
list (GET /v1/models), so one class covers both with a different base URL.
"""
import json
import os
import re
import urllib.error
import urllib.request

from .base import SYSTEM, LLMPlayer
from .pricing import cost


class OpenAICompatPlayer(LLMPlayer):
    label = ""
    key_env = ""
    base_url_env = ""
    default_base_url = ""

    def __init__(self, model: str | None = None):
        if not model:
            raise RuntimeError(f"pick a {self.label} model")
        self.model = model
        self.reset_usage()

    @classmethod
    def _request(cls, path: str, body: dict | None = None) -> dict:
        key = os.environ.get(cls.key_env)
        if not key:
            raise RuntimeError(f"{cls.key_env} is not set")
        base = os.environ.get(cls.base_url_env, cls.default_base_url).rstrip("/")
        req = urllib.request.Request(
            base + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            method="POST" if body is not None else "GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{cls.label} API error {e.code}: {e.read().decode(errors='replace')[:300]}")

    @classmethod
    def is_chat_model(cls, model_id: str) -> bool:
        return True

    @classmethod
    def list_models(cls) -> list[dict]:
        ids = [m["id"] for m in cls._request("/models").get("data", [])]
        return [{"id": i, "name": i} for i in sorted(ids, reverse=True) if cls.is_chat_model(i)]

    def _complete(self, prompt: str) -> str:
        data = self._request("/responses", {
            "model": self.model,
            "instructions": SYSTEM,
            "input": prompt,
        })
        u = data.get("usage") or {}
        in_tok, out_tok = u.get("input_tokens", 0), u.get("output_tokens", 0)
        cached = (u.get("input_tokens_details") or {}).get("cached_tokens", 0) or 0
        # input_tokens includes cached tokens; bill those at the cache rate.
        self.add_usage(in_tok, out_tok, cost(self.model, in_tok - cached, out_tok, cache_read=cached))
        return "".join(
            c.get("text", "")
            for item in data.get("output", []) if item.get("type") == "message"
            for c in item.get("content", []) if c.get("type") == "output_text"
        )


class OpenAIPlayer(OpenAICompatPlayer):
    label = "ChatGPT"
    key_env = "OPENAI_API_KEY"
    base_url_env = "OPENAI_BASE_URL"
    default_base_url = "https://api.openai.com/v1"

    # /v1/models also lists embedding, audio, image and other non-chat models.
    _skip = re.compile(r"audio|realtime|tts|transcribe|image|embedding|moderation|"
                       r"search|instruct|dall-e|whisper|davinci|babbage|computer-use")

    @classmethod
    def is_chat_model(cls, model_id: str) -> bool:
        return bool(re.match(r"(gpt-|chatgpt-|o\d)", model_id)) and not cls._skip.search(model_id)


class GrokPlayer(OpenAICompatPlayer):
    label = "Grok"
    key_env = "XAI_API_KEY"
    base_url_env = "XAI_BASE_URL"
    default_base_url = "https://api.x.ai/v1"

    @classmethod
    def is_chat_model(cls, model_id: str) -> bool:
        return model_id.startswith("grok") and not re.search(r"image|video|imagine", model_id)
