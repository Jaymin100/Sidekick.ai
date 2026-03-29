from io import BytesIO

from apps.backend.services.stt.base import BaseSTTService


class ElevenLabsSTTService(BaseSTTService):
    def __init__(self, client, model_id: str):
        self.client = client
        self.model_id = model_id

    def transcribe(self, audio_bytes: bytes, filename: str) -> str:
        if not audio_bytes:
            raise ValueError("audio_bytes is empty")

        audio_file = BytesIO(audio_bytes)
        audio_file.name = filename
        audio_file.seek(0)

        result = self.client.speech_to_text.convert(
            file=audio_file,
            model_id=self.model_id,
        )

        return result.text

