from infra.minio.services.storage_service import StorageService
from infra.minio.constants.dom import (
    DOM_BUCKET,
    DOM_CONTENT_TYPE,
)


class DomStorageService:
    def __init__(self, storage: StorageService) -> None:
        self.storage = storage
        self.storage.ensure_bucket(DOM_BUCKET)

    def upload_dom_file(
        self,
        object_key: str,
        file_path: str,
    ) -> dict:
        self.storage.upload_file(
            bucket_name=DOM_BUCKET,
            object_key=object_key,
            file_path=file_path,
            content_type=DOM_CONTENT_TYPE,
        )

        return {
            "bucket": DOM_BUCKET,
            "object_key": object_key,
            "content_type": DOM_CONTENT_TYPE,
        }

    def download_dom_file(
        self,
        object_key: str,
        local_file_path: str,
    ) -> dict:
        self.storage.download_file(
            bucket_name=DOM_BUCKET,
            object_key=object_key,
            file_path=local_file_path,
        )

        return {
            "bucket": DOM_BUCKET,
            "object_key": object_key,
            "content_type": DOM_CONTENT_TYPE,
        }
    
    def read_dom(
    self,
    object_key: str,
    ) -> dict:
        response = self.storage.get_object(
            bucket_name=DOM_BUCKET,
            object_key=object_key,
        )

        try:
            dom_bytes = response.read()
        finally:
            response.close()
            response.release_conn()

        return {
            "bucket": DOM_BUCKET,
            "object_key": object_key,
            "bytes": dom_bytes
        }
