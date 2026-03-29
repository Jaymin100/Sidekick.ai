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

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "update",
  "task_summary": "The user wants to update their LinkedIn profile photo.",
  "site_url": "https://www.linkedin.com/in/me/",
  "page_title": "LinkedIn Profile",
  "web_reconstructed_markdown": "To update your profile photo, click on your current profile picture.",
  "serialized_dom_content": "[el_21] image | alt='Profile photo' | clickable=true\n[el_22] button | text='Add section' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": "el_21",
  "element_id_justification": "Updating the profile photo typically starts by clicking the current profile image, and the DOM shows a clickable image labeled 'Profile photo'.",
  "transcript": "Click your profile photo to update it."
}
""".strip(),
        user_feedback="Correctly prioritizes actionable element over unrelated visible buttons."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "upload",
  "task_summary": "The user wants to upload a resume.",
  "site_url": "https://wd5.myworkdayjobs.com/apply",
  "page_title": "Workday Careers",
  "web_reconstructed_markdown": "To upload a resume, use the upload button or file selector.",
  "serialized_dom_content": "[el_30] input | type='file' | visible=true\n[el_31] button | text='Next' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": "el_30",
  "element_id_justification": "Uploading a resume requires interacting with a file input, and the DOM includes a visible file input element which directly supports this action.",
  "transcript": "Select your resume file to upload."
}
""".strip(),
        user_feedback="Correctly identifies the functional element rather than a generic navigation button."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "create",
  "task_summary": "The user wants to create a new project.",
  "site_url": "https://vercel.com/dashboard",
  "page_title": "Vercel Dashboard",
  "web_reconstructed_markdown": "Create a new project by clicking the New Project button.",
  "serialized_dom_content": "[el_40] button | text='New Project' | visible=true\n[el_41] button | text='Import' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": "el_40",
  "element_id_justification": "The task is to create a new project, and the DOM shows a visible button labeled 'New Project' which directly corresponds to that action.",
  "transcript": "Click New Project to get started."
}
""".strip(),
        user_feedback="Correctly selects the most direct action even when multiple buttons are present."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "navigation",
  "task_summary": "The user wants to access settings.",
  "site_url": "https://github.com/",
  "page_title": "GitHub",
  "web_reconstructed_markdown": "Settings are typically accessed from the profile menu.",
  "serialized_dom_content": "[el_50] avatar | clickable=true\n[el_51] link | text='Explore' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": "el_50",
  "element_id_justification": "Accessing settings usually starts from the profile menu, and the DOM shows a clickable avatar which typically opens that menu.",
  "transcript": "Click your profile icon to open the menu."
}
""".strip(),
        user_feedback="Correctly uses indirect UI patterns (avatar → menu) grounded in DOM."
    ),

    FewShotExample(
        tag=ExampleTag.GOOD,
        user_input="""
{
  "user_intent": "create",
  "task_summary": "The user wants to create a new user.",
  "site_url": "https://console.aws.amazon.com/",
  "page_title": "AWS Console",
  "web_reconstructed_markdown": "Go to IAM and create a user.",
  "serialized_dom_content": "[el_60] link | text='EC2' | visible=true\n[el_61] link | text='S3' | visible=true"
}
""".strip(),
        assistant_response="""
{
  "element_id": null,
  "element_id_justification": "The DOM does not contain any elements related to IAM or user creation, so no reliable next step can be grounded.",
  "transcript": "I can't find the right option on this page. Try navigating to the IAM section first."
}
""".strip(),
        user_feedback="Correctly avoids hallucination and returns null when no valid DOM action exists."
    ),
]
