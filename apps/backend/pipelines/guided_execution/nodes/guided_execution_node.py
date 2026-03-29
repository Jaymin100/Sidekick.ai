from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState

from apps.backend.agents.guided_execution_agent.agent import GuidedExecutionAgent
from apps.backend.agents.guided_execution_agent.input_schema import GuidedExecutionInput

from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey

class GuidedExecutionNode(BaseNode[GuidedExecutionWorkflowState]):
    def __init__(self, llm) -> None:
        super().__init__()
        self.agent = GuidedExecutionAgent(llm)

    def run(
        self,
        state: GuidedExecutionWorkflowState,
    ) -> GuidedExecutionWorkflowState:
        print("[GUIDED EXECUTION AGENT] start")

        user_intent = state.get(GuidedExecutionStateKey.USER_INTENT)
        task_summary = state.get(GuidedExecutionStateKey.TASK_SUMMARY)
        web_reconstructed_markdown = state.get(GuidedExecutionStateKey.WEB_RECONSTRUCTURED_MARKDOWN)

        print(f"[GUIDED_EXECUTION][INPUT_VALUES] user_intent={user_intent}, task_summary={task_summary}, web_reconstructed_markdown={web_reconstructed_markdown}")

        result = self.agent.run(
            GuidedExecutionInput (
                user_intent=state.get(GuidedExecutionStateKey.USER_INTENT),
                task_summary=state.get(GuidedExecutionStateKey.TASK_SUMMARY),
                site_url=state.get(GuidedExecutionStateKey.SITE_URL),
                page_title=state.get(GuidedExecutionStateKey.PAGE_TITLE),
                web_reconstructed_markdown=state.get(GuidedExecutionStateKey.WEB_RECONSTRUCTURED_MARKDOWN),
                serialized_dom_content=state.get(GuidedExecutionStateKey.SERIALIZED_DOM_CONTENT)
            )
        )

        state.update({
            GuidedExecutionStateKey.ELEMENT_ID : result.element_id,
            GuidedExecutionStateKey.TRANSCRIPT : result.transcript
        })

        return state
