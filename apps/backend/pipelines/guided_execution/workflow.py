from langgraph.graph import StateGraph, START, END

from apps.backend.pipelines.guided_execution.workflow_state import GuidedExecutionWorkflowState

from apps.backend.pipelines.guided_execution.nodes.dom_fetch_node import DomFetchNode
from apps.backend.pipelines.guided_execution.nodes.parse_and_serialize_dom_node import ParseAndSerializeDomNode
from apps.backend.pipelines.guided_execution.nodes.guided_execution_node import GuidedExecutionNode
from apps.backend.pipelines.guided_execution.nodes.transcript_to_speech_node import TranscriptToSpeechNode
from apps.backend.pipelines.guided_execution.nodes.persist_guidance_audio_node import PersistGuidanceAudioNode

from apps.backend.pipelines.guided_execution.constants.nodes import (
    DOM_FETCH,
    PARSE_AND_SERIALIZE_DOM,
    GUIDED_EXECUTION,
    TRANSCRIPT_TO_SPEECH,
    PERSIST_GUIDANCE_AUDIO,
)


class GuidedExecutionWorkflow:
    def __init__(
        self,
        llm,
        dom_storage_service,
        dom_parser,
        dom_serializer,
        tts_service,
        audio_storage_service,
    ) -> None:
        self.dom_fetch_node = DomFetchNode(dom_storage_service)
        self.parse_and_serialize_dom_node = ParseAndSerializeDomNode(
            dom_parser,
            dom_serializer,
        )
        self.guided_execution_node = GuidedExecutionNode(llm)
        self.transcript_to_speech_node = TranscriptToSpeechNode(tts_service)
        self.persist_guidance_audio_node = PersistGuidanceAudioNode(audio_storage_service)

    def build(self):
        graph = StateGraph(GuidedExecutionWorkflowState)

        graph.add_node(DOM_FETCH, self.dom_fetch_node.run)
        graph.add_node(PARSE_AND_SERIALIZE_DOM, self.parse_and_serialize_dom_node.run)
        graph.add_node(GUIDED_EXECUTION, self.guided_execution_node.run)
        graph.add_node(TRANSCRIPT_TO_SPEECH, self.transcript_to_speech_node.run)
        graph.add_node(PERSIST_GUIDANCE_AUDIO, self.persist_guidance_audio_node.run)

        graph.add_edge(START, DOM_FETCH)
        graph.add_edge(DOM_FETCH, PARSE_AND_SERIALIZE_DOM)
        graph.add_edge(PARSE_AND_SERIALIZE_DOM, GUIDED_EXECUTION)
        graph.add_edge(GUIDED_EXECUTION, TRANSCRIPT_TO_SPEECH)
        graph.add_edge(TRANSCRIPT_TO_SPEECH, PERSIST_GUIDANCE_AUDIO)
        graph.add_edge(PERSIST_GUIDANCE_AUDIO, END)

        return graph.compile()
    