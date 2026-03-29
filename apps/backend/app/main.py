import os

from flask import Flask
from dotenv import load_dotenv

from langchain_anthropic import ChatAnthropic
from elevenlabs.client import ElevenLabs

from infra.minio.services.storage_service import StorageService
from infra.minio.services.audio_storage_service import AudioStorageService
from infra.minio.services.dom_storage_service import DomStorageService
from infra.redis.services.workflow_event_service import WorkflowEventService
from infra.redis.services.workflow_state_service import WorkflowStateService
from infra.redis.services.redis_service import RedisService

from apps.backend.app.routes.audio_routes import audio_bp
from apps.backend.app.routes.dom_routes import dom_bp
from apps.backend.app.routes.task_routes import task_bp

from apps.backend.services.stt.elevenlabs_stt_service import ElevenLabsSTTService
from apps.backend.services.tts.elevenlabs_tts_service import ElevenLabsTTSService
from apps.backend.core.audio.converters.ffmpeg import FfmpegConverter
from apps.backend.services.search.serpapi.google_ai_mode.client import GoogleAiModeClient

from apps.backend.pipelines.generate_steps.workflow import GenerateStepsWorkflow
from apps.backend.orchestrators.generate_steps_orchestrator import GenerateStepsOrchestrator


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

    elevenlabs_client = ElevenLabs(
        api_key=os.getenv("ELEVENLABS_API_KEY")
    )

    llm = ChatAnthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        model="claude-haiku-4-5-20251001",
        temperature=0,
    )

    stt_service = ElevenLabsSTTService(
        client=elevenlabs_client,
        model_id="scribe_v2",
    )

    tts_service = ElevenLabsTTSService(
        client=elevenlabs_client,
        voice_id="JBFqnCBsd6RMkjVDRZzb", 
        model_id="eleven_v3",
        output_format="wav_16000",
    )

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

    audio_storage_service = AudioStorageService(storage_service)
    dom_storage_service = DomStorageService(storage_service)
    workflow_event_service = WorkflowEventService(redis_service=redis_service)
    workflow_state_service = WorkflowStateService(redis_service=redis_service)

    generate_steps_workflow = GenerateStepsWorkflow(
        llm=llm,
        audio_storage_service=audio_storage_service,
        ffmpeg_converter=FfmpegConverter,
        stt_service=stt_service,
        web_search_client=GoogleAiModeClient(
            api_key=os.getenv("SERP_API_KEY")
        )
    )

    app.config["storage_service"] = storage_service
    app.config["audio_storage_service"] = audio_storage_service
    app.config["dom_storage_service"] = dom_storage_service
    app.config["workflow_event_service"] = workflow_event_service
    app.config["workflow_state_service"] = workflow_state_service
    app.config["redis_service"] = redis_service
    app.config["generate_steps_orchestrator"] = GenerateStepsOrchestrator(
        workflow=generate_steps_workflow,
        workflow_event_service=workflow_event_service,
        workflow_state_service=workflow_state_service
    )

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
