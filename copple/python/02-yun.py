from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import semantic_kernel as sk
from boto3.dynamodb.conditions import Attr
from semantic_kernel.connectors.ai.open_ai import (
    AzureTextCompletion,
    OpenAITextCompletion,
)
import boto3

app = FastAPI()

# Initialize the Semantic Kernel and configure connectors
kernel = sk.Kernel()
useAzureOpenAI = False

if useAzureOpenAI:
    deployment, api_key, endpoint = sk.azure_openai_settings_from_dot_env()
    kernel.add_text_completion_service(
        "dv", AzureTextCompletion(deployment, endpoint, api_key)
    )
else:
    api_key, org_id = sk.openai_settings_from_dot_env()
    kernel.add_text_completion_service(
        "dv", OpenAITextCompletion("text-davinci-003", api_key, org_id)
    )

# Initialize AWS DynamoDB resource
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
table_name = "Event"
table = dynamodb.Table(table_name)


# Create a Pydantic model to handle request data
class UserRequest(BaseModel):
    user_id: str

# Create a route to summarize events for a user
@app.post("/summarize_plan")
async def summarize_plan(user_request: UserRequest):
    user_id = user_request.user_id
    try:
        # Retrieve data from DynamoDB for the specified user_id
        response = table.scan(FilterExpression=Attr("UserId").eq(user_id))
        items = response.get("Items", [])

        if not items:
            return {"message": f"No events found for user with UserId: {user_id}"}

        # Extract event descriptions from the DynamoDB items
        event_texts = [item.get("Content", "") for item in items]

        # Concatenate event texts into a single document
        all_event_text = "당신의 모든 일정입니다.".join(event_texts)

        # Use Semantic Kernel to summarize the events
        prompt = f"""Summarize the events for UserId: {user_id} with the following content:
        {all_event_text}
        """
        summarize = kernel.create_semantic_function(
            prompt, max_tokens=2000, temperature=0.2, top_p=0.1
        )
        summary = summarize(all_event_text)
        return {"event_summary": summary}

    except Exception as e:
        return {"error": str(e)}


# Run the FastAPI app using Uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)