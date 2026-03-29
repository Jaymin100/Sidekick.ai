from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState

from infra.minio.services.audio_storage_service import AudioStorageService
from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey

class AudioFetchNode(BaseNode[GenerateStepsWorkflowState]):
    def __init__(
        self, 
        audio_storage_service: AudioStorageService
    ) -> None:
        super().__init__()
        self.audio_storage_service = audio_storage_service

    async def run(
        self,
        state: GenerateStepsWorkflowState,
    ) -> GenerateStepsWorkflowState:
        input_audio_webm_bytes = self.audio_storage_service.read_audio(
            object_key=state.get(GenerateStepsStateKey.INPUT_AUDIO_OBJECT_KEY)
        )

        state.update({
            GenerateStepsStateKey.INPUT_AUDIO_WEBM_BYTES: input_audio_webm_bytes
        })

        return state
    