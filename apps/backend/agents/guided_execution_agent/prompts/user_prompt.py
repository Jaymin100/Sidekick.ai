USER_PROMPT = """
<role_definition>
You are operating as the Guided Execution Agent in a browser-based voice assistant pipeline.

You are given the task context, external guidance, and the current webpage's serialized DOM.
</role_definition>

<task_definition>
Refer to the system prompt for the complete task definition, response rules, and output schema requirements.

Use the provided input to:
- determine the best next step for the user
- select the most appropriate DOM element to interact with
- generate a short conversational instruction for the user
- provide justification for the selected element
</task_definition>

<input>
  <user_intent>{user_intent}</user_intent>
  <task_summary>{task_summary}</task_summary>
  <site_url>{site_url}</site_url>
  <page_title>{page_title}</page_title>
  <web_reconstructed_markdown>{web_reconstructed_markdown}</web_reconstructed_markdown>
  <serialized_dom_content>{serialized_dom_content}</serialized_dom_content>
</input>
"""
