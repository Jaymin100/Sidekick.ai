from uuid import uuid4
from werkzeug.datastructures import FileStorage

from infra.minio.services.storage_service import StorageService
from infra.minio.constants.audio import (
    AUDIO_BUCKET,
    MIME_EXTENSION_MAP,
    EXTENSION_MIME_MAP
)


class AudioStorageService:
    def __init__(self, storage: StorageService) -> None:
        self.storage = storage
        self.storage.ensure_bucket(AUDIO_BUCKET)

    def upload_audio(
        self,
        object_key: str,
        file_storage,
        mime_type: str,
    ) -> dict:
        file_stream = file_storage.stream
        file_stream.seek(0)

        self.storage.client.put_object(
            bucket_name=AUDIO_BUCKET,
            object_name=object_key,
            data=file_stream,
            length=-1,
            part_size=10 * 1024 * 1024,
            content_type=mime_type,
        )

        return {
            "bucket": AUDIO_BUCKET,
            "object_key": object_key,
            "mime_type": mime_type,
        }

    def download_audio(
        self,
        object_key: str,
        local_file_path: str,
    ) -> dict:
        self.storage.download_file(
            bucket_name=AUDIO_BUCKET,
            object_key=object_key,
            file_path=local_file_path,
        )

        filename = object_key.split("/")[-1]
        mime_type = self._mime_from_object_key(object_key)

        return {
            "bucket": AUDIO_BUCKET,
            "object_key": object_key,
            "filename": filename,
            "mime_type": mime_type,
        }
    
    def read_audio(
        self,
        object_key: str,
    ) -> dict:
        response = self.storage.get_object(
            bucket_name=AUDIO_BUCKET,
            object_key=object_key,
        )

        try:
            audio_bytes = response.read()
        finally:
            response.close()
            response.release_conn()

        return {
            "bucket": AUDIO_BUCKET,
            "object_key": object_key,
            "bytes": audio_bytes
        }
    
    @staticmethod
    def _extension_from_mime(mime_type: str) -> str:
        return MIME_EXTENSION_MAP.get(mime_type, "bin")

    @staticmethod
    def _mime_from_object_key(object_key: str) -> str:
        extension = object_key.rsplit(".", 1)[-1].lower() if "." in object_key else "bin"
        return EXTENSION_MIME_MAP.get(extension, "application/octet-stream")
