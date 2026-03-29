from uuid import uuid4

from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState

from infra.minio.services.audio_storage_service import AudioStorageService
from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey


class PersistGuidanceAudioNode(BaseNode[GuidedExecutionWorkflowState]):
    def __init__(
        self,
        audio_storage_service: AudioStorageService
    ) -> None:
        super().__init__()
        self.audio_storage_service = audio_storage_service

    def run(
        self,
        state: GuidedExecutionWorkflowState,
    ) -> GuidedExecutionWorkflowState:
        audio_bytes = state.get(GuidedExecutionStateKey.AUDIO_BYTES)

        mime_type = "audio/mpeg"
        object_key = f"guided-execution/{uuid4()}.mp3"

        result = self.audio_storage_service.upload_audio_bytes(
            object_key=object_key,
            audio_bytes=audio_bytes,
            mime_type=mime_type,
        )

        state.update({
            GuidedExecutionStateKey.AUDIO_OBJECT_KEY: result["object_key"]
        })

        return state
