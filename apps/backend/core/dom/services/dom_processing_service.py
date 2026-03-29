from apps.backend.core.dom.parsers.dom_parsers import DomParser
from apps.backend.core.dom.cleaners.dom_cleaners import DomCleaner
from apps.backend.core.dom.serializers.llm_text_serializer import LlmTextSerializer


class DomProcessingService:
    def __init__(self) -> None:
        self.parser = DomParser()
        self.cleaner = DomCleaner()
        self.serializer = LlmTextSerializer()

    def process(self, raw_dom: str) -> str:
        parsed_tree = self.parser.parse(raw_dom)
        cleaned_tree = self.cleaner.clean(parsed_tree)
        return self.serializer.serialize(cleaned_tree)
