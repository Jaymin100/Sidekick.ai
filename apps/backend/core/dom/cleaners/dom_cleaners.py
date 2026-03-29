from __future__ import annotations

from typing import Optional

from apps.backend.core.dom.models.normalized_node import NormalizedNode

from apps.backend.core.dom.constants.tags import (
    SECTION_TAGS, 
    HEADING_TAGS
)

from apps.backend.core.dom.constants.roles import LANDMARK_ROLES



class DomCleaner:
    def clean(self, root: Optional[NormalizedNode]) -> Optional[NormalizedNode]:
        if root is None:
            return None

        root = self._remove_invisible_nodes(root)
        root = self._remove_empty_nodes(root)
        root = self._collapse_wrappers(root)
        root = self._merge_adjacent_text_nodes(root)

        return root

    def _remove_invisible_nodes(
        self,
        node: Optional[NormalizedNode],
    ) -> Optional[NormalizedNode]:
        if node is None:
            return None

        cleaned_children = []
        for child in node.children:
            cleaned_child = self._remove_invisible_nodes(child)
            if cleaned_child is not None:
                cleaned_children.append(cleaned_child)

        node.children = cleaned_children

        if not node.visible and not node.interactive:
            return None

        return node

    def _remove_empty_nodes(
        self,
        node: Optional[NormalizedNode],
    ) -> Optional[NormalizedNode]:
        if node is None:
            return None

        cleaned_children = []
        for child in node.children:
            cleaned_child = self._remove_empty_nodes(child)
            if cleaned_child is not None:
                cleaned_children.append(cleaned_child)

        node.children = cleaned_children

        if self._is_meaningful(node):
            return node

        return None

    def _collapse_wrappers(
        self,
        node: Optional[NormalizedNode],
    ) -> Optional[NormalizedNode]:
        if node is None:
            return None

        node.children = [
            collapsed
            for child in node.children
            if (collapsed := self._collapse_wrappers(child)) is not None
        ]

        if self._should_preserve_node(node):
            return node

        if len(node.children) == 1:
            return node.children[0]

        return node

    def _merge_adjacent_text_nodes(
        self,
        node: Optional[NormalizedNode],
    ) -> Optional[NormalizedNode]:
        if node is None:
            return None

        merged_children = []
        buffer_text = []

        for child in node.children:
            child = self._merge_adjacent_text_nodes(child)
            if child is None:
                continue

            if child.tag == "text" and child.text:
                buffer_text.append(child.text)
                continue

            if buffer_text:
                merged_children.append(
                    NormalizedNode(
                        node_id=f"{node.node_id}_merged_text",
                        tag="text",
                        text=" ".join(buffer_text).strip(),
                        role=None,
                        accessible_name=None,
                        attributes={},
                        visible=True,
                        interactive=False,
                        children=[],
                    )
                )
                buffer_text = []

            merged_children.append(child)

        if buffer_text:
            merged_children.append(
                NormalizedNode(
                    node_id=f"{node.node_id}_merged_text",
                    tag="text",
                    text=" ".join(buffer_text).strip(),
                    role=None,
                    accessible_name=None,
                    attributes={},
                    visible=True,
                    interactive=False,
                    children=[],
                )
            )

        node.children = merged_children
        return node

    def _is_meaningful(self, node: NormalizedNode) -> bool:
        if node.interactive:
            return True

        if node.tag in SECTION_TAGS or node.tag in HEADING_TAGS:
            return True

        if node.text and node.text.strip():
            return True

        if node.accessible_name and node.accessible_name.strip():
            return True

        if node.children:
            return True

        return False

    def _should_preserve_node(self, node: NormalizedNode) -> bool:
        if node.interactive:
            return True

        if node.tag in SECTION_TAGS or node.tag in HEADING_TAGS:
            return True

        if node.role in LANDMARK_ROLES:
            return True

        if node.text:
            return True

        if node.accessible_name:
            return True

        return False
