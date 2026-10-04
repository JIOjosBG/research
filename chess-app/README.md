# Chess

Flask chess app. Each side can be a **human** (click to move) or an **LLM**.
Currently implemented LLM provider: **Claude** (Anthropic API).

## Run
```
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...   # add your key later
.venv/bin/python app.py               # http://localhost:5000
```
Optional: `CHESS_CLAUDE_MODEL` (default `claude-sonnet-5-5`).

## Add another provider
Subclass `LLMPlayer` (`players/base.py`), implement `_complete(prompt) -> str`,
register it in `players/__init__.py`, and add an `<option>` in `static/index.html`.
The LLM must return a legal UCI move; illegal replies are retried 3 times.
