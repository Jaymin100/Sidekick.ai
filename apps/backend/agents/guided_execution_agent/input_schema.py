from pydantic import BaseModel, Field

from apps.backend.core.enums.intent import Intent


class GuidedExecutionInput(BaseModel):
    user_intent: Intent = Field(
        ...,
        description="The classified user intent for the task being performed on the current webpage."
    )
    task_summary: str = Field(
        ...,
        description="A short summary of the user's goal and the task the system is trying to guide them through."
    )
    site_url: str = Field(
        ...,
        description="The URL of the current webpage where the user is performing the action."
    )
    page_title: str = Field(
        ...,
        description="The title of the current webpage, used to provide additional context about the environment."
    )
    web_reconstructed_markdown: str = Field(
        ...,
        description="Reconstructed markdown from web search results that describes how the task is typically completed on this site or interface."
    )
    serialized_dom_content: str = Field(
        ...,
        description="A compact serialized representation of the current page DOM, containing the relevant visible and interactive elements the agent can choose from."
    )
    