from langgraph.graph import StateGraph, START, END

from apps.backend.pipelines.generate_steps.workflow_state import GenerateStepsWorkflowState

from apps.backend.pipelines.generate_steps.nodes.audio_fetch_node import AudioFetchNode
from apps.backend.pipelines.generate_steps.nodes.audio_conversion_node import AudioConversionNode
from apps.backend.pipelines.generate_steps.nodes.transcription_node import TranscriptionNode
from apps.backend.pipelines.generate_steps.nodes.intent_and_query_node import IntentAndQueryNode
from apps.backend.pipelines.generate_steps.nodes.web_search_node import WebSearchNode

from apps.backend.pipelines.generate_steps.constants.nodes import (
    AUDIO_FETCH,
    AUDIO_CONVERSION,
    TRANSCRIPTION,
    INTENT_AND_QUERY,
    WEB_SEARCH,
)


class GenerateStepsWorkflow:
    def __init__(
        self,
        llm,
        audio_storage_service,
        ffmpeg_converter,
        stt_service,
        web_search_client,
    ) -> None:
        self.audio_fetch_node = AudioFetchNode(audio_storage_service)
        self.audio_conversion_node = AudioConversionNode(ffmpeg_converter)
        self.transcription_node = TranscriptionNode(stt_service)
        self.intent_and_query_node = IntentAndQueryNode(llm)
        self.web_search_node = WebSearchNode(web_search_client)

    def build(self):
        graph = StateGraph(GenerateStepsWorkflowState)

        graph.add_node(AUDIO_FETCH, self.audio_fetch_node.run)
        graph.add_node(AUDIO_CONVERSION, self.audio_conversion_node.run)
        graph.add_node(TRANSCRIPTION, self.transcription_node.run)
        graph.add_node(INTENT_AND_QUERY, self.intent_and_query_node.run)
        graph.add_node(WEB_SEARCH, self.web_search_node.run)

        graph.add_edge(START, AUDIO_FETCH)
        graph.add_edge(AUDIO_FETCH, AUDIO_CONVERSION)
        graph.add_edge(AUDIO_CONVERSION, TRANSCRIPTION)
        graph.add_edge(TRANSCRIPTION, INTENT_AND_QUERY)
        graph.add_edge(INTENT_AND_QUERY, WEB_SEARCH)
        graph.add_edge(WEB_SEARCH, END)

        return graph.compile()
