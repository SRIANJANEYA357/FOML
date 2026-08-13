import base64
import binascii
import io
import os
from pathlib import Path

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError


app = Flask(__name__)
CORS(app)

MODEL_PATH = Path(__file__).resolve().with_name("best_driver_drowsiness_model.keras")
MODEL_NAME = MODEL_PATH.name
MODEL_INPUT_SIZE = (224, 224)

# The training mapping documented with this project is:
# sigmoid probability 0.0 = Awake, 1.0 = Sleepy.
SLEEPY_CLASS_THRESHOLD = 0.5

model = None
model_load_error: str | None = None

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    app.logger.info(
        "Drowsiness model loaded: %s input=%s output=%s",
        MODEL_PATH,
        model.input_shape,
        model.output_shape,
    )
except Exception as error:  # Keep the API alive so /health reports the real failure.
    model_load_error = str(error)
    app.logger.exception("Unable to load drowsiness model from %s", MODEL_PATH)


def decode_image(image_value: object) -> np.ndarray:
    if not isinstance(image_value, str) or not image_value.strip():
        raise ValueError("The image field must be a non-empty Base64 data URL.")

    encoded = image_value.split(",", 1)[1] if "," in image_value else image_value
    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("The image is not valid Base64.") from error

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize(MODEL_INPUT_SIZE)
    image_array = np.asarray(image, dtype=np.float32) / 255.0
    return np.expand_dims(image_array, axis=0)


def model_health_payload() -> dict[str, object]:
    payload: dict[str, object] = {
        "status": "ok" if model is not None else "error",
        "model_connected": model is not None,
        "model": MODEL_NAME,
    }
    if model is not None:
        payload.update(
            {
                "input_shape": str(model.input_shape),
                "output_shape": str(model.output_shape),
            }
        )
    else:
        payload["error"] = model_load_error or "Model could not be loaded."
    return payload


@app.get("/health")
@app.get("/model-api/health")
def health():
    payload = model_health_payload()
    return jsonify(payload), 200 if model is not None else 503


@app.post("/predict")
@app.post("/model-api/predict")
def predict():
    if model is None:
        return jsonify(
            {
                "error": "Model Not Connected",
                "model_connected": False,
                "model": MODEL_NAME,
            }
        ), 503

    try:
        data = request.get_json(silent=True)
        if not data or "image" not in data:
            return jsonify({"error": "No image received", "model_connected": True}), 400

        image_array = decode_image(data["image"])
        raw_output = np.asarray(model.predict(image_array, verbose=0)).reshape(-1)
        if raw_output.size == 0 or not np.isfinite(raw_output[0]):
            raise ValueError("The model returned an empty or invalid probability.")

        probability = float(raw_output[0])
        if probability < 0 or probability > 1:
            raise ValueError("The model probability was outside the expected 0 to 1 range.")

        sleepy = probability >= SLEEPY_CLASS_THRESHOLD
        label = "Sleepy" if sleepy else "Awake"
        confidence = probability if sleepy else 1.0 - probability

        return jsonify(
            {
                "label": label,
                "confidence": round(confidence * 100, 2),
                "probability": round(probability, 6),
                "model_connected": True,
                "model": MODEL_NAME,
            }
        )
    except (ValueError, OSError, UnidentifiedImageError) as error:
        app.logger.warning("Invalid prediction input: %s", error)
        return jsonify({"error": str(error), "model_connected": True}), 400
    except Exception as error:
        app.logger.exception("Prediction error")
        return jsonify({"error": str(error), "model_connected": True}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
