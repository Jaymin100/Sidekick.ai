from pydantic import BaseModel, Field, model_validator

from apps.backend.core.enums.intent import Intent


class IntentAndQueryOutput(BaseModel):
    intent: Intent = Field(
        ...,
        description="The normalized intent of the user request based on the transcript and current page context."
    )
    intent_justification: str = Field(
        ...,
        description="Justification for why this intent was selected."
    )
    task_summary: str = Field(
        ...,
        description="A short summary of what the user is trying to accomplish."
    )
    search_query: str = Field(
        ...,
        description="A concise search query for the web search node to retrieve useful task-relevant context."
    )
    search_query_justification: str = Field(
        ...,
        description="Justification for why this search query is appropriate."
    )

    @model_validator(mode="after")
    def validate_search_query(self):
        if self.intent == Intent.UNKNOWN:
            if self.search_query is not None:
                raise ValueError("search_query must be None when intent is UNKNOWN")
        else:
            if not self.search_query:
                raise ValueError("search_query must be provided when intent is not UNKNOWN")

        return self
