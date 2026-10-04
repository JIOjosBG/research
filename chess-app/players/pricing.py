"""List prices in USD per 1M tokens: model id -> (input, output).

Prices change often. Edit this table to match each company's pricing page.
A key also matches dated snapshots (e.g. "gpt-5.4" matches "gpt-5.4-2026-03-05").
Models not in the table show cost "n/a".
"""

PRICES = {
    # Anthropic (thinking tokens are billed as output)
    "claude-fable-5-1": (10.00, 50.00),
    "claude-fable-5": (10.00, 50.00),
    "claude-opus-5-5": (4.00, 20.00),
    "claude-opus-5": (5.00, 25.00),
    "claude-opus-4-8": (5.00, 25.00),
    "claude-opus-4-7": (5.00, 25.00),
    "claude-opus-4-6": (5.00, 25.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-sonnet-5": (2.00, 10.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    # OpenAI (reasoning tokens are billed as output)
    "gpt-6-astra": (10.00, 50.00),
    "gpt-5.6-sol": (4.00, 20.00),
    "gpt-5.6-terra": (2.00, 12.00),
    "gpt-5.6-luna": (0.20, 1.20),
    "gpt-5.5": (5.00, 30.00),
    "gpt-5.4": (2.50, 15.00),
    # xAI
    "grok-4.7": (2.00, 6.00),
    "grok-4.6": (2.00, 6.00),
    "grok-4.5": (2.00, 6.00),
    "grok-4.3": (1.25, 2.50),
    "grok-4.20": (1.25, 2.50),
    # TypeSafe (output tokens are free)
    "jev": (0.04, 0.00),
}


def price_for(model: str):
    best = None
    for key in PRICES:
        if model == key or model.startswith(key + "-"):
            if best is None or len(key) > len(best):
                best = key
    return PRICES.get(best)


def cost(model: str, input_tokens: int, output_tokens: int,
         cache_write: int = 0, cache_read: int = 0) -> float | None:
    p = price_for(model)
    if p is None:
        return None
    p_in, p_out = p
    return (input_tokens * p_in + cache_write * p_in * 1.25
            + cache_read * p_in * 0.1 + output_tokens * p_out) / 1_000_000
