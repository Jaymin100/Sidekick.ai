class WorkflowEvent(str, Enum):
    STEP_COMPLETED = "step_completed"
    ELEMENT_NOT_FOUND = "element_not_found"
    PAGE_CHANGED = "page_changed"
    USER_INTERACTION = "user_interaction"
