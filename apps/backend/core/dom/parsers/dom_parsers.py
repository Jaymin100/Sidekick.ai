from __future__ import annotations

from bs4 import BeautifulSoup, NavigableString, Tag
from typing import Optional
from uuid import uuid4

from apps.backend.core.dom.models.normalized_node import NormalizedNode

from apps.backend.core.dom.constants.tags import (
    IGNORED_TAGS,
    INTERACTIVE_TAGS
)

from apps.backend.core.dom.constants.attributes import IMPORTANT_ATTRIBUTES
from apps.backend.core.dom.constants.roles import INTERACTIVE_ROLES


def normalize_whitespace(text: str) -> str:
    return " ".join(text.split()).strip()


class DomParser:
    def parse(self, raw_dom: str) -> Optional[NormalizedNode]:
        soup = BeautifulSoup(raw_dom, "html.parser")

        root = soup.body if soup.body else soup
        return self._parse_node(root)

    def _parse_node(self, node) -> Optional[NormalizedNode]:
        if isinstance(node, NavigableString):
            text = normalize_whitespace(str(node))
            if not text:
                return None

            return NormalizedNode(
                node_id=self._new_id(),
                tag="text",
                text=text,
                role=None,
                accessible_name=None,
                attributes={},
                visible=True,
                interactive=False,
                children=[],
            )

        if not isinstance(node, Tag):
            return None

        tag_name = node.name.lower()

        if tag_name in IGNORED_TAGS:
            return None

        attributes = self._extract_attributes(node)
        text = self._extract_own_text(node)
        role = node.attrs.get("role")
        accessible_name = self._extract_accessible_name(node)
        interactive = self._is_interactive(node)
        visible = self._is_probably_visible(node)

        children = []
        for child in node.children:
            parsed_child = self._parse_node(child)
            if parsed_child is not None:
                children.append(parsed_child)

        return NormalizedNode(
            node_id=self._new_id(),
            tag=tag_name,
            role=role,
            text=text,
            accessible_name=accessible_name,
            attributes=attributes,
            visible=visible,
            interactive=interactive,
            children=children,
        )

    def _extract_attributes(self, node: Tag) -> dict:
        extracted = {}

        for key, value in node.attrs.items():
            if key not in IMPORTANT_ATTRIBUTES:
                continue

            if isinstance(value, list):
                extracted[key] = " ".join(str(v) for v in value)
            else:
                extracted[key] = str(value)

        return extracted

    def _extract_own_text(self, node: Tag) -> Optional[str]:
        direct_text_parts = []

        for child in node.children:
            if isinstance(child, NavigableString):
                cleaned = normalize_whitespace(str(child))
                if cleaned:
                    direct_text_parts.append(cleaned)

        if not direct_text_parts:
            return None

        joined = normalize_whitespace(" ".join(direct_text_parts))
        return joined or None

    def _extract_accessible_name(self, node: Tag) -> Optional[str]:
        aria_label = node.attrs.get("aria-label")
        if aria_label:
            return normalize_whitespace(str(aria_label))

        title = node.attrs.get("title")
        if title:
            return normalize_whitespace(str(title))

        if node.name.lower() in {"button", "a"}:
            text = normalize_whitespace(node.get_text(" ", strip=True))
            return text or None

        placeholder = node.attrs.get("placeholder")
        if placeholder:
            return normalize_whitespace(str(placeholder))

        return None

    def _is_interactive(self, node: Tag) -> bool:
        tag_name = node.name.lower()

        if tag_name in INTERACTIVE_TAGS:
            return True

        role = str(node.attrs.get("role", "")).lower()
        if role in INTERACTIVE_ROLES:
            return True

        if node.has_attr("onclick"):
            return True

        return False

    def _is_probably_visible(self, node: Tag) -> bool:
        if node.has_attr("hidden"):
            return False

        aria_hidden = str(node.attrs.get("aria-hidden", "")).lower()
        if aria_hidden == "true":
            return False

        style = str(node.attrs.get("style", "")).replace(" ", "").lower()
        if "display:none" in style or "visibility:hidden" in style:
            return False

        return True

    def _new_id(self) -> str:
        return f"node_{uuid4().hex[:8]}"
