import os
from dotenv import load_dotenv


from apps.backend.core.dom.services.dom_processing_service import DomProcessingService
from infra.minio.services.storage_service import StorageService
from infra.minio.services.dom_storage_service import DomStorageService

load_dotenv()

minio_endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
minio_access_key = os.getenv("MINIO_ROOT_USER")
minio_secret_key = os.getenv("MINIO_ROOT_PASSWORD")
minio_secure = os.getenv("MINIO_SECURE", "false").lower() == "true"

class TestDomPipeline:

    storage_service = StorageService(
        endpoint=minio_endpoint,
        access_key=minio_access_key,
        secret_key=minio_secret_key,
        secure=minio_secure,
    )

    dom_storage_service = DomStorageService(storage_service)

    dom_processing_service = DomProcessingService()

    @staticmethod
    def run(object_key: str) -> str:
        res = TestDomPipeline.dom_storage_service.read_dom(object_key)
        dom_bytes = res["bytes"]
        raw_dom = dom_bytes.decode("utf-8")
        parsed_content = TestDomPipeline.dom_processing_service.process(raw_dom)
        return parsed_content
