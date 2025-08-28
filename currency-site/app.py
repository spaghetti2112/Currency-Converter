from flask import Flask, render_template, request, jsonify
from flask import send_from_directory 
import os, mimetypes
from flask import abort, make_response
import requests

app = Flask(__name__, static_folder=None, template_folder="templates")
STATIC_ROOT = os.path.join(os.path.dirname(__file__), "static")

app.config["USE_X_SENDFILE"] = False

ATTRIB_TEXT = "Exchange rates provided by ExchangeRate-API (https://www.exchangerate-api.com)"
FALLBACK_RATES = {
    "USD": 1, "EUR": 0.94, "GBP": 0.82, "INR": 82.62, "AUD": 1.43, "CAD": 1.36,
    "SGD": 1.35, "CHF": 0.91, "MYR": 4.47, "JPY": 134.08, "CNY": 6.92, "SAR": 3.75, "NZD": 1.51
}
DECIMAL_PLACES = {"JPY": 0, "INR": 0}  # default=2 if missing

def load_rates(base="USD", timeout=5):
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

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/rates", methods=["GET"])
def api_rates():
    # You can change the base here if you want to drive it from query params
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
    from_cur = data.get("from")
    to_cur   = data.get("to")

    if amount is None or from_cur is None or to_cur is None:
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
@app.route("/debug/static")
def debug_static():
    import os, pathlib, textwrap
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

@app.route("/static/<path:filename>")
def serve_static(filename):
    path = os.path.normpath(os.path.join(STATIC_ROOT, filename))
    # prevent directory traversal
    if not path.startswith(STATIC_ROOT) or not os.path.isfile(path):
        return abort(404)

    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        data = f.read()

    resp = make_response(data)
    resp.headers["Content-Type"] = mime
    resp.headers["Content-Length"] = str(len(data))  # <- forces non-zero body
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp
if __name__ == "__main__":
    app.run(debug=True)




