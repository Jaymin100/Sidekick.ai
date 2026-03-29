from redis.constants.keys import (
    WORKFLOW_PREFIX,
    STATE_SUFFIX,
    CANCELLED_SUFFIX,
)


def workflow_state_key(workflow_id: str) -> str:
    return f"{WORKFLOW_PREFIX}:{workflow_id}:{STATE_SUFFIX}"


def workflow_cancelled_key(workflow_id: str) -> str:
    return f"{WORKFLOW_PREFIX}:{workflow_id}:{CANCELLED_SUFFIX}"
