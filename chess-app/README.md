# Chess

Flask chess app. Each side can be a **human** (click to move) or an AI model:

| Company | Player | API key variable |
|---|---|---|
| Anthropic | Claude (every model your key can use) | `ANTHROPIC_API_KEY` |
| OpenAI | ChatGPT (every GPT / o-series chat model your key can use) | `OPENAI_API_KEY` |
| xAI | Grok (every Grok text model your key can use) | `XAI_API_KEY` |
| TypeSafe | Jev (System One decision model) | `TYPESAFE_API_KEY` |

The White and Black lists load the models live from each company's API, so
new models appear without code changes. A company without a key shows
"…_API_KEY is not set". Click **Refresh model lists** after you add a key
(the list is cached for 10 minutes).

Pawn promotion opens a picker (queen, rook, bishop, knight); click outside it
to cancel.

## Run
```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export ANTHROPIC_API_KEY=...   # set only the keys you have
export OPENAI_API_KEY=...
export XAI_API_KEY=...
export TYPESAFE_API_KEY=...
.venv/bin/python app.py        # http://localhost:5000
```
Optional: `CHESS_CLAUDE_MODEL` (default when no model is given:
`claude-opus-5-5`), `JEV_MODEL` (default `jev-latest`), and base URL
overrides `OPENAI_BASE_URL`, `XAI_BASE_URL`, `TYPESAFE_BASE_URL`.

## How the text models play
Claude, ChatGPT and Grok get the position (FEN, move history, legal moves)
and must answer with one legal move in UCI notation. An illegal answer is
retried up to 3 times. ChatGPT and Grok use the Responses API
(`POST /v1/responses`); Claude uses the Messages API.

## API cost
Each AI move shows its token counts and an estimated cost in USD in the
side panel (per move and per side). The app calculates it from the token
counts that each API returns and the list prices in `players/pricing.py`.
Edit that table when prices change; a model that is not in it shows "n/a".
Retries and failed moves are included. The real billed amount is in each
company's console.

## How Jev plays
Jev does not write text. The app sends the position as `state` and asks one
`choice` question whose `criteria` are the legal moves
(`POST /v1/systemone`). The app plays Jev's `choice`, or the most probable
legal move if the choice is missing.

## Add another company
Subclass `LLMPlayer` (`players/base.py`), implement `_complete(prompt) -> str`
and `list_models()`, then register it in `PROVIDERS` in `players/__init__.py`.
An OpenAI-compatible API only needs a small subclass of `OpenAICompatPlayer`
(see `GrokPlayer` in `players/openai_compat.py`).
