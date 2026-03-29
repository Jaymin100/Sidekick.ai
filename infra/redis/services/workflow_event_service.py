from datetime import datetime, UTC
from typing import Any

from redis.services.redis_service import RedisService
from redis.utils.channel_builder import workflow_events_channel


class WorkflowEventService:
    def __init__(self, redis_service: RedisService) -> None:
        self.redis_service = redis_service

    def publish_event(
        self,
        workflow_id: str,
        event_type: str,
        data: dict[str, Any] | None = None,
    ) -> None:
        payload = {
            "workflow_id": workflow_id,
            "type": event_type,
            "timestamp": self._now(),
            "data": data or {},
        }

        self.redis_service.publish(
            channel=workflow_events_channel(workflow_id),
            message=payload,
        )

    def publish_status_updated(
        self,
        workflow_id: str,
        status: str,
    ) -> None:
        self.publish_event(
            workflow_id=workflow_id,
            event_type="workflow.status.updated",
            data={"status": status},
        )

    def publish_steps_updated(
        self,
        workflow_id: str,
        current_step_index: int,
        total_steps: int,
    ) -> None:
        self.publish_event(
            workflow_id=workflow_id,
            event_type="workflow.steps.updated",
            data={
                "current_step_index": current_step_index,
                "total_steps": total_steps,
            },
        )

    def publish_completed(self, workflow_id: str) -> None:
        self.publish_event(
            workflow_id=workflow_id,
            event_type="workflow.completed",
        )

    def publish_failed(
        self,
        workflow_id: str,
        error: str,
    ) -> None:
        self.publish_event(
            workflow_id=workflow_id,
            event_type="workflow.failed",
            data={"error": error},
        )

    def publish_cancelled(self, workflow_id: str) -> None:
        self.publish_event(
            workflow_id=workflow_id,
            event_type="workflow.cancelled",
        )

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat()
    