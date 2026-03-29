from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState

from apps.backend.core.dom.parsers.dom_parsers import DomParser
from apps.backend.core.dom.serializers.llm_text_serializer import LlmTextSerializer
from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey

class ParseAndSerializeDomNode(BaseNode[GuidedExecutionWorkflowState]):
    def __init__(
        self, 
        dom_parser: DomParser,
        dom_serializer: LlmTextSerializer
    ) -> None:
        super().__init__()
        self.dom_parser = dom_parser
        self.dom_serializer = dom_serializer

    def run(
        self,
        state: GuidedExecutionWorkflowState,
    ) -> GuidedExecutionWorkflowState:
        parsed_dom_content = self.dom_parser.parse(
            raw_dom=state.get(GuidedExecutionStateKey.DOM_CONTENT)
        )

        serialized_dom_content = self.dom_serializer.serialize(
           root=parsed_dom_content
        )

        state.update({
            GuidedExecutionStateKey.SERIALIZED_DOM_CONTENT : serialized_dom_content
        })

        return state
    