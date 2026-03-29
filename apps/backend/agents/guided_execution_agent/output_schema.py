from typing import Optional

from pydantic import BaseModel, Field, model_validator


class GuidedExecutionOutput(BaseModel):
    element_id: Optional[str] = Field(
        ...,
        description="The ID of the DOM element the user should interact with next. Must be null when no valid next element can be selected."
    )
    element_id_justification: str = Field(
        ...,
        description="Justification for why this element was selected as the best next action based on the task context, web guidance, and current DOM."
    )
    transcript: str = Field(
        ...,
        description="A short conversational instruction telling the user what to do next."
    )

    @model_validator(mode="after")
    def validate_guided_execution_output(self):
        if not self.transcript:
            raise ValueError("transcript must always be provided")

        if not self.element_id_justification:
            raise ValueError("element_id_justification must always be provided")

        return self
