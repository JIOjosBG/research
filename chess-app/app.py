import os
import uuid

import chess
from flask import Flask, jsonify, request, send_from_directory

from players import available_models, make_player

try:  # optional .env support
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

app = Flask(__name__, static_folder="static")
GAMES: dict[str, dict] = {}


def state(gid: str) -> dict:
    g = GAMES[gid]
    b: chess.Board = g["board"]
    return {
        "id": gid,
        "fen": b.fen(),
        "turn": "white" if b.turn else "black",
        "legal": [m.uci() for m in b.legal_moves],
        "history": g["san"],
        "check": b.is_check(),
        "over": b.is_game_over(),
        "result": b.result() if b.is_game_over() else None,
        "outcome": b.outcome().termination.name if b.outcome() else None,
        "players": g["specs"],
        "costs": g["costs"],
        "totals": {c: summarize([x for x in g["costs"] if x["color"] == c]) for c in ("white", "black")},
        "grand_total": summarize(g["costs"]),
        "by_model": {
            m: summarize([x for x in g["costs"] if played_by(x) == m])
            for m in dict.fromkeys(played_by(x) for x in g["costs"])
        },
    }


def played_by(entry: dict) -> str:
    """Model that chose the move (for the Jev router: Jev + the routed model)."""
    if entry["routed_to"]:
        return "Jev router → " + entry["routed_to"].split("|", 1)[1]
    return entry["model"] or entry["provider"]


def summarize(entries: list[dict]) -> dict:
    """Sum cost and tokens. `unknown_price` is true when some entry had no price,
    so `cost_usd` is then a lower bound."""
    return {
        "cost_usd": sum(x["cost_usd"] or 0 for x in entries),
        "unknown_price": any(x["cost_usd"] is None for x in entries),
        "input_tokens": sum(x["input_tokens"] for x in entries),
        "output_tokens": sum(x["output_tokens"] for x in entries),
        "requests": sum(x["requests"] for x in entries),
        "moves": len(entries),
    }


def apply(gid: str, move: chess.Move):
    g = GAMES[gid]
    g["san"].append(g["board"].san(move))
    g["board"].push(move)


def record_cost(g: dict, color: str, ply: int, player, san: str | None):
    u = getattr(player, "usage", None)
    if u and u["requests"]:
        g["costs"].append({"ply": ply, "color": color, "move": san,
                           "provider": g["specs"][color]["type"],
                           "model": getattr(player, "model", None),
                           "routed_to": getattr(player, "last_choice", None), **u})
        # Running total of the game after this move.
        g["costs"][-1]["total_so_far"] = summarize(g["costs"])["cost_usd"]


@app.get("/")
def index():
    return send_from_directory("static", "index.html")


@app.get("/api/models")
def models():
    return jsonify(available_models(refresh=request.args.get("refresh") == "1"))


@app.post("/api/new")
def new_game():
    data = request.get_json(force=True)
    specs = {"white": data.get("white", {"type": "human"}),
             "black": data.get("black", {"type": "human"})}
    try:
        players = {c: make_player(s) for c, s in specs.items()}
    except Exception as e:
        return jsonify(error=str(e)), 400
    gid = uuid.uuid4().hex[:8]
    GAMES[gid] = {"board": chess.Board(), "san": [], "players": players, "specs": specs,
                  "costs": []}
    return jsonify(state(gid))


@app.get("/api/state/<gid>")
def get_state(gid):
    if gid not in GAMES:
        return jsonify(error="no such game"), 404
    return jsonify(state(gid))


@app.post("/api/move/<gid>")
def human_move(gid):
    if gid not in GAMES:
        return jsonify(error="no such game"), 404
    g = GAMES[gid]
    color = "white" if g["board"].turn else "black"
    if g["players"][color] is not None:
        return jsonify(error=f"{color} is not human"), 400
    try:
        mv = chess.Move.from_uci(request.get_json(force=True)["uci"])
    except (ValueError, KeyError):
        return jsonify(error="bad move"), 400
    if mv not in g["board"].legal_moves:
        return jsonify(error="illegal move"), 400
    apply(gid, mv)
    return jsonify(state(gid))


@app.post("/api/ai_move/<gid>")
def ai_move(gid):
    if gid not in GAMES:
        return jsonify(error="no such game"), 404
    g = GAMES[gid]
    if g["board"].is_game_over():
        return jsonify(error="game over"), 400
    color = "white" if g["board"].turn else "black"
    player = g["players"][color]
    if player is None:
        return jsonify(error=f"{color} is human"), 400
    ply = len(g["san"])
    try:
        mv = player.choose_move(g["board"])
    except Exception as e:
        record_cost(g, color, ply, player, None)  # failed requests still cost money
        return jsonify(error=str(e)), 502
    record_cost(g, color, ply, player, g["board"].san(mv))
    apply(gid, mv)
    return jsonify(state(gid))


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5000)), debug=False)
