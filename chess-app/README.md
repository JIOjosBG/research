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
Optional: `CHESS_CLAUDE_MODEL` (default `claude-sonnet-5-5`), `JEV_MODEL`
(default `jev-latest`), `TYPESAFE_BASE_URL` (default `https://api.typesafe.ai`).

## How Jev plays
Jev does not write text. The app sends the position as `state` and asks one
`choice` question whose `criteria` are the legal moves
(`POST /v1/systemone`). The app plays Jev's `choice`, or the most probable
legal move if the choice is missing.

## Add another provider
Subclass `LLMPlayer` (`players/base.py`), implement `_complete(prompt) -> str`,
register it in `players/__init__.py`, and add an `<option>` in `static/index.html`.
The LLM must return a legal UCI move; illegal replies are retried 3 times.
