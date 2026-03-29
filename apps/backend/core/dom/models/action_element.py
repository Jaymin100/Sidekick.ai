from dataclasses import dataclass
from typing import Optional

@dataclass
class ActionElement:
    element_id: str
    kind: str
    name: Optional[str]
    selector: str
    input_type: Optional[str] = None
    required: Optional[bool] = None
    value: Optional[str] = None
    placeholder: Optional[str] = None
