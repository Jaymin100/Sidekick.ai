from infra.minio.services.storage_service import StorageService
from infra.minio.constants.dom import (
    DOM_BUCKET,
    DEFAULT_DOM_SNAPSHOT_NAME,
    DOM_FILE_EXTENSION,
    DOM_CONTENT_TYPE,
)


class DomStorageService:

    def __init__(self, storage: StorageService) -> None:
        self.storage = storage
        self.storage.ensure_bucket(DOM_BUCKET)

    def build_dom_key(
        self,
        session_id: str,
        snapshot_name: str = DEFAULT_DOM_SNAPSHOT_NAME,
    ) -> str:
        return f"{session_id}/{snapshot_name}.{DOM_FILE_EXTENSION}"

    def create_upload_target(
        self,
        session_id: str,
        snapshot_name: str = DEFAULT_DOM_SNAPSHOT_NAME,
    ) -> dict:
        object_key = self.build_dom_key(session_id, snapshot_name)

        upload_url = self.storage.get_presigned_put_url(
            bucket_name=DOM_BUCKET,
            object_key=object_key,
        )

        return {
            "bucket": DOM_BUCKET,
            "object_key": object_key,
            "content_type": DOM_CONTENT_TYPE,
            "upload_url": upload_url,
        }

    def upload_dom_file(
        self,
        session_id: str,
        file_path: str,
        snapshot_name: str = DEFAULT_DOM_SNAPSHOT_NAME,
    ) -> dict:
        object_key = self.build_dom_key(session_id, snapshot_name)

        self.storage.upload_file(
            bucket_name=DOM_BUCKET,
            object_key=object_key,
            file_path=file_path,
            content_type=DOM_CONTENT_TYPE,
        )

        return {
            "bucket": DOM_BUCKET,
            "object_key": object_key,
        }

    def download_dom_file(
        self,
        session_id: str,
        local_file_path: str,
        snapshot_name: str = DEFAULT_DOM_SNAPSHOT_NAME,
    ) -> None:
        object_key = self.build_dom_key(session_id, snapshot_name)

        self.storage.download_file(
            bucket_name=DOM_BUCKET,
            object_key=object_key,
            file_path=local_file_path,
        )
    