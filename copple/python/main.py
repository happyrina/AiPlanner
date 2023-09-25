from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import openai
import os
from dotenv import load_dotenv

# .env 파일로부터 환경 변수 로드
load_dotenv()

app = FastAPI()

# 환경 변수에서 OpenAI API 키 가져오기
api_key = os.getenv("OPENAI_API_KEY")
openai.api_key = api_key

# 프롬프트 정의
prompt = """Bot: 어떻게 도와드릴까요?
User: {{$input}}
---------------------------------------------
당신은 입력을 목표(Goal), 이벤트(Event), 또는 할 일(To-Do)로 분류하는 분류기입니다:
목표(Goal): 특정 시간 프레임 내 또는 미정 기간 내에 달성하고자 하는 결과 또는 상태를 나타냅니다. 목표는 단기 또는 장기적일 수 있으며 개인적일 수도 있고 집단 또는 조직과 관련될 수 있습니다.
이벤트(Event): 특정 시간과 장소에서 발생하는 일 또는 행사를 나타냅니다. 시간은 매일 또는 매시간에 특별하게 설정됩니다.
할 일(To-Do): 완료해야 하는 작은 작업 또는 의무를 나타냅니다."""

# 입력을 분류하는 함수
def get_intent(input_text):
    response = openai.Completion.create(
        engine="text-davinci-002",
        prompt=f"{prompt}\nUser: {input_text}\n",
        max_tokens=500,
        temperature=0.7,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        stop=None
    )
    return response.choices[0].text.strip()

# 요청과 응답을 위한 Pydantic 모델 정의
class InputRequest(BaseModel):
    input: str

class ClassificationResponse(BaseModel):
    classification: str

# 분류를 위한 엔드포인트 생성
@app.post("/classify")
async def classify(input_request: InputRequest):
    input_text = input_request.input
    result = get_intent(input_text)
    return {"classification": result}

