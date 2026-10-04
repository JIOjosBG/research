import os
import uuid

import chess
from flask import Flask, jsonify, request, send_from_directory

from players import make_player

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
    }


def apply(gid: str, move: chess.Move):
    g = GAMES[gid]
    g["san"].append(g["board"].san(move))
    g["board"].push(move)


@app.get("/")
def index():
    return send_from_directory("static", "index.html")


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
    GAMES[gid] = {"board": chess.Board(), "san": [], "players": players, "specs": specs}
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
    try:
        mv = player.choose_move(g["board"])
    except Exception as e:
        return jsonify(error=str(e)), 502
    apply(gid, mv)
    return jsonify(state(gid))


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5000)), debug=False)
