from infra.redis.constants.channels import (
    WORKFLOW_PREFIX,
    EVENTS_SUFFIX,
)


def workflow_events_channel(workflow_id: str) -> str:
    return f"{WORKFLOW_PREFIX}:{workflow_id}:{EVENTS_SUFFIX}"
