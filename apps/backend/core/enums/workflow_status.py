from enum import Enum

class WorkflowStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    AWAITING_DOM = "awaiting_dom"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
