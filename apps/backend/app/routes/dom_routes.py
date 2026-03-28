from flask import Blueprint, current_app, request, jsonify

dom_bp = Blueprint("dom", __name__, url_prefix="/dom")


@dom_bp.post("/upload-target")
def create_dom_upload_target():
    data = request.get_json() or {}

    session_id = data.get("session_id")
    snapshot_name = data.get("snapshot_name", "page")

    if not session_id:
        return jsonify({"error": "session_id is required"}), 400

    dom_manager = current_app.config["dom_storage_manager"]
    result = dom_manager.create_upload_target(
        session_id=session_id,
        snapshot_name=snapshot_name,
    )

    return jsonify(result), 200
