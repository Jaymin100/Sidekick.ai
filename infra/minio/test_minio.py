import argparse
import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv

from infra.minio.services.storage_service import StorageService
from infra.minio.services.audio_storage_service import AudioStorageService
from infra.minio.constants.audio import MIME_EXTENSION_MAP



def build_services() -> AudioStorageService:
    load_dotenv()

    storage_service = StorageService(
        endpoint=os.getenv("MINIO_ENDPOINT"),
        access_key=os.getenv("MINIO_ROOT_USER"),
        secret_key=os.getenv("MINIO_ROOT_PASSWORD"),
        secure=os.getenv("MINIO_SECURE", "false").lower() == "true",
    )

    return AudioStorageService(storage_service)


def infer_mime_type(file_path: str) -> str:
    suffix = Path(file_path).suffix.lower().lstrip(".")

    # invert mapping
    extension_to_mime = {ext: mime for mime, ext in MIME_EXTENSION_MAP.items()}

    return extension_to_mime.get(suffix, "application/octet-stream")


def main() -> None:
    parser = argparse.ArgumentParser(description="Test audio upload/download with MinIO services")
    parser.add_argument("--input", required=True, help="Local input audio file path")
    parser.add_argument("--output", required=True, help="Local output path for downloaded audio")
    parser.add_argument("--session-id", required=False, help="Optional session id")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    session_id = args.session_id or str(uuid4())
    mime_type = infer_mime_type(str(input_path))

    audio_manager = build_services()

    print(f"[INFO] Session ID: {session_id}")
    print(f"[INFO] Input file: {input_path}")
    print(f"[INFO] Output file: {output_path}")
    print(f"[INFO] MIME type: {mime_type}")

    object_key = audio_manager.build_input_key(session_id, mime_type)

    print(f"[INFO] Uploading to object key: {object_key}")

    audio_manager.storage.upload_file(
        bucket_name=audio_manager.storage.client._base_url.host if False else "raw-audio",  # do not keep this
        object_key=object_key,
        file_path=str(input_path),
        content_type=mime_type,
    )

    print("[SUCCESS] Upload complete")

    audio_manager.download_input_audio(
        session_id=session_id,
        mime_type=mime_type,
        local_file_path=str(output_path),
    )

    print("[SUCCESS] Download complete")
    print("✅ End-to-end service test passed")


if __name__ == "__main__":
    main()
