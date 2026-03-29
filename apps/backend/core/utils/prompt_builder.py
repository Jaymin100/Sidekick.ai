from typing import List
from apps.backend.core.models.few_shot_example import FewShotExample

class PromptBuilder:

    @staticmethod
    def render_example(example: FewShotExample) -> str:
        tag = example.tag.value

        parts = [
            f"<{tag}_example>",
            "<user_input>",
            example.user_input,
            "</user_input>",
            "<assistant_response>",
            example.assistant_response,
            "</assistant_response>",
        ]

        if example.user_feedback:
            parts.extend([
                "<user_feedback>",
                example.user_feedback,
                "</user_feedback>",
            ])

        parts.append(f"</{tag}_example>")
        return "\n".join(parts)
    
    @staticmethod
    def render_examples(examples: List[FewShotExample]) -> str:
        return "\n\n".join(PromptBuilder.render_example(example) for example in examples)
    
    @staticmethod
    def inject_examples(base_prompt: str, examples_block: str) -> str:
        return base_prompt.format(examples_block=examples_block)
    