from apps.backend.core.dom.services.dom_processing_service import DomProcessingService

file = "/Users/joshuaolaoye/Desktop/Sidekick.ai/dom_files/eb0608bc-afed-454f-8cb3-841aabde6eee.txt"

with open(file, mode="r") as f:
    content = f.read()

dom_processing_service = DomProcessingService()
parsed_content = dom_processing_service.process(content)
print(parsed_content)