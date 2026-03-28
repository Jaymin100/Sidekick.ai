from infra.minio.services.storage_service import StorageService
from infra.minio.constants.audio import (
    RAW_AUDIO_BUCKET,
    GENERATED_AUDIO_BUCKET,
    INPUT_FILENAME,
    OUTPUT_FILENAME,
    MIME_EXTENSION_MAP,
    DEFAULT_OUTPUT_MIME_TYPE
)


class AudioStorageService:

    def __init__(self, storage: StorageService) -> None:
        self.storage = storage
        self.storage.ensure_bucket(RAW_AUDIO_BUCKET)
        self.storage.ensure_bucket(GENERATED_AUDIO_BUCKET)

    def build_input_key(self, session_id: str, mime_type: str) -> str:
        extension = self._extension_from_mime(mime_type)
        return f"{session_id}/{INPUT_FILENAME}.{extension}"

    def build_output_key(self, session_id: str, mime_type: str = DEFAULT_OUTPUT_MIME_TYPE) -> str:
        extension = self._extension_from_mime(mime_type)
        return f"{session_id}/{OUTPUT_FILENAME}.{extension}"

    def create_upload_target(self, session_id: str, mime_type: str) -> dict:
        object_key = self.build_input_key(session_id, mime_type)

        upload_url = self.storage.get_presigned_put_url(
            bucket_name=RAW_AUDIO_BUCKET,
            object_key=object_key,
        )

        return {
            "bucket": RAW_AUDIO_BUCKET,
            "object_key": object_key,
            "mime_type": mime_type,
            "upload_url": upload_url,
        }

    def download_input_audio(
        self,
        session_id: str,
        mime_type: str,
        local_file_path: str,
    ) -> None:
        object_key = self.build_input_key(session_id, mime_type)

        self.storage.download_file(
            bucket_name=RAW_AUDIO_BUCKET,
            object_key=object_key,
            file_path=local_file_path,
        )

    def upload_generated_audio(
        self,
        session_id: str,
        local_file_path: str,
        mime_type: str = DEFAULT_OUTPUT_MIME_TYPE,
    ) -> dict:
        object_key = self.build_output_key(session_id, mime_type)

        self.storage.upload_file(
            bucket_name=GENERATED_AUDIO_BUCKET,
            object_key=object_key,
            file_path=local_file_path,
            content_type=mime_type,
        )

        playback_url = self.storage.get_presigned_get_url(
            bucket_name=GENERATED_AUDIO_BUCKET,
            object_key=object_key,
        )

        return {
            "bucket": GENERATED_AUDIO_BUCKET,
            "object_key": object_key,
            "mime_type": mime_type,
            "playback_url": playback_url,
        }

    @staticmethod
    def _extension_from_mime(mime_type: str) -> str:
        return MIME_EXTENSION_MAP.get(mime_type, "bin")
