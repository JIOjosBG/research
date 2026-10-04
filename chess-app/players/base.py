import chess

SYSTEM = (
    "You are a strong chess player. You are given the current position and the "
    "list of legal moves. Reply with exactly one move from the legal list, in UCI "
    "notation (e.g. e2e4, g1f3, e7e8q), on the last line, with no other text after it."
)


def describe_position(board: chess.Board) -> str:
    color = "White" if board.turn == chess.WHITE else "Black"
    history = []
    replay = chess.Board()
    for mv in board.move_stack:
        history.append(replay.san(mv))
        replay.push(mv)
    pgn = " ".join(
        f"{i // 2 + 1}.{m}" if i % 2 == 0 else m for i, m in enumerate(history)
    )
    return f"You play {color}.\nFEN: {board.fen()}\nMoves so far: {pgn or '(none)'}\n"


def build_prompt(board: chess.Board, feedback: str | None = None) -> str:
    legal = " ".join(m.uci() for m in board.legal_moves)
    text = describe_position(board) + f"Legal moves (UCI): {legal}\n"
    if feedback:
        text += f"\nYour previous answer was rejected: {feedback}\n"
    return text + "\nYour move (UCI):"


def parse_move(board: chess.Board, text: str) -> chess.Move:
    """Take the last token that is a legal UCI or SAN move."""
    for token in reversed(text.replace(",", " ").split()):
        token = token.strip(".`*()")
        try:
            mv = chess.Move.from_uci(token)
            if mv in board.legal_moves:
                return mv
        except ValueError:
            pass
        try:
            return board.parse_san(token)
        except ValueError:
            continue
    raise ValueError(f"no legal move found in reply: {text[:200]!r}")


class UsageMixin:
    """Tracks token usage and estimated cost (USD) of the most recent move.

    `self.usage` is reset at the start of each move, so it also covers
    retries and moves that end in an error.
    """

    def reset_usage(self):
        self.usage = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "requests": 0}

    def add_usage(self, input_tokens: int, output_tokens: int, cost_usd: float | None):
        u = self.usage
        u["input_tokens"] += input_tokens
        u["output_tokens"] += output_tokens
        u["requests"] += 1
        if cost_usd is None or u["cost_usd"] is None:
            u["cost_usd"] = None  # price unknown for this model
        else:
            u["cost_usd"] += cost_usd


class LLMPlayer(UsageMixin):
    max_attempts = 3

    def _complete(self, prompt: str) -> str:
        """Return the model's reply text and call `add_usage` for the request."""
        raise NotImplementedError

    def choose_move(self, board: chess.Board) -> chess.Move:
        self.reset_usage()
        feedback = None
        for _ in range(self.max_attempts):
            reply = self._complete(build_prompt(board, feedback))
            try:
                return parse_move(board, reply)
            except ValueError as e:
                feedback = str(e)
        raise RuntimeError(f"LLM failed to produce a legal move: {feedback}")
