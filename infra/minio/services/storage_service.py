from pathlib import Path
from minio import Minio


class StorageService:
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool = False,
    ) -> None:
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )

    def ensure_bucket(self, bucket_name: str) -> None:
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)

    def upload_file(
        self,
        bucket_name: str,
        object_key: str,
        file_path: str,
        content_type: str,
    ) -> None:
        self.client.fput_object(
            bucket_name=bucket_name,
            object_name=object_key,
            file_path=file_path,
            content_type=content_type,
        )

    def download_file(
        self,
        bucket_name: str,
        object_key: str,
        file_path: str,
    ) -> None:
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)

        self.client.fget_object(
            bucket_name=bucket_name,
            object_name=object_key,
            file_path=file_path,
        )
    
    def get_object(
        self,
        bucket_name: str,
        object_key: str,
    ):
        return self.client.get_object(
            bucket_name=bucket_name,
            object_name=object_key,
        )
