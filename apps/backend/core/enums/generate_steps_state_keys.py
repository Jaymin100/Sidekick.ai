from enum import Enum


class GenerateStepsStateKey(str, Enum):
    INPUT_AUDIO_OBJECT_KEY = "input_audio_object_key"
    SITE_URL = "site_url"
    PAGE_TITLE = "page_title"

    INPUT_AUDIO_WEBM_BYTES = "input_audio_webm_bytes"
    INPUT_AUDIO_WAV_BYTES = "input_audio_wav_bytes"
    INPUT_AUDIO_TRANSCRIPT = "input_audio_transcript"

    USER_INTENT = "user_intent"
    TASK_SUMMARY = "task_summary"
    SEARCH_QUERY = "search_query"

    WEB_SEARCH_RESULT = "web_search_result"
