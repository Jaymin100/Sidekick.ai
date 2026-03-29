USER_PROMPT = """
<role_definition>
You are operating as the Intent and Query Generation Agent in a browser-based voice assistant pipeline.

You are given a user's spoken request along with the current webpage context.
</role_definition>

<task_definition>
Refer to the system prompt for the complete task definition, response rules, and output schema requirements.

Use the provided input to:
- determine the user's intent
- summarize the user's goal
- generate a precise search query for downstream retrieval
</task_definition>

<input>
  <user_input>{user_input}</user_input>
  <site_url>{site_url}</site_url>
  <page_title>{page_title}</page_title>
</input>
"""