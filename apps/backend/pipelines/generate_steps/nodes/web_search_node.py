from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState

from apps.backend.services.search.serpapi.google_ai_mode.client import GoogleAiModeClient

from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey

class WebSearchNode(BaseNode[GenerateStepsWorkflowState]):
    def __init__(
        self,
        web_search_client: GoogleAiModeClient,
    ) -> None:
        super().__init__()
        self.web_search_client = web_search_client

    async def run(
        self,
        state: GenerateStepsWorkflowState,
    ) -> GenerateStepsWorkflowState:

        web_search_result = await self.web_search_client.search(
            query=state.get(GenerateStepsStateKey.SEARCH_QUERY)
        )

        state.update({
            GenerateStepsStateKey.WEB_SEARCH_RESULT : web_search_result
        })
        
        return state
    