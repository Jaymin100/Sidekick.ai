from apps.backend.core.models.few_shot_example import FewShotExample
from apps.backend.core.enums.example_tag import ExampleTag

EXAMPLES = [
    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "how do i update my profile photo",
  "site_url": "https://www.linkedin.com/feed/",
  "page_title": "LinkedIn"
}
""".strip(),
        assistant_response="""
{
  "intent": "update",
  "intent_justification": "The user wants to modify an existing profile attribute.",
  "task_summary": "The user wants to update their LinkedIn profile photo.",
  "search_query": "how to update linkedin profile photo",
  "search_query_justification": "This query is specific to the user's task and uses the page context to identify LinkedIn."
}
""".strip(),
        user_feedback="Correctly uses page context to infer the platform and generate a precise search query."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "where do i find billing",
  "site_url": "https://dashboard.stripe.com/",
  "page_title": "Stripe Dashboard"
}
""".strip(),
        assistant_response="""
{
  "intent": "navigation",
  "intent_justification": "The user is trying to locate a section of the current application.",
  "task_summary": "The user wants to find the billing section in Stripe.",
  "search_query": "how to find billing in stripe dashboard",
  "search_query_justification": "This query uses the site context to generate navigation-focused guidance for Stripe."
}
""".strip(),
        user_feedback="Correctly classifies navigation intent and uses the page context to specialize the query."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "i want to add another user",
  "site_url": "https://console.aws.amazon.com/",
  "page_title": "AWS Management Console"
}
""".strip(),
        assistant_response="""
{
  "intent": "create",
  "intent_justification": "The user wants to create a new user in the current platform.",
  "task_summary": "The user wants to create another user in AWS.",
  "search_query": "how to create iam user in aws console",
  "search_query_justification": "This query uses the AWS context to convert a vague request into a precise task-specific search."
}
""".strip(),
        user_feedback="Correctly uses platform context to infer the likely AWS task and generate a more useful query."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "why won't this let me upload my resume",
  "site_url": "https://wd5.myworkdayjobs.com/company/job/apply",
  "page_title": "Workday Careers"
}
""".strip(),
        assistant_response="""
{
  "intent": "troubleshooting",
  "intent_justification": "The request is framed as a failure or problem with an upload action.",
  "task_summary": "The user is having trouble uploading a resume in Workday.",
  "search_query": "why can't i upload resume in workday",
  "search_query_justification": "This query targets troubleshooting information specific to resume uploads in Workday."
}
""".strip(),
        user_feedback="Correctly detects troubleshooting language and uses platform context to improve the query."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "upload my profile picture",
  "site_url": "https://github.com/settings/profile",
  "page_title": "Public profile settings · GitHub"
}
""".strip(),
        assistant_response="""
{
  "intent": "upload",
  "intent_justification": "The user explicitly wants to upload an image.",
  "task_summary": "The user wants to upload a profile picture on GitHub.",
  "search_query": "how to upload profile picture on github",
  "search_query_justification": "This query directly targets the upload action and uses the current site context."
}
""".strip(),
        user_feedback="Correctly identifies upload intent and grounds the query in the current platform."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "download my report",
  "site_url": "https://app.powerbi.com/",
  "page_title": "Power BI"
}
""".strip(),
        assistant_response="""
{
  "intent": "download",
  "intent_justification": "The user wants to export or save a file from the current application.",
  "task_summary": "The user wants to download a report in Power BI.",
  "search_query": "how to download report in power bi",
  "search_query_justification": "This query targets report download steps and uses the page context to identify the platform."
}
""".strip(),
        user_feedback="Correctly classifies download intent and produces a context-aware query."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "log me out",
  "site_url": "https://www.notion.so/my-account",
  "page_title": "My account – Notion"
}
""".strip(),
        assistant_response="""
{
  "intent": "authentication",
  "intent_justification": "Logging out is an account access action.",
  "task_summary": "The user wants to sign out of Notion.",
  "search_query": "how to log out of notion",
  "search_query_justification": "This query directly targets the sign-out flow and uses the site context to identify the application."
}
""".strip(),
        user_feedback="Correctly classifies authentication intent and uses the page context well."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "what does this feature do",
  "site_url": "https://vercel.com/dashboard",
  "page_title": "Vercel Dashboard"
}
""".strip(),
        assistant_response="""
{
  "intent": "information_lookup",
  "intent_justification": "The user is asking for an explanation rather than trying to perform an action.",
  "task_summary": "The user wants to understand a feature in Vercel.",
  "search_query": "vercel feature explanation dashboard",
  "search_query_justification": "This query is designed to retrieve explanatory information about features in the current platform."
}
""".strip(),
        user_feedback="Correctly distinguishes informational intent from action-oriented requests."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_input": "do this here",
  "site_url": "https://docs.google.com/document/d/123/edit",
  "page_title": "Untitled document - Google Docs"
}
""".strip(),
        assistant_response="""
{
  "intent": "unknown",
  "intent_justification": "The request is too vague to determine the user's actual goal.",
  "task_summary": "The user's goal is unclear from the request.",
  "search_query": "google docs common actions",
  "search_query_justification": "This best-effort query uses the page context to retrieve potentially relevant guidance even though the task is ambiguous."
}
""".strip(),
        user_feedback="Correctly marks the intent as unknown while still producing a best-effort search query."
    ),
]