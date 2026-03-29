from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState

from apps.backend.core.audio.converters.ffmpeg import FfmpegConverter
from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey


class AudioConversionNode(BaseNode[GenerateStepsWorkflowState]):
    def __init__(
        self,
        ffmpeg_converter: FfmpegConverter,
    ) -> None:
        super().__init__()
        self.ffmpeg_converter = ffmpeg_converter

    async def run(
        self,
        state: GenerateStepsWorkflowState,
    ) -> GenerateStepsWorkflowState:
        print("[AUDIO_CONVERSION] start")
        
        input_audio_wav_bytes = self.ffmpeg_converter.convert_webm_to_wav_bytes(
            webm_bytes=state.get(GenerateStepsStateKey.INPUT_AUDIO_WEBM_BYTES)
        )

        state.update({
            GenerateStepsStateKey.INPUT_AUDIO_WAV_BYTES : input_audio_wav_bytes
        })

        return state
    