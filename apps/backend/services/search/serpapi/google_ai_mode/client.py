from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import serpapi

from apps.backend.services.search.serpapi.google_ai_mode.types import (
    GoogleAiModeReference,
    GoogleAiModeRelatedQuestion,
    GoogleAiModeSearchResult,
    GoogleAiModeSnippetLink,
    GoogleAiModeListItem,
    GoogleAiModeTextBlock,
)


class GoogleAiModeClient:
    def __init__(self, api_key: str) -> None:
        self.client = serpapi.Client(api_key=api_key)

    async def search(
        self,
        query: str,
        *,
        location: Optional[str] = None,
        uule: Optional[str] = None,
        subsequent_request_token: Optional[str] = None,
    ) -> GoogleAiModeSearchResult:
        params: dict[str, Any] = {
            "engine": "google_ai_mode",
            "q": query,
        }

        if location:
            params["location"] = location

        if uule:
            params["uule"] = uule

        if subsequent_request_token:
            params["subsequent_request_token"] = subsequent_request_token

        payload = await asyncio.to_thread(
            self.client.search,
            params,
        )

        return {
            "query": query,
            "subsequent_request_token": payload.get("subsequent_request_token"),
            "text_blocks": self._extract_text_blocks(payload),
            "reconstructed_markdown": payload.get("reconstructed_markdown", "") or "",
            "references": self._extract_references(payload),
            "related_questions": self._extract_related_questions(payload),
            "raw_response": payload,
        }

    def _extract_text_blocks(
        self,
        payload: Dict[str, Any],
    ) -> List[GoogleAiModeTextBlock]:
        normalized: List[GoogleAiModeTextBlock] = []

        for block in payload.get("text_blocks", []):
            normalized_block: GoogleAiModeTextBlock = {
                "type": block.get("type"),
                "snippet": block.get("snippet"),
            }

            if "reference_indexes" in block:
                normalized_block["reference_indexes"] = block.get("reference_indexes", [])

            if "list" in block:
                normalized_block["list"] = [
                    self._extract_list_item(item)
                    for item in block.get("list", [])
                ]

            normalized.append(normalized_block)

        return normalized

    def _extract_list_item(
        self,
        item: Dict[str, Any],
    ) -> GoogleAiModeListItem:
        normalized_item: GoogleAiModeListItem = {
            "snippet": item.get("snippet"),
        }

        if "snippet_links" in item:
            normalized_item["snippet_links"] = [
                self._extract_snippet_link(link)
                for link in item.get("snippet_links", [])
            ]

        return normalized_item

    def _extract_snippet_link(
        self,
        link: Dict[str, Any],
    ) -> GoogleAiModeSnippetLink:
        normalized_link: GoogleAiModeSnippetLink = {
            "text": link.get("text"),
            "link": link.get("link"),
        }

        if "shopping_results_reference_index" in link:
            normalized_link["shopping_results_reference_index"] = link.get(
                "shopping_results_reference_index"
            )

        return normalized_link

    def _extract_references(
        self,
        payload: Dict[str, Any],
    ) -> List[GoogleAiModeReference]:
        return [
            {
                "title": ref.get("title"),
                "link": ref.get("link"),
                "snippet": ref.get("snippet"),
                "source": ref.get("source"),
                "thumbnail": ref.get("thumbnail"),
                "source_icon": ref.get("source_icon"),
                "index": ref.get("index"),
            }
            for ref in payload.get("references", [])
        ]

    def _extract_related_questions(
        self,
        payload: Dict[str, Any],
    ) -> List[GoogleAiModeRelatedQuestion]:
        return [
            {
                "question": item.get("question"),
                "serpapi_link": item.get("serpapi_link"),
            }
            for item in payload.get("related_questions", [])
        ]
    