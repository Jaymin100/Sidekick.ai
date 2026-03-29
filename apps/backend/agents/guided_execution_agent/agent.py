from apps.backend.agents.base import BaseAgent

from apps.backend.agents.guided_execution_agent.input_schema import GuidedExecutionInput
from apps.backend.agents.guided_execution_agent.output_schema import GuidedExecutionOutput

from apps.backend.core.utils.prompt_builder import PromptBuilder
from apps.backend.agents.guided_execution_agent.examples import EXAMPLES
from apps.backend.agents.guided_execution_agent.prompts.system_prompt import SYSTEM_PROMPT
from apps.backend.agents.gudied_execution_agent.prompts.user_prompt import USER_PROMPT

class GuidedExecutionAgent(
      BaseAgent[GuidedExecutionInput, GuidedExecutionOutput]
):
    
    def __init__(self, llm):
          super().__init__(llm, GuidedExecutionOutput)

    def build_system_prompt(self) -> str:
            examples_block = PromptBuilder.render_examples(EXAMPLES)
            system_prompt = PromptBuilder.inject_examples(SYSTEM_PROMPT, examples_block)
            return system_prompt
    
    def build_user_prompt(self, input_data: GuidedExecutionInput) -> str:
        user_intent = input_data.user_intent
        task_summary = input_data.task_summary
        site_url = input_data.site_url
        page_title = input_data.page_title
        web_reconstructed_markdown = input_data.web_reconstructed_markdown
        serialized_dom_content = input_data.serialized_dom_content

        return USER_PROMPT.format(
            user_intent=user_intent,
            task_summary=task_summary,
            site_url=site_url,
            page_title=page_title,
            web_reconstructed_markdown=web_reconstructed_markdown,
            serialized_dom_content=serialized_dom_content
        )
