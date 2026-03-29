from __future__ import annotations

from typing import Any, List, TypedDict


class GoogleAiModeSnippetLink(TypedDict, total=False):
    text: str
    link: str
    shopping_results_reference_index: int


class GoogleAiModeListItem(TypedDict, total=False):
    snippet: str
    snippet_links: List[GoogleAiModeSnippetLink]


class GoogleAiModeTextBlock(TypedDict, total=False):
    type: str
    snippet: str
    reference_indexes: List[int]
    list: List[GoogleAiModeListItem]


class GoogleAiModeReference(TypedDict, total=False):
    title: str
    link: str
    snippet: str
    source: str
    thumbnail: str
    source_icon: str
    index: int


class GoogleAiModeRelatedQuestion(TypedDict, total=False):
    question: str
    serpapi_link: str


class GoogleAiModeSearchResult(TypedDict):
    query: str
    subsequent_request_token: str | None
    text_blocks: List[GoogleAiModeTextBlock]
    reconstructed_markdown: str
    references: List[GoogleAiModeReference]
    related_questions: List[GoogleAiModeRelatedQuestion]
    raw_response: dict[str, Any]
