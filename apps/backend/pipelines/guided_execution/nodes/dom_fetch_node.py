from apps.backend.pipelines.common.nodes.base import BaseNode
from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState

from infra.minio.services.dom_storage_service import DomStorageService
from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey

class DomFetchNode(BaseNode[GuidedExecutionWorkflowState]):
    def __init__(
        self, 
        dom_storage_service: DomStorageService
    ) -> None:
        super().__init__()
        self.dom_storage_service = dom_storage_service

    def run(
        self,
        state: GuidedExecutionWorkflowState,
    ) -> GuidedExecutionWorkflowState:
        print("[DOM_FETCH] start")
        dom_result = self.dom_storage_service.read_dom(
            object_key=state.get(GuidedExecutionStateKey.DOM_OBJECT_KEY)
        )

        state.update({
            GuidedExecutionStateKey.DOM_CONTENT : dom_result["bytes"]
        })

        return state
    