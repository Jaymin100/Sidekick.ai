from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState

from apps.backend.services.tts.elevenlabs_tts_service import ElevenLabsTTSService
from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey

class TranscriptToSpeechNode(BaseNode[GuidedExecutionWorkflowState]):
    def __init__(
        self, 
        tts_service: ElevenLabsTTSService,
    ) -> None:
        super().__init__()
        self.tts_service = tts_service

    def run(
        self,
        state: GuidedExecutionWorkflowState,
    ) -> GuidedExecutionWorkflowState:
        audio_bytes = self.tts_service.synthesize(
            text=state.get(GuidedExecutionStateKey.TRANSCRIPT)
        )
       

        state.update({
            GuidedExecutionStateKey.AUDIO_BYTES : audio_bytes
        })

        return state
    