from flask import Flask, render_template, request, jsonify, abort, make_response
import os
import mimetypes
import requests

# -------------------------------------------------------------------
# App setup
# -------------------------------------------------------------------
# Disable Flask's built-in static handler; we’ll serve static ourselves.
app = Flask(__name__, static_folder=None, template_folder="templates")
app.config["USE_X_SENDFILE"] = False  # avoid proxy sendfile quirks that can yield 200/0

# Absolute path to ./static
STATIC_ROOT = os.path.join(os.path.dirname(__file__), "static")

# Version token for cache-busting in templates (bump on each deploy)
@app.context_processor
def inject_static_ver():
    return {"STATIC_VER": os.getenv("STATIC_VER", "2025-08-28-2")}

# Robust static route: sends literal bytes with explicit Content-Length
@app.route("/static/<path:filename>")
def serve_static(filename):
    # Resolve and prevent directory traversal
    candidate = os.path.normpath(os.path.join(STATIC_ROOT, filename))
    root_real = os.path.realpath(STATIC_ROOT)
    path_real = os.path.realpath(candidate)
    if not path_real.startswith(root_real) or not os.path.isfile(path_real):
        return abort(404)

    mime = mimetypes.guess_type(path_real)[0] or "application/octet-stream"
    with open(path_real, "rb") as f:
        data = f.read()

    resp = make_response(data)
    resp.headers["Content-Type"] = mime
    resp.headers["Content-Length"] = str(len(data))
    # Temporary: force no-cache to bypass any stale proxy cache
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

# -------------------------------------------------------------------
# App constants / helpers
# -------------------------------------------------------------------
ATTRIB_TEXT = "Exchange rates provided by ExchangeRate-API (https://www.exchangerate-api.com)"
FALLBACK_RATES = {
    "USD": 1, "EUR": 0.94, "GBP": 0.82, "INR": 82.62, "AUD": 1.43, "CAD": 1.36,
    "SGD": 1.35, "CHF": 0.91, "MYR": 4.47, "JPY": 134.08, "CNY": 6.92, "SAR": 3.75, "NZD": 1.51
}
DECIMAL_PLACES = {"JPY": 0, "INR": 0}  # default=2 for others

def load_rates(base="USD", timeout=5):
    """Fetch live rates; fallback quickly on error/timeouts."""
    try:
        url = f"https://api.exchangerate-api.com/v4/latest/{base}"
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        return data["rates"], True
    except requests.exceptions.RequestException:
        return FALLBACK_RATES.copy(), False

def format_amount(amount, currency):
    places = DECIMAL_PLACES.get(currency, 2)
    return f"{amount:,.{places}f}"

# -------------------------------------------------------------------
# Routes
# -------------------------------------------------------------------
@app.route("/")
def index():
    # In templates/index.html, reference static like:
    # <link rel="stylesheet" href="{{ url_for('serve_static', filename='styles.css') }}?v={{ STATIC_VER }}">
    # <script defer src="{{ url_for('serve_static', filename='app.js') }}?v={{ STATIC_VER }}"></script>
    return render_template("index.html")

@app.route("/api/rates", methods=["GET"])
def api_rates():
    rates, live = load_rates("USD")
    return jsonify({
        "base": "USD",
        "rates": rates,
        "live": live,
        "attribution": ATTRIB_TEXT
    })

@app.route("/api/convert", methods=["POST"])
def api_convert():
    data = request.get_json(force=True)
    amount = data.get("amount")
    from_cur = (data.get("from") or "").strip().upper()
    to_cur   = (data.get("to") or "").strip().upper()

    if amount is None or not from_cur or not to_cur:
        return jsonify({"error": "Missing amount/from/to"}), 400

    try:
        # sanitize/parse amount (keep digits, dot, minus)
        s = str(amount).strip().replace(",", "")
        cleaned = "".join(ch for ch in s if ch.isdigit() or ch in ".-")
        amt = float(cleaned)
        if amt <= 0:
            return jsonify({"error": "Amount must be positive"}), 400
    except ValueError:
        return jsonify({"error": "Invalid amount"}), 400

    rates, _ = load_rates("USD")
    if from_cur not in rates or to_cur not in rates:
        return jsonify({"error": "Unsupported currency"}), 400

    amount_in_usd = amt / rates[from_cur]
    converted = amount_in_usd * rates[to_cur]
    places = DECIMAL_PLACES.get(to_cur, 2)
    converted = round(converted, places)

    return jsonify({
        "from": from_cur,
        "to": to_cur,
        "amount": amt,
        "result": converted,
        "formatted_from": f"{format_amount(amt, from_cur)} {from_cur}",
        "formatted_result": f"{format_amount(converted, to_cur)} {to_cur}"
    })

# Simple debug endpoint to verify static files exist/sizes in deploy
@app.route("/debug/static")
def debug_static():
    import pathlib, textwrap
    out = []
    for path in ["static/app.js", "static/styles.css"]:
        p = pathlib.Path(path)
        if p.exists():
            size = p.stat().st_size
            head = p.read_bytes()[:100]
            out.append(f"{path}: {size} bytes\n{head!r}\n")
        else:
            out.append(f"{path}: MISSING\n")
    return "<pre>" + textwrap.dedent("\n".join(out)) + "</pre>"

# -------------------------------------------------------------------
# Local dev entrypoint (Render uses gunicorn app:app)
# -------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=True)
