from typing import TypedDict
from apps.backend.core.enums.intent import Intent
from apps.backend.services.search.serpapi.google_ai_mode.types import GoogleAiModeSearchResult

class GenerateStepsWorkflowState(TypedDict, total=False):
    input_audio_object_key: str
    site_url: str
    page_title: str

    input_audio_webm_bytes: bytes
    input_audio_wav_bytes: bytes
    input_audio_transcript: str

    user_intent: Intent
    task_summary: str
    search_query: str
    web_search_result: GoogleAiModeSearchResult
