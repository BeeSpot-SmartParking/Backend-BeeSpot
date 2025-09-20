from flask import Flask, request, jsonify
from detector import detect_plate

app = Flask(__name__)

@app.route("/scan", methods=["POST"])
def scan_plate():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    file_path = f"./uploads/{file.filename}"
    file.save(file_path)

    plate, score = detect_plate(file_path)
    if plate:
        return jsonify({"licensePlate": plate, "confidence": float(score)})
    else:
        return jsonify({"error": "Could not detect plate"}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
