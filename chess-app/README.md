# Chess

Flask chess app. Each side can be a **human** (click to move) or an **LLM**.
Each side can be a **human** (click to move), **Claude** (Anthropic API), or
**Jev** (TypeSafe's System One decision model). Pawn promotion opens a picker
(queen, rook, bishop, knight); click outside it to cancel.

## Run
```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...   # for Claude players
export TYPESAFE_API_KEY=...           # for Jev players
.venv/bin/python app.py               # http://localhost:5000
```
Optional: `CHESS_CLAUDE_MODEL` (default `claude-opus-5-5`), `JEV_MODEL`
(default `jev-latest`), `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`).

## API cost
Each AI move shows its token counts and an estimated cost in USD in the
side panel (per move and per side). The app calculates it from the token
counts that each API returns and the list prices in `players/claude.py`
(`PRICES`) and `players/jev.py` (`JEV_INPUT_PRICE_PER_MTOK`, default $0.04 per
1M input tokens; output is free). Retries and failed moves are included.
The real billed amount is in the Anthropic Console and the TypeSafe console.

## How Jev plays
Jev does not write text. The app sends the position as `state` and asks one
`choice` question whose `criteria` are the legal moves
(`POST /v1/systemone`). The app plays Jev's `choice`, or the most probable
legal move if the choice is missing.

## Add another provider
Subclass `LLMPlayer` (`players/base.py`), implement `_complete(prompt) -> str`,
register it in `players/__init__.py`, and add an `<option>` in `static/index.html`.
The LLM must return a legal UCI move; illegal replies are retried 3 times.
