import os
from flask import Flask
from dotenv import load_dotenv

from infra.minio.services.storage_service import StorageService
from infra.minio.services.audio_storage_service import AudioStorageService
from infra.minio.services.dom_storage_service import DomStorageService

from apps.backend.app.routes.audio_routes import audio_bp
from apps.backend.app.routes.dom_routes import dom_bp


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__)

    minio_endpoint = os.getenv("MINIO_ENDPOINT")
    minio_access_key = os.getenv("MINIO_ROOT_USER")
    minio_secret_key = os.getenv("MINIO_ROOT_PASSWORD")
    minio_secure = os.getenv("MINIO_SECURE", "false").lower() == "true"

    storage_service = StorageService(
        endpoint=minio_endpoint,
        access_key=minio_access_key,
        secret_key=minio_secret_key,
        secure=minio_secure,
    )

    app.config["storage_service"] = storage_service
    app.config["audio_storage_service"] = AudioStorageService(storage_service)
    app.config["dom_storage_service"] = DomStorageService(storage_service)

    app.register_blueprint(audio_bp)
    app.register_blueprint(dom_bp)

    @app.get("/health")
    def health():
        return {"status": "ok"}, 200

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=True)
