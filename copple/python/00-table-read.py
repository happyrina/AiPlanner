from fastapi import FastAPI, HTTPException, Path
from typing import List
import boto3
from boto3.dynamodb.conditions import Attr
import semantic_kernel as sk
from semantic_kernel.connectors.ai.open_ai import AzureTextCompletion, OpenAITextCompletion

app = FastAPI()
kernel = sk.Kernel()
useAzureOpenAI = False

# 커넥터를 구성합니다. Azure AI OpenAI를 사용하는 경우, 설정을 가져오고 커넥터를 추가합니다.
if useAzureOpenAI:
    deployment, api_key, endpoint = sk.azure_openai_settings_from_dot_env()
    kernel.add_text_completion_service("dv", AzureTextCompletion(deployment, endpoint, api_key))
else:
    # OpenAI 설정을 가져오고 커넥터를 추가합니다.
    api_key, org_id = sk.openai_settings_from_dot_env()
    kernel.add_text_completion_service("dv", OpenAITextCompletion("text-davinci-003", api_key, org_id))
    
    
# AWS DynamoDB 리소스를 생성합니다.
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')
# 테이블 이름을 설정합니다.
table_name = 'Event'
# DynamoDB 테이블을 가져옵니다.
table = dynamodb.Table(table_name)


@app.get("/get_events", response_model=List[dict])
def get_accounts():
    try:
        # DynamoDB 스캔을 사용하여 테이블의 모든 데이터를 가져옵니다.
        response = table.scan()
        items = response.get('Items', [])
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/get_events/{user_id}", response_model=List[dict])
def get_events_by_user_id(user_id: str = Path(..., description="User ID to filter events")):
    try:
        # DynamoDB 스캔을 사용하여 user_id를 기반으로 일정을 필터링합니다.
        response = table.scan(
            FilterExpression=Attr('UserId').eq(user_id)
        )
        items = response.get('Items', [])
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

    
    

    
    




