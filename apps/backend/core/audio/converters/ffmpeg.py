from io import BytesIO
import subprocess


class FfmpegConverter:

    @staticmethod
    def convert_webm_to_wav_bytes(webm_bytes: bytes) -> bytes:
        process = subprocess.run(
            [
                "ffmpeg",
                "-i", "pipe:0",
                "-f", "wav",
                "-acodec", "pcm_s16le",
                "-ac", "1",
                "-ar", "16000",
                "pipe:1",
            ],
            input=webm_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return process.stdout
