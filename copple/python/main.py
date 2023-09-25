# FastAPI, Pydantic 및 필요한 모듈을 가져오기
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

# FastAPI 애플리케이션 초기화
app = FastAPI()

# Semantic Kernel 초기화 및 커넥터 구성
kernel = sk.Kernel()
useAzureOpenAI = False  # Azure OpenAI 서비스를 사용할지 여부 설정

# Azure OpenAI 서비스를 사용하려면 커넥터 설정
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

# AWS DynamoDB 리소스 초기화
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
table_name = "Event"
table = dynamodb.Table(table_name)


# 요청 데이터를 처리하기 위한 Pydantic 모델 생성
class UserRequest(BaseModel):
    user_id: str


# 사용자의 플랜을 요약하는 API
@app.post("/summarize_plan")
async def summarize_plan(user_request: UserRequest):
    user_id = user_request.user_id
    try:
        # 지정된 user_id로 DynamoDB에서 데이터 가져오기
        response = table.scan(FilterExpression=Attr("UserId").eq(user_id))
        items = response.get("Items", [])

        if not items:
            # 이벤트가 없으면 Semantic Kernel을 사용하여 추천 생성
            recommendation_prompt = f"UserId가 {user_id}인 사용자에 대한 이벤트를 추천합니다"
            generate_recommendation = kernel.create_semantic_function(
                recommendation_prompt, max_tokens=2000, temperature=0.2, top_p=0.1
            )
            recommendation = generate_recommendation("")

            return {
                "message": f"UserId가 {user_id}인 사용자에 대한 이벤트를 찾을 수 없습니다",
                "recommendation": recommendation,
            }

        # DynamoDB 항목에서 이벤트 설명 추출
        event_texts = [item.get("Content", "") for item in items]

        # 이벤트 텍스트를 하나의 문서로 연결
        all_event_text = "\n".join(event_texts)

        # Semantic Kernel을 사용하여 이벤트 요약
        prompt = f"""UserId: {user_id}에 대한 이벤트를 다음 내용으로 요약합니다:
        {all_event_text}
        """
        summarize = kernel.create_semantic_function(
            prompt, max_tokens=2000, temperature=0.2, top_p=0.1
        )
        summary = summarize(all_event_text)
        return {"summarize_plan": summary}

    except Exception as e:
        return {"error": str(e)}


class UserInput(BaseModel):
    user_id: str
    input_text: str
    
    
@app.post("/process_user_input")
async def process_user_input(user_input: UserInput):
    user_id = user_input.user_id
    input_text = user_input.input_text

    try:
        # Use Semantic Kernel to understand the user's intent from the input text
        intent_extraction_prompt = f"Extract intent from user input: {input_text}"
        extract_intent = kernel.create_semantic_function(
            intent_extraction_prompt, max_tokens=200, temperature=0.2, top_p=0.1
        )
        intent = extract_intent(input_text)

        # Depending on the intent, you can perform different actions
        if "bank" in intent():
            # If the intent suggests something related to the bank, add it to a to-do list
            # You can define your logic here for adding tasks to the to-do list
            # For now, let's assume you have a DynamoDB table for tasks
            task_table_name = "Todo"
            task_table = dynamodb.Table(task_table_name)

            # Add the task to the DynamoDB table
            task_response = task_table.put_item(
                Item={
                    "UserId": user_id,
                    "Task": f"Go to the bank: {input_text}",
                }
            )

            return {
                "message": "Task added to the to-do list",
                "intent": intent,
            }
        else:
            return {
                "message": "Intent not recognized or no action needed",
                "intent": intent,
            }

    except Exception as e:
        return {"error": str(e)}
    
# uvicorn main:app --port=8000 --host=0.0.0.0 --reload