from pydantic import BaseModel, Field

class IntentAndQueryInput(BaseModel):
    user_input: str = Field(
        ...,
        description="The user's spoken request or transcript describing what they want to do."
    )
    site_url: str = Field(
        ...,
        description="The URL of the current webpage where the user is performing the action."
    )
    page_title: str = Field(
        ...,
        description="The title of the current webpage, used to provide additional context about the environment."
    )
