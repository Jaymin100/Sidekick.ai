from apps.backend.core.models.few_shot_example import FewShotExample
from apps.backend.core.enums.example_tag import ExampleTag


EXAMPLES = [
    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "create",
  "task_summary": "The user wants to create a new IAM user in AWS.",
  "site_url": "https://console.aws.amazon.com/iam/home#/users",
  "page_title": "IAM Users - AWS Console",
  "web_reconstructed_markdown": "To create a user in AWS IAM, navigate to Users and click the Create user button.",
  "serialized_dom_content": "[el_1] button | text='Create user' | visible=true\n[el_2] button | text='Delete user' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": "el_1",
  "element_id_justification": "The task requires creating a new user, and the DOM shows a visible button labeled 'Create user' which directly matches this action.",
  "transcript": "Click Create user to continue."
}
""".strip(),
        user_feedback="Correctly maps task intent to the exact DOM element and produces a clear instruction."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "navigation",
  "task_summary": "The user wants to find the billing section.",
  "site_url": "https://dashboard.stripe.com/",
  "page_title": "Stripe Dashboard",
  "web_reconstructed_markdown": "Billing can be accessed from the sidebar under Billing.",
  "serialized_dom_content": "[el_10] link | text='Payments' | visible=true\n[el_11] link | text='Billing' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": "el_11",
  "element_id_justification": "The task is to navigate to billing, and the DOM contains a visible link labeled 'Billing' which directly matches the target section.",
  "transcript": "Click Billing in the sidebar."
}
""".strip(),
        user_feedback="Correctly selects the navigation element that matches both task and DOM."
    ),
]
