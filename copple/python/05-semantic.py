# FastAPI, Pydantic 및 필수 모듈을 가져옵니다.
from fastapi import FastAPI
from pydantic import BaseModel
import semantic_kernel as sk
from datetime import datetime
from boto3.dynamodb.conditions import Attr
from semantic_kernel.connectors.ai.open_ai import (
    AzureTextCompletion,
    OpenAITextCompletion,
)
import boto3

# FastAPI 애플리케이션을 초기화합니다.
app = FastAPI()

# Semantic Kernel을 초기화하고 커넥터를 구성합니다.
kernel = sk.Kernel()
useAzureOpenAI = False  # Azure OpenAI 서비스 사용 여부 설정

# Azure OpenAI 서비스를 사용하는 경우 또는 OpenAI 서비스를 사용하는 경우에 따라 커넥터를 설정합니다.
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

# AWS DynamoDB 리소스를 초기화합니다.
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
table_name = "Event"
table = dynamodb.Table(table_name)


# 요청 데이터를 처리하기 위한 Pydantic 모델을 생성합니다.
class UserRequest(BaseModel):
    user_id: str


# Define a function to summarize events by date
def summarize_events_by_date(events):
    event_summary_by_date = {}

    for event in events:
        event_date = event["start_datetime"].split(" ")[0]

        if event_date not in event_summary_by_date:
            event_summary_by_date[event_date] = []

        event_summary_by_date[event_date].append(
            {
                "event_id": event["event_id"],
                "event_title": event["event_title"],
            }
        )

    return event_summary_by_date


# 사용자의 이벤트를 요약하는 route를 생성합니다.
@app.post("/summarize_events/")
async def summarize_events(user_request: UserRequest):
    user_id = user_request.user_id
    try:
        # 지정된 user_id로부터 DynamoDB에서 데이터를 가져옵니다.
        response = table.scan(FilterExpression=Attr("UserId").eq(user_id))
        items = response.get("Items", [])

        if not items:
            # 이벤트가 없는 경우 Semantic Kernel을 사용하여 추천을 생성합니다.
            recommendation_prompt = f"Recommend events for user with UserId: {user_id}"
            generate_recommendation = kernel.create_semantic_function(
                recommendation_prompt, max_tokens=2000, temperature=0.2, top_p=0.1
            )
            recommendation = generate_recommendation("")

            return {
                "message": f"No events found for user with UserId: {user_id}",
                "recommendation": recommendation,
            }

        # DynamoDB 항목에서 이벤트 설명을 추출합니다.
        event_texts = [item.get("Content", "") for item in items]

        # 이벤트 텍스트를 하나의 문서로 연결합니다.
        all_event_text = "\n".join(event_texts)

        # Semantic Kernel을 사용하여 이벤트를 요약합니다.
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


# 사용자의 "Todo" 이벤트를 요약하는 route를 생성합니다.
@app.post("/summarize_todo_events/")
async def summarize_todo_events(user_request: UserRequest):
    user_id = user_request.user_id
    try:
        # 지정된 user_id와 EventType이 "Todo"인 이벤트를 DynamoDB에서 가져옵니다.
        response = table.scan(
            FilterExpression=Attr("UserId").eq(user_id) & Attr("EventType").eq("Todo")
        )
        items = response.get("Items", [])

        if not items:
            # "Todo" 이벤트가 없는 경우 Semantic Kernel을 사용하여 추천을 생성합니다.
            recommendation_prompt = f"Recommend some leisure activities for everyday life for user with UserId: {user_id}"
            generate_recommendation = kernel.create_semantic_function(
                recommendation_prompt, max_tokens=2000, temperature=0.2, top_p=0.1
            )
            recommendation = generate_recommendation("")

            return {
                "message": f"No Todo events found for user with UserId: {user_id}",
                "recommendation": recommendation,
            }

        # DynamoDB 항목에서 이벤트 제목을 추출합니다.
        event_texts = [item.get("Title", "") for item in items]

        # 이벤트 텍스트를 하나의 문서로 연결합니다.
        all_event_text = "\n".join(event_texts)

        # Semantic Kernel을 사용하여 "Todo" 이벤트를 요약합니다.
        prompt = f"""Remove duplicate words from the result and summarize the events thoroughly, for UserId: {user_id} with the following content:
        {all_event_text}
        """
        summarize = kernel.create_semantic_function(
            prompt, max_tokens=2000, temperature=0.2, top_p=0.1
        )
        summary = summarize(all_event_text)
        return {"todo_summary": summary}

    except Exception as e:
        return {"error": str(e)}


# Create a route to summarize events for a user by date and time
@app.post("/summarize_events_by_date_and_time/")
async def summarize_events_by_date_and_time(user_request: UserRequest):
    user_id = user_request.user_id
    try:
        # Retrieve data from DynamoDB for the specified user_id and EventType "Event"
        response = table.scan(
            FilterExpression=Attr("UserId").eq(user_id) & Attr("EventType").eq("Event")
        )
        items = response.get("Items", [])

        if not items:
            return {
                "message": f"No events found for user with UserId: {user_id}",
                "event_summary_by_date_and_time": {},
            }

        # Initialize a dictionary to store events by date and time
        event_summary_by_date_and_time = {}

        for item in items:
            # Extract event information
            event_id = item.get("EventId", "")
            event_title = item.get("Title", "")
            start_datetime_str = item.get("StartDatetime", "")
            end_datetime_str = item.get("EndDatetime", "")

            # Convert the datetime strings to datetime objects
            start_datetime = datetime.strptime(start_datetime_str, "%Y-%m-%d %H:%M:%S")
            end_datetime = datetime.strptime(end_datetime_str, "%Y-%m-%d %H:%M:%S")

            # Get the date as a string in the format YYYY-MM-DD
            event_date = start_datetime.date().strftime("%Y-%m-%d")

            # Create or update the summary for the date and time
            if event_date not in event_summary_by_date_and_time:
                event_summary_by_date_and_time[event_date] = []

            event_summary_by_date_and_time[event_date].append(
                {
                    "event_id": event_id,
                    "event_title": event_title,
                    "start_datetime": start_datetime_str,
                    "end_datetime": end_datetime_str,
                }
            )

        # Sort events within each date by start_datetime
        for date, events in event_summary_by_date_and_time.items():
            event_summary_by_date_and_time[date] = sorted(
                events, key=lambda x: x["start_datetime"]
            )

        # Prepare the request to summarize the events by date and time using Semantic Kernel
        prompt = f"""Please provide a summary of my schedule by date and time, for UserId: {user_id}
        
        {event_summary_by_date_and_time}
        """

        # Use Semantic Kernel to generate the summary
        summarize = kernel.create_semantic_function(
            prompt, max_tokens=2000, temperature=0.2, top_p=0.1
        )
        summary = summarize(prompt)

        return {
            "event_summary_by_date_and_time": event_summary_by_date_and_time,
            "summary": summary,
        }

    except Exception as e:
        return {"error": str(e)}


# FastAPI 앱을 Uvicorn을 사용하여 실행합니다.
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)