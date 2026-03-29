from __future__ import annotations

from typing import Any

from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey
from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey
from apps.backend.core.enums.workflow_status import WorkflowStatus
from apps.backend.pipelines.guided_execution.workflow import GuidedExecutionWorkflow
from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState


class GuidedExecutionOrchestrator:
    def __init__(
        self,
        workflow: GuidedExecutionWorkflow,
        workflow_state_service,
        workflow_event_service=None,
    ) -> None:
        self.compiled_workflow = workflow.build()
        self.workflow_state_service = workflow_state_service
        self.workflow_event_service = workflow_event_service

    def run(
        self,
        workflow_id: str,
        dom_object_key: str,
        site_url: str,
        page_title: str,
    ) -> dict[str, Any]:
        print(f"[GUIDED_EXECUTION][START] workflow_id={workflow_id}")

        persisted_state = self.workflow_state_service.get_workflow_state(
            workflow_id=workflow_id
        )

        initial_state: GuidedExecutionWorkflowState = {
            GuidedExecutionStateKey.SITE_URL: site_url,
            GuidedExecutionStateKey.PAGE_TITLE: page_title,
            GuidedExecutionStateKey.USER_INTENT: persisted_state.get(
                GenerateStepsStateKey.USER_INTENT
            ),
            GuidedExecutionStateKey.TASK_SUMMARY: persisted_state.get(
                GenerateStepsStateKey.TASK_SUMMARY
            ),
            GuidedExecutionStateKey.WEB_RECONSTRUCTURED_MARKDOWN: persisted_state.get(
                GuidedExecutionStateKey.WEB_RECONSTRUCTURED_MARKDOWN
            ),
            GuidedExecutionStateKey.DOM_OBJECT_KEY: dom_object_key,
        }

        self._set_status(
            workflow_id=workflow_id,
            status=WorkflowStatus.IN_PROGRESS,
        )

        print(f"[GUIDED_EXECUTION][STATUS] workflow_id={workflow_id} -> IN_PROGRESS")

        try:
            result_state = self.compiled_workflow.invoke(initial_state)


            element_id = result_state.get(GuidedExecutionStateKey.ELEMENT_ID)
            audio_object_key = result_state.get(GuidedExecutionStateKey.AUDIO_OBJECT_KEY)

            status = (
                WorkflowStatus.COMPLETED
                if element_id is None
                else WorkflowStatus.IN_PROGRESS
            )

            print(f"[GUIDED_EXECUTION][OUTPUT] element_id={element_id} | status={status}")

            self._set_status(
                workflow_id=workflow_id,
                status=status,
            )

            print(f"[GUIDED_EXECUTION][STATUS] workflow_id={workflow_id} -> {status}")

            return {
                "element_id": element_id,
                "audio_object_key": audio_object_key,
                "status": status.value,
            }

        except Exception as exc:
            print(f"[GUIDED_EXECUTION][ERROR] workflow_id={workflow_id} | error={str(exc)}")

            self.workflow_state_service.update_workflow_state(
                workflow_id=workflow_id,
                updates={
                    "error_message": str(exc),
                },
            )

            self._set_status(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
            )

            return {
                "element_id": None,
                "audio_object_key": None,
                "status": WorkflowStatus.FAILED.value,
                "error": str(exc),
            }

    def _set_status(
        self,
        workflow_id: str,
        status: WorkflowStatus,
    ) -> None:
        if self.workflow_event_service is not None:
            self.workflow_event_service.publish_status_updated(
                workflow_id=workflow_id,
                status=status.value if hasattr(status, "value") else status,
            )
    