from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState

from apps.backend.services.stt.elevenlabs_stt_service import ElevenLabsSTTService

from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey

class TranscriptionNode(BaseNode[GenerateStepsWorkflowState]):
    def __init__(
        self,
        stt_service: ElevenLabsSTTService,
    ) -> None:
        super().__init__()
        self.stt_service = stt_service

    async def run(
        self,
        state: GenerateStepsWorkflowState,
    ) -> GenerateStepsWorkflowState:
        input_audio_transcript = await self.stt_service.transcribe(
            audio_bytes=state.get(GenerateStepsStateKey.INPUT_AUDIO_WAV_BYTES)
        )

        state.update({
            GenerateStepsStateKey.INPUT_AUDIO_TRANSCRIPT : input_audio_transcript
        })

        return state
    