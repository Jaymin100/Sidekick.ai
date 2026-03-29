from enum import Enum


class GuidedExecutionStateKey(str, Enum):
    SITE_URL = "site_url"
    PAGE_TITLE = "page_title"

    USER_INTENT = "user_intent"
    TASK_SUMMARY = "task_summary"
    WEB_RECONSTRUCTURED_MARKDOWN = "web_reconstructed_markdown"

    DOM_OBJECT_KEY = "dom_object_key"


    DOM_CONTENT = "dom_content"
    SERIALIZED_DOM_CONTENT = "serialized_dom_content"
    ELEMENT_ID = "element_id"
    STATUS = "status"
    TRANSCRIPT = "transcript"
    AUDIO_BYTES = "audio_bytes"
    AUDIO_OBJECT_KEY = "audio_object_key"

