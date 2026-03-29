from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState

from apps.backend.agents.intent_and_query_agent.agent import IntentAndQueryAgent
from apps.backend.agents.intent_and_query_agent.input_schema import IntentAndQueryInput

from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey

class IntentAndQueryNode(BaseNode[GenerateStepsWorkflowState]):
    def __init__(self, llm) -> None:
        super().__init__()
        self.agent = IntentAndQueryAgent(llm)

    async def run(
        self,
        state: GenerateStepsWorkflowState,
    ) -> GenerateStepsWorkflowState:
        result = await self.agent.arun(
            IntentAndQueryInput(
                user_input=state.get(GenerateStepsStateKey.INPUT_AUDIO_TRANSCRIPT),
                site_url=state.get(GenerateStepsStateKey.SITE_URL),
                page_title=state.get(GenerateStepsStateKey.PAGE_TITLE)
            )
        )

        state.update({
            GenerateStepsStateKey.USER_INTENT : result.intent,
            GenerateStepsStateKey.TASK_SUMMARY : result.task_summary,
            GenerateStepsStateKey.SEARCH_QUERY : result.search_query
        })

        return state 
    