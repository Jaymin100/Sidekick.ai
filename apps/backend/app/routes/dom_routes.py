from flask import Blueprint, current_app, request, jsonify, send_file
from uuid import uuid4
import tempfile
import os

from apps.backend.test_dom_pipeline import TestDomPipeline

dom_bp = Blueprint("dom", __name__, url_prefix="/dom")


@dom_bp.post("/upload")
def upload_dom():
    dom_content = request.data.decode("utf-8")

    if not dom_content:
        return jsonify({"error": "dom content is required"}), 400

    dom_service = current_app.config["dom_storage_service"]

    object_key = f"{uuid4()}.html"

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
    temp_file.write(dom_content.encode("utf-8"))
    temp_file.close()

    try:
        result = dom_service.upload_dom_file(
            object_key=object_key,
            file_path=temp_file.name,
        )

        try:
            parsed_content = TestDomPipeline.run(object_key)
            print(f"[PARSED DOM]\n{parsed_content}")
        except Exception as exc:
            print(f"[DOM PROCESSING ERROR] object_key={object_key} error={exc}")

        return jsonify(result), 201
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)


@dom_bp.get("/download")
def download_dom():
    object_key = request.args.get("object_key")

    if not object_key:
        return jsonify({"error": "object_key is required"}), 400

    dom_service = current_app.config["dom_storage_service"]

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
    temp_file.close()

    try:
        metadata = dom_service.download_dom_file(
            object_key=object_key,
            local_file_path=temp_file.name,
        )

        return send_file(
            temp_file.name,
            mimetype="text/plain",
            as_attachment=True,
            download_name=metadata["object_key"].split("/")[-1],
        )
    finally:
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
