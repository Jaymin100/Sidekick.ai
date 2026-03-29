from apps.backend.agents.base import BaseAgent

from apps.backend.agents.intent_and_query_agent.input_schema import IntentAndQueryInput
from apps.backend.agents.intent_and_query_agent.output_schema import IntentAndQueryOutput

from apps.backend.core.utils.prompt_builder import PromptBuilder
from apps.backend.agents.intent_and_query_agent.examples import EXAMPLES
from apps.backend.agents.intent_and_query_agent.prompts.system_prompt import SYSTEM_PROMPT
from apps.backend.agents.intent_and_query_agent.prompts.user_prompt import USER_PROMPT

class IntentAndQueryAgent(
      BaseAgent[IntentAndQueryInput, IntentAndQueryOutput]
):
    
    def __init__(self, llm):
          super().__init__(llm, IntentAndQueryOutput)

    def build_system_prompt(self) -> str:
            examples_block = PromptBuilder.render_examples(EXAMPLES)
            system_prompt = PromptBuilder.inject_examples(SYSTEM_PROMPT, examples_block)
            return system_prompt
    
    def build_user_prompt(self, input_data: IntentAndQueryInput) -> str:
        user_input = input_data.user_input
        site_url = input_data.site_url
        page_title = input_data.page_title

        return USER_PROMPT.format(
            user_input=user_input,
            site_url=site_url,
            page_title=page_title
        )
