from apps.backend.services.tts.base import BaseTTSService


class ElevenLabsTTSService(BaseTTSService):
    def __init__(self, client, voice_id: str, model_id: str, output_format: str):
        self.client = client
        self.voice_id = voice_id
        self.model_id = model_id
        self.output_format = output_format

    def synthesize(self, text: str) -> bytes:
        audio = self.client.text_to_speech.convert(
            voice_id=self.voice_id,
            text=text,
            model_id=self.model_id,
            output_format=self.output_format,
        )

        if hasattr(audio, "__iter__") and not isinstance(audio, (bytes, bytearray)):
            return b"".join(audio)

        return audio
