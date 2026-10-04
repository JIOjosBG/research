# Chess

Flask chess app. Each side can be a **human** (click to move) or an AI model:

| Company | Player | API key variable |
|---|---|---|
| Anthropic | Claude (every model your key can use) | `ANTHROPIC_API_KEY` |
| OpenAI | ChatGPT (every GPT / o-series chat model your key can use) | `OPENAI_API_KEY` |
| xAI | Grok (every Grok text model your key can use) | `XAI_API_KEY` |
| TypeSafe | Jev (System One decision model) | `TYPESAFE_API_KEY` |
| TypeSafe + others | Jev router (Jev picks which model plays each move) | `TYPESAFE_API_KEY` + at least one LLM key |

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

## How the Jev router plays
Each move, the app asks Jev one `choice` question. The `state` holds the
position and the legal moves; the `criteria` are all Claude, ChatGPT and Grok
models your keys can use, each with its price from `players/pricing.py`. Jev
is told to use strong, expensive models for critical positions and cheap
models for simple ones. The chosen model then picks the move. The cost panel
shows which model played each move (`→ model`), and the move's cost includes
the Jev request plus the chosen model's requests.

## API cost
Every API call returns the tokens it used (Claude, ChatGPT and Grok return
input and output tokens; Jev returns its usage too), so the app knows each
move's cost from the public prices. The side panel shows each AI move's
tokens and cost, the **total cost so far** after every move, and totals per
side. When the game ends, a summary shows the total cost of the game with a
breakdown per model. A total marked "≥" is a lower bound, because some
model has no price in the table. The app calculates it from the token
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
