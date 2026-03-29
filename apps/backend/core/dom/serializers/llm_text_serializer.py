from __future__ import annotations

from typing import List, Optional

from apps.backend.core.dom.models.normalized_node import NormalizedNode
from apps.backend.core.dom.constants.tags import HEADING_TAGS, SECTION_TAGS


class LlmTextSerializer:
    def serialize(self, root: Optional[NormalizedNode]) -> str:
        if root is None:
            return "Page Structure\n- empty"

        lines: List[str] = ["Page Structure"]

        if root.tag in {"body", "html", "[document]"} and root.children:
            for child in root.children:
                self._serialize_node(node=child, lines=lines, depth=0)
        else:
            self._serialize_node(node=root, lines=lines, depth=0)

        return "\n".join(lines)

    def _serialize_node(
        self,
        node: NormalizedNode,
        lines: List[str],
        depth: int,
    ) -> None:
        line = self._format_node(node)
        if line is not None:
            indent = "  " * depth
            lines.append(f"{indent}- {line}")
            child_depth = depth + 1
        else:
            child_depth = depth

        for child in node.children:
            self._serialize_node(
                node=child,
                lines=lines,
                depth=child_depth,
            )

    def _format_node(self, node: NormalizedNode) -> Optional[str]:
        if node.tag == "text":
            if not node.text:
                return None
            return f"text: {self._truncate(node.text)}"

        if node.tag in HEADING_TAGS:
            content = self._best_label(node)
            if not content:
                return node.tag
            return f"{node.tag}: {self._truncate(content)}"

        if node.tag in SECTION_TAGS:
            content = self._best_label(node)
            if content:
                return f"{node.tag}: {self._truncate(content)}"
            return node.tag

        if node.interactive:
            return self._format_interactive_node(node)

        if node.text:
            return f"{node.tag}: {self._truncate(node.text)}"

        if node.accessible_name:
            return f"{node.tag}: {self._truncate(node.accessible_name)}"

        if node.tag in {"div", "span"}:
            return None

        return node.tag

    def _format_interactive_node(self, node: NormalizedNode) -> str:
        name = self._best_label(node)

        if node.tag == "input":
            input_type = node.attributes.get("type", "text")
            if name:
                return f"input ({input_type}): {self._truncate(name)}"
            return f"input ({input_type})"

        if node.tag == "textarea":
            if name:
                return f"textarea: {self._truncate(name)}"
            return "textarea"

        if node.tag == "select":
            if name:
                return f"select: {self._truncate(name)}"
            return "select"

        if node.tag == "button":
            if name:
                return f"button: {self._truncate(name)}"
            return "button"

        if node.tag == "a":
            href = node.attributes.get("href")
            if name and href:
                return f"link: {self._truncate(name)} -> {href}"
            if name:
                return f"link: {self._truncate(name)}"
            if href:
                return f"link -> {href}"
            return "link"

        role = node.role or node.attributes.get("role")
        if role and name:
            return f"{role}: {self._truncate(name)}"
        if role:
            return str(role)
        if name:
            return f"{node.tag}: {self._truncate(name)}"

        return node.tag

    def _best_label(self, node: NormalizedNode) -> Optional[str]:
        candidates = (
            node.accessible_name,
            node.text,
            node.attributes.get("aria-label"),
            node.attributes.get("title"),
            node.attributes.get("placeholder"),
            node.attributes.get("name"),
        )

        for candidate in candidates:
            if candidate and str(candidate).strip():
                return str(candidate).strip()

        return None

    def _truncate(self, value: str, max_length: int = 200) -> str:
        value = value.strip()
        if len(value) <= max_length:
            return value
        return value[: max_length - 3].rstrip() + "..."
