import base64
import hashlib
import hmac
import json
import os
import re
import time
from datetime import datetime, timezone
from functools import wraps

import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify, g
from flask_session import Session
from icecream import ic

app = Flask(__name__)

# ─── FLASK-SESSION CONFIG ─────────────────────────────────────────────────────
# Server-side filesystem sessions. Available alongside JWT for any route
# that prefers session[] over Bearer tokens.
app.config["SECRET_KEY"]        = os.environ.get("SECRET_KEY", "flask-session-secret-change-in-production")
app.config["SESSION_TYPE"]      = "filesystem"
app.config["SESSION_PERMANENT"] = False
Session(app)

# ─── OTHER CONFIG ─────────────────────────────────────────────────────────────
JWT_SECRET = os.environ.get("JWT_SECRET", "travel-app-secret-change-in-production")

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "traveldb")
DB_USER = os.environ.get("DB_USER", "traveluser")
DB_PASS = os.environ.get("DB_PASS", "travelpass")

ic.configureOutput(prefix="[travel-api] ")

# ─── CORS ─────────────────────────────────────────────────────────────────────

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@app.route("/", defaults={"path": ""}, methods=["OPTIONS"])
@app.route("/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    return jsonify({}), 200

# ─── DATABASE ─────────────────────────────────────────────────────────────────

def get_db():
    if "db" not in g:
        ic("Opening DB connection")
        g.db = psycopg2.connect(
            host=DB_HOST, port=DB_PORT,
            dbname=DB_NAME, user=DB_USER, password=DB_PASS,
        )
    return g.db

@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def query(sql, params=(), one=False, returning=False):
    """Execute a parameterised query on the request-scoped connection."""
    conn = get_db()
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        if returning:
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
        if cur.description:
            rows = cur.fetchall()
            conn.commit()
            return dict(rows[0]) if (one and rows) else [dict(r) for r in rows]
        conn.commit()
        return None

def init_db():
    """Create tables if they don't exist. Called once at startup."""
    ic("Initialising database schema")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER, password=DB_PASS,
    )
    with conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            SERIAL PRIMARY KEY,
                    username      TEXT UNIQUE NOT NULL,
                    email         TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS destinations (
                    id          SERIAL PRIMARY KEY,
                    user_id     INTEGER NOT NULL REFERENCES users(id),
                    title       TEXT NOT NULL,
                    description TEXT,
                    location    TEXT,
                    country     TEXT,
                    date_from   DATE,
                    date_to     DATE,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
    conn.close()
    ic("Database tables ready")

# ─── JWT (pure stdlib — no third-party JWT library) ──────────────────────────
#
#  HS256 JWT: base64url(header) . base64url(payload) . base64url(HMAC-SHA256)
#  Implemented with Python's built-in hmac, hashlib, and base64 only.

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)          # restore stripped padding
    return base64.urlsafe_b64decode(s)

def create_token(user_id: int, username: str) -> str:
    header  = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(json.dumps({
        "sub":      user_id,
        "username": username,
        "iat":      int(time.time()),
        "exp":      int(time.time()) + 86400,   # 24 h
    }).encode())
    signing_input = f"{header}.{payload}"
    sig = _b64url_encode(
        hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    )
    return f"{signing_input}.{sig}"

def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises ValueError on any failure."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token")
    header_part, payload_part, sig_part = parts
    signing_input = f"{header_part}.{payload_part}"
    expected_sig = _b64url_encode(
        hmac.new(JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(expected_sig, sig_part):
        raise ValueError("Invalid token signature")
    payload = json.loads(_b64url_decode(payload_part))
    if payload.get("exp", 0) < int(time.time()):
        raise ValueError("Token expired")
    return payload

# ─── AUTH DECORATORS ──────────────────────────────────────────────────────────

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        try:
            payload = decode_token(auth_header.split(" ", 1)[1])
            g.current_user_id = payload["sub"]
            g.current_username = payload["username"]
            ic(g.current_username, g.current_user_id)
        except ValueError as e:
            msg = "Token expired" if "expired" in str(e) else "Invalid token"
            ic(str(e))
            return jsonify({"error": msg}), 401
        return f(*args, **kwargs)
    return decorated

def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        g.current_user_id = None
        g.current_username = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_token(auth_header.split(" ", 1)[1])
                g.current_user_id = payload["sub"]
                g.current_username = payload["username"]
            except ValueError:
                pass
        return f(*args, **kwargs)
    return decorated

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_password(password), hashed)

def validate_date(date_str: str) -> bool:
    if not date_str:
        return True
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False

def serialize(row: dict) -> dict:
    """Make psycopg2 RealDictRow values JSON-serialisable."""
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        elif hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

def _validate_destination_fields(data: dict) -> dict:
    errors = {}
    title     = (data.get("title") or "").strip()
    date_from = (data.get("date_from") or "").strip()
    date_to   = (data.get("date_to") or "").strip()
    if not title:
        errors["title"] = "Title is required"
    elif len(title) > 200:
        errors["title"] = "Title must be at most 200 characters"
    if date_from and not validate_date(date_from):
        errors["date_from"] = "Invalid date format (use YYYY-MM-DD)"
    if date_to and not validate_date(date_to):
        errors["date_to"] = "Invalid date format (use YYYY-MM-DD)"
    if date_from and date_to and date_from > date_to:
        errors["date_to"] = "End date must be on or after start date"
    return errors

# ─── AUTH ROUTES ──────────────────────────────────────────────────────────────

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    ic(username)

    errors = {}
    if not username:
        errors["username"] = "Username is required"
    elif len(username) < 3:
        errors["username"] = "Username must be at least 3 characters"
    elif len(username) > 50:
        errors["username"] = "Username must be at most 50 characters"
    if not email:
        errors["email"] = "Email is required"
    elif not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        errors["email"] = "Invalid email address"
    if not password:
        errors["password"] = "Password is required"
    elif len(password) < 6:
        errors["password"] = "Password must be at least 6 characters"

    if errors:
        ic(errors)
        return jsonify({"error": "Validation failed", "fields": errors}), 422

    existing = query(
        "SELECT id FROM users WHERE username = %s OR email = %s",
        (username, email), one=True,
    )
    if existing:
        return jsonify({"error": "Username or email already exists"}), 409

    row = query(
        "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id",
        (username, email, hash_password(password)), returning=True,
    )
    ic(row["id"], username)
    token = create_token(row["id"], username)
    return jsonify({"token": token, "username": username, "user_id": row["id"]}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    ic(username)

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 422

    user = query("SELECT * FROM users WHERE username = %s", (username,), one=True)
    if not user or not verify_password(password, user["password_hash"]):
        ic(f"Failed login for {username}")
        return jsonify({"error": "Invalid username or password"}), 401

    ic(user["id"])
    token = create_token(user["id"], user["username"])
    return jsonify({"token": token, "username": user["username"], "user_id": user["id"]}), 200


@app.route("/api/auth/me", methods=["GET"])
@token_required
def me():
    user = query(
        "SELECT id, username, email, created_at FROM users WHERE id = %s",
        (g.current_user_id,), one=True,
    )
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(serialize(user)), 200

# ─── DESTINATION ROUTES ───────────────────────────────────────────────────────

@app.route("/api/destinations", methods=["GET"])
@optional_auth
def list_destinations():
    ic("list_destinations")
    rows = query("""
        SELECT d.*, u.username AS author
        FROM destinations d
        JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC
    """)
    return jsonify([serialize(r) for r in rows]), 200


@app.route("/api/destinations/<int:dest_id>", methods=["GET"])
@optional_auth
def get_destination(dest_id):
    ic(dest_id)
    row = query("""
        SELECT d.*, u.username AS author
        FROM destinations d
        JOIN users u ON d.user_id = u.id
        WHERE d.id = %s
    """, (dest_id,), one=True)
    if not row:
        return jsonify({"error": "Destination not found"}), 404
    return jsonify(serialize(row)), 200


@app.route("/api/destinations", methods=["POST"])
@token_required
def create_destination():
    data   = request.get_json(silent=True) or {}
    errors = _validate_destination_fields(data)
    if errors:
        ic(errors)
        return jsonify({"error": "Validation failed", "fields": errors}), 422

    row = query("""
        INSERT INTO destinations
          (user_id, title, description, location, country, date_from, date_to)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        g.current_user_id,
        data.get("title", "").strip(),
        data.get("description", "").strip() or None,
        data.get("location", "").strip() or None,
        data.get("country", "").strip() or None,
        data.get("date_from") or None,
        data.get("date_to") or None,
    ), returning=True)

    ic(row["id"], g.current_user_id)
    dest = query("""
        SELECT d.*, u.username AS author FROM destinations d
        JOIN users u ON d.user_id = u.id WHERE d.id = %s
    """, (row["id"],), one=True)
    return jsonify(serialize(dest)), 201


@app.route("/api/destinations/<int:dest_id>", methods=["PUT"])
@token_required
def update_destination(dest_id):
    existing = query("SELECT * FROM destinations WHERE id = %s", (dest_id,), one=True)
    if not existing:
        return jsonify({"error": "Destination not found"}), 404
    if existing["user_id"] != g.current_user_id:
        ic(dest_id, g.current_user_id, "forbidden")
        return jsonify({"error": "Forbidden: you do not own this destination"}), 403

    data   = request.get_json(silent=True) or {}
    errors = _validate_destination_fields(data)
    if errors:
        ic(errors)
        return jsonify({"error": "Validation failed", "fields": errors}), 422

    query("""
        UPDATE destinations SET
          title=%s, description=%s, location=%s, country=%s,
          date_from=%s, date_to=%s, updated_at=NOW()
        WHERE id=%s
    """, (
        data.get("title", "").strip(),
        data.get("description", "").strip() or None,
        data.get("location", "").strip() or None,
        data.get("country", "").strip() or None,
        data.get("date_from") or None,
        data.get("date_to") or None,
        dest_id,
    ))

    ic(dest_id, "updated")
    dest = query("""
        SELECT d.*, u.username AS author FROM destinations d
        JOIN users u ON d.user_id = u.id WHERE d.id = %s
    """, (dest_id,), one=True)
    return jsonify(serialize(dest)), 200


@app.route("/api/destinations/<int:dest_id>", methods=["DELETE"])
@token_required
def delete_destination(dest_id):
    existing = query("SELECT * FROM destinations WHERE id = %s", (dest_id,), one=True)
    if not existing:
        return jsonify({"error": "Destination not found"}), 404
    if existing["user_id"] != g.current_user_id:
        ic(dest_id, g.current_user_id, "forbidden")
        return jsonify({"error": "Forbidden: you do not own this destination"}), 403

    query("DELETE FROM destinations WHERE id = %s", (dest_id,))
    ic(dest_id, "deleted")
    return jsonify({"message": "Destination deleted successfully"}), 200

# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}), 200

# ─── ENTRYPOINT ───────────────────────────────────────────────────────────────
# init_db() is called at module load time so it runs whether the app is started
# via `flask run` (Dockerfile CMD) or `python3 app.py` (local dev).

with app.app_context():
    init_db()

if __name__ == "__main__":
    ic("Travel Destinations API starting on port 5000")
    app.run(debug=True, port=5000)
