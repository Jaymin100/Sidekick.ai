from typing import Optional, TypedDict
from apps.backend.core.enums.intent import Intent
from apps.backend.core.enums.workflow_status import WorkflowStatus

class GuidedExecutionWorkflowState(TypedDict, total=False):
    site_url: str
    page_title: str

    user_intent: Intent
    task_summary: str
    web_reconstructed_markdown: str

    dom_object_key: str

    dom_content: str
    serialized_dom_content: str
    element_id: Optional[str]
    status: WorkflowStatus
    transcript: str
    audio_bytes: bytes
    audio_object_key: str
    
