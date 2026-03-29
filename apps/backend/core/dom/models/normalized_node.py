from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class NormalizedNode:
    node_id: str
    tag: str
    role: Optional[str] = None
    text: Optional[str] = None
    accessible_name: Optional[str] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    visible: bool = True
    interactive: bool = False
    css_selector: Optional[str] = None
    dom_id: Optional[str] = None
    children: List["NormalizedNode"] = field(default_factory=list)
