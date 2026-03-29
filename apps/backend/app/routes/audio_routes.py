from flask import Blueprint, current_app, request, jsonify, send_file
import tempfile
import os
from uuid import uuid4

audio_bp = Blueprint("audio", __name__, url_prefix="/audio")

@audio_bp.post("/upload")
def upload_audio():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "file is required"}), 400

    audio_service = current_app.config["audio_storage_service"]

    mime_type = file.mimetype or "application/octet-stream"
    extension = audio_service._extension_from_mime(mime_type)

    object_key = f"{uuid4()}.{extension}"

    result = audio_service.upload_audio(
        object_key=object_key,
        file_storage=file,
        mime_type=mime_type,
    )

    return jsonify(result), 201

@audio_bp.get("/download")
def download_audio():
    object_key = request.args.get("object_key")

    if not object_key:
        return jsonify({"error": "object_key is required"}), 400

    audio_service = current_app.config["audio_storage_service"]

    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.close()

    try:
        metadata = audio_service.download_audio(
            object_key=object_key,
            local_file_path=temp_file.name,
        )

        return send_file(
            temp_file.name,
            mimetype=metadata["mime_type"],
            as_attachment=True,
            download_name=metadata["filename"],
        )
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
