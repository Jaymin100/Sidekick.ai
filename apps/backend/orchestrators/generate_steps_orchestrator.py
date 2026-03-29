from __future__ import annotations

from typing import Any

from apps.backend.core.enums.generate_steps_state_keys import GenerateStepsStateKey
from apps.backend.core.enums.guided_execution_state_keys import GuidedExecutionStateKey
from apps.backend.core.enums.workflow_status import WorkflowStatus
from apps.backend.pipelines.generate_steps.workflow import GenerateStepsWorkflow
from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState


class GenerateStepsOrchestrator:
    def __init__(
        self,
        workflow: GenerateStepsWorkflow,
        workflow_state_service,
        workflow_event_service=None,
    ) -> None:
        self.compiled_workflow = workflow.build()
        self.workflow_state_service = workflow_state_service
        self.workflow_event_service = workflow_event_service

    async def run(
        self,
        workflow_id: str,
        object_key: str,
        site_url: str,
        page_title: str,
    ) -> dict[str, Any] | None:
        initial_state: GenerateStepsWorkflowState = {
            GenerateStepsStateKey.INPUT_AUDIO_OBJECT_KEY: object_key,
            GenerateStepsStateKey.SITE_URL: site_url,
            GenerateStepsStateKey.PAGE_TITLE: page_title,
        }

        self.workflow_state_service.update_workflow_state(
            workflow_id=workflow_id,
            updates={
                GenerateStepsStateKey.INPUT_AUDIO_OBJECT_KEY: object_key,
                GenerateStepsStateKey.SITE_URL: site_url,
                GenerateStepsStateKey.PAGE_TITLE: page_title
            },
        )

        print(f"[GENERATE_STEPS][START] workflow_id={workflow_id}")

        self._set_status(
            workflow_id=workflow_id,
            status=WorkflowStatus.IN_PROGRESS,
        )

        print(f"[GENERATE_STEPS][IN_PROGRESS] workflow_id={workflow_id} | running workflow")

        try:
            result_state = await self.compiled_workflow.ainvoke(initial_state)

            print(f"[GENERATE_STEPS][SUCCESS] workflow_id={workflow_id}")
            print(f"[GENERATE_STEPS][RESULT] {result_state}")

            persisted_state = {
                GenerateStepsStateKey.SITE_URL: result_state.get(GenerateStepsStateKey.SITE_URL),
                GenerateStepsStateKey.PAGE_TITLE: result_state.get(GenerateStepsStateKey.PAGE_TITLE),
                GenerateStepsStateKey.USER_INTENT: result_state.get(GenerateStepsStateKey.USER_INTENT),
                GenerateStepsStateKey.TASK_SUMMARY: result_state.get(GenerateStepsStateKey.TASK_SUMMARY),
                GuidedExecutionStateKey.WEB_RECONSTRUCTURED_MARKDOWN: result_state.get(
                    GuidedExecutionStateKey.WEB_RECONSTRUCTURED_MARKDOWN
                )
            }

            print(f"[GENERATE_STEPS][PERSIST] workflow_id={workflow_id}")

            self.workflow_state_service.update_workflow_state(
                workflow_id=workflow_id,
                updates=persisted_state,
            )

            print(f"[GENERATE_STEPS][STATUS] workflow_id={workflow_id} -> AWAITING_DOM")

            self._set_status(
                workflow_id=workflow_id,
                status=WorkflowStatus.AWAITING_DOM,
            )

            return None

        except Exception as exc:
            print(f"[GENERATE_STEPS][ERROR] workflow_id={workflow_id} | error={str(exc)}")
            
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
                "workflow_id": workflow_id,
                "status": WorkflowStatus.FAILED,
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
    