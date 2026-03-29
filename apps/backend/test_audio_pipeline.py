import os
from dotenv import load_dotenv

from elevenlabs.client import ElevenLabs

from apps.backend.services.stt.elevenlabs_stt_service import ElevenLabsSTTService
from apps.backend.core.audio.converters.ffmpeg import FfmpegConverter
from infra.minio.services.storage_service import StorageService
from infra.minio.services.audio_storage_service import AudioStorageService

load_dotenv()

minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
minio_access_key = os.getenv("MINIO_ROOT_USER")
minio_secret_key = os.getenv("MINIO_ROOT_PASSWORD")
minio_secure = os.getenv("MINIO_SECURE", "false").lower() == "true"

class TestAudioPipeline:

    elevenlabs_client = ElevenLabs(
        api_key=os.getenv("ELEVENLABS_API_KEY")
    )

    stt_service = ElevenLabsSTTService(
        client=elevenlabs_client,
        model_id="scribe_v2",
    )

    storage_service = StorageService(
        endpoint=minio_endpoint,
        access_key=minio_access_key,
        secret_key=minio_secret_key,
        secure=minio_secure,
    )
    audio_storage_service = AudioStorageService(storage_service)

    @staticmethod
    def run(object_key: str) -> str:
        res = TestAudioPipeline.audio_storage_service.read_audio(object_key)
        audio_bytes = res["bytes"]
        wav_bytes = FfmpegConverter.convert_webm_to_wav_bytes(audio_bytes)
        filename = object_key.split("/")[-1].rsplit(".", 1)[0] + ".wav"
        transcript = TestAudioPipeline.stt_service.transcribe(wav_bytes, filename)
        return transcript
