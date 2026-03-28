from flask import Blueprint, current_app, request, jsonify

audio_bp = Blueprint("audio", __name__, url_prefix="/audio")


@audio_bp.post("/upload-target")
def create_audio_upload_target():
    data = request.get_json() or {}

    session_id = data.get("session_id")
    mime_type = data.get("mime_type", "audio/webm")

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    audio_manager = current_app.config["audio_storage_manager"]
    result = audio_manager.create_upload_target(
        session_id=session_id,
        mime_type=mime_type,
    )

    return jsonify(result), 200
