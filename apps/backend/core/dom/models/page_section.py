from dataclasses import dataclass
from typing import Optional, List
from apps.backend.core.dom.models.action_element import ActionElement

@dataclass
class PageSection:
    section_id: str
    heading: Optional[str]
    role: Optional[str]
    text_blocks: List[str]
    actions: List[ActionElement]
