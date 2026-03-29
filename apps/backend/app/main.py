import os
from flask import Flask
from dotenv import load_dotenv

from infra.minio.services.storage_service import StorageService
from infra.minio.services.audio_storage_service import AudioStorageService
from infra.minio.services.dom_storage_service import DomStorageService
from infra.redis.services.workflow_event_service import WorkflowEventService
from infra.redis.services.workflow_state_service import WorkflowStateService
from infra.redis.services.redis_service import RedisService

from apps.backend.app.routes.audio_routes import audio_bp
from apps.backend.app.routes.dom_routes import dom_bp
from apps.backend.app.routes.task_routes import task_bp


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__)

    minio_endpoint = os.getenv("MINIO_ENDPOINT")
    minio_access_key = os.getenv("MINIO_ROOT_USER")
    minio_secret_key = os.getenv("MINIO_ROOT_PASSWORD")
    minio_secure = os.getenv("MINIO_SECURE", "false").lower() == "true"

    redis_host = os.getenv("REDIS_HOST")
    redis_port = os.getenv("REDIS_PORT")
    redis_db = os.getenv("REDIS_DB")
    redis_decode_responses = os.getenv("REDIS_DECODE_RESPONSES")

    redis_service = RedisService(
        redis_host=redis_host,
        redis_port=redis_port,
        redis_db=redis_db,
        redis_decode_responses=redis_decode_responses
    )

    storage_service = StorageService(
        endpoint=minio_endpoint,
        access_key=minio_access_key,
        secret_key=minio_secret_key,
        secure=minio_secure,
    )

    app.config["storage_service"] = storage_service
    app.config["audio_storage_service"] = AudioStorageService(storage_service)
    app.config["dom_storage_service"] = DomStorageService(storage_service)
    app.config["workflow_event_service"] = WorkflowEventService(redis_service=redis_service)
    app.config["workflow_state_service"] = WorkflowStateService(redis_service=redis_service)
    app.config["redis_service"] = redis_service

    app.register_blueprint(audio_bp)
    app.register_blueprint(dom_bp)
    app.register_blueprint(task_bp)

    @app.get("/health")
    def health():
        return {"status": "ok"}, 200

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=True)
