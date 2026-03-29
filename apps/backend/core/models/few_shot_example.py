from pydantic import BaseModel, Field
from typing import Optional
from apps.backend.core.enums.example_tag import ExampleTag


class FewShotExample(BaseModel):
    tag: ExampleTag = Field(
        ...,
        description="Whether this is a positive or negative example."
    )
    user_input: str = Field(
        ...,
        description="The input request from the user."
    )
    assistant_response: str = Field(
        ...,
        description="The assistant's structured response."
    )
    user_feedback: Optional[str] = Field(
        default=None,
        description="Optional explanation of why this example is good or bad."
    )
