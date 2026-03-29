from datetime import datetime, UTC
from typing import Any

from apps.backend.core.enums.workflow_status import WorkflowStatus

from redis.constants.redis_service import WORKFLOW_STATE_TTL_SECONDS
from redis.services.redis_service import RedisService
from redis.utils.key_builder import workflow_state_key


class WorkflowStateService:
    def __init__(self, redis_service: RedisService) -> None:
        self.redis_service = redis_service

    def create_workflow_state(
        self,
        workflow_id: str,
    ) -> dict[str, Any]:
        now = self._now()

        state = {
            "workflow_id": workflow_id,
            "status": WorkflowStatus.AWAITING_DOM,
            "current_step_index": 0,
            "total_steps": 0,
            "cancelled": False,
            "error": None,
            "created_at": now,
            "updated_at": now,
        }

        self.redis_service.set_json(
            key=workflow_state_key(workflow_id),
            value=state,
            ex=WORKFLOW_STATE_TTL_SECONDS,
        )

        return state

    def get_workflow_state(self, workflow_id: str) -> dict[str, Any] | None:
        return self.redis_service.get_json(workflow_state_key(workflow_id))

    def update_workflow_state(
        self,
        workflow_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any] | None:
        current_state = self.get_workflow_state(workflow_id)

        if current_state is None:
            return None

        current_state.update(updates)
        current_state["updated_at"] = self._now()

        self.redis_service.set_json(
            key=workflow_state_key(workflow_id),
            value=current_state,
            ex=WORKFLOW_STATE_TTL_SECONDS,
        )

        return current_state

    def set_status(
        self,
        workflow_id: str,
        status: str,
    ) -> dict[str, Any] | None:
        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={"status": status},
        )

    def set_total_steps(
        self,
        workflow_id: str,
        total_steps: int,
    ) -> dict[str, Any] | None:
        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={
                "total_steps": total_steps,
                "current_step_index": 0,
            },
        )

    def set_current_step_index(
        self,
        workflow_id: str,
        current_step_index: int,
    ) -> dict[str, Any] | None:
        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={"current_step_index": current_step_index},
        )

    def advance_step(self, workflow_id: str) -> dict[str, Any] | None:
        current_state = self.get_workflow_state(workflow_id)

        if current_state is None:
            return None

        next_step_index = current_state.get("current_step_index", 0) + 1

        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={"current_step_index": next_step_index},
        )

    def mark_completed(self, workflow_id: str) -> dict[str, Any] | None:
        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={"status": "completed"},
        )

    def mark_failed(
        self,
        workflow_id: str,
        error: str,
    ) -> dict[str, Any] | None:
        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={
                "status": "failed",
                "error": error,
            },
        )

    def mark_cancelled(self, workflow_id: str) -> dict[str, Any] | None:
        return self.update_workflow_state(
            workflow_id=workflow_id,
            updates={
                "status": "cancelled",
                "cancelled": True,
            },
        )

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()
