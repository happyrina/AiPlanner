import uvicorn
import boto3
import json
import os
import logging

from decimal import Decimal
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Response, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# DynamoDB 연결
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')

# 테이블 이름
table_name = 'events'

# 테이블 존재 여부 확인
if table_name not in [table.name for table in dynamodb.tables.all()]:
    # 테이블이 존재하지 않으면 테이블 생성
    table = dynamodb.create_table(
        TableName=table_name,
        KeySchema=[
            {
                'AttributeName': 'title',
                'KeyType': 'HASH'  # Partition Key로 설정 (단일 속성 키)
            }
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'title',
                'AttributeType': 'S'  # 'title' 속성의 데이터 타입 (S: 문자열, N: 숫자 등)
            }
        ],
        ProvisionedThroughput={
            'ReadCapacityUnits': 5,
            'WriteCapacityUnits': 5
        }
    )
    # 테이블이 생성될 때까지 기다립니다.
    table.meta.client.get_waiter('table_exists').wait(TableName=table_name)
else:
    # 테이블이 존재하면 해당 테이블을 사용합니다.
    table = dynamodb.Table(table_name)

app = FastAPI()
app.mount("/static", StaticFiles(directory="./"), name="static")
templates = Jinja2Templates(directory="./")

class Item(BaseModel):
    title: str
    year: int
    month: int
    start_day: int
    end_day: int
    goal: str
    place: str
    content: str

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse("main2.html", {"request": request})
 

@app.post("/event_add", response_model=Item)
async def create_event(item: Item):
    # Extract data from the item
    title = item.title.strip()  # title 앞뒤 공백 제거

    # Check if the title is empty
    if not title:
        alert_message = "제목을 입력하세요."
        return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

    # Check if the event with the same title already exists
    existing_event = table.get_item(Key={'title': title}).get('Item')
    if existing_event:
        # Event with the same title already exists, show error message
        alert_message = f"이미 '{title}' 이벤트가 존재합니다. 이름을 수정하세요."
        return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

    year = item.year
    month = item.month
    start_day = item.start_day
    end_day = item.end_day
    goal = item.goal
    place = item.place
    content = item.content
    
    # Save data to DynamoDB table
    table.put_item(
        Item={
            'title': title,
            'year': year,
            'month': month,
            'start_day': start_day,
            'end_day': end_day,
            'goal': goal,
            'place': place,
            'content': content
        }
    )
    
    alert_message = "저장되었습니다"
    return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

@app.get("/get_all_events/")
async def get_all_events():
    try:
        response = table.scan()
        events = response.get('Items', [])

        if not events:
            return JSONResponse(content={"message": "이벤트가 존재하지 않습니다."})

        # Decimal 값을 float로 변환하여 JSON으로 직렬화
        events_json = json.dumps(events, default=float)
        return JSONResponse(content="application/json; charset=utf-8")
    except Exception as e:
        logging.exception("Error occurred while fetching events.")
        return JSONResponse(content={"error": "서버에서 이벤트 데이터를 가져오는 중에 오류가 발생했습니다."})


@app.get("/get_one_event/")
async def get_one_event(title: str):
    # Query the DynamoDB table to get the event with the specified title
    response = table.get_item(Key={'title': title})

    # Extract the event data from the response
    event = response.get('Item')

    if not event:
        return Response(content="<script>alert('이벤트가 존재하지 않습니다.');</script>", media_type="text/html")

    return event

@app.delete("/delete_event/")
async def delete_event(title: str):
    if not title:
        # If title is empty, return an error response
        return Response(content="<script>alert('Title명을 입력해주세요.');</script>", media_type="text/html")

    # Query the DynamoDB table to get the event with the specified title
    response = table.get_item(Key={'title': title})

    # Extract the event data from the response
    event = response.get('Item')

    if not event:
        return Response(content="<script>alert('이벤트가 존재하지 않습니다.');</script>", media_type="text/html")

    # Confirmation message before deletion
    confirm_message = f"정말로 '{title}' 여행을 삭제하시겠습니까?"
    return JSONResponse(content={"message": confirm_message})

@app.delete("/confirm_delete_event/")
async def confirm_delete_event(title: str):
    # Query the DynamoDB table to get the event with the specified title
    response = table.get_item(Key={'title': title})

    # Extract the event data from the response
    event = response.get('Item')

    if not event:
        return Response(content="<script>alert('이벤트가 존재하지 않습니다.');</script>", media_type="text/html")

    # Delete the event from the DynamoDB table
    try:
        table.delete_item(Key={'title': title})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete the event: {str(e)}")

    alert_message = f"'{title}' 이벤트가 삭제되었습니다."
    return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

@app.get("/update_event/{title}", response_class=HTMLResponse)
async def update_event_page(title: str, request: Request):
    # Query the DynamoDB table to get the event with the specified title
    response = table.get_item(Key={'title': title})
    event = response.get('Item')
    return templates.TemplateResponse("update_event.html", {"request": request, "event": event})

@app.post("/update_event/{title}", response_class=HTMLResponse)
async def update_event(title: str, item: Item):
    # Query the DynamoDB table to get the event with the specified title
    response = table.get_item(Key={'title': title})
    existing_event = response.get('Item')

    if not existing_event:
        return Response(content="<script>alert('이벤트가 존재하지 않습니다.');</script>", media_type="text/html")

    # Extract data from the item
    updated_title = item.title.strip()  # title 앞뒤 공백 제거

    # Check if the title is empty
    if not updated_title:
        alert_message = "제목을 입력하세요."
        return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

    # Check if the updated title conflicts with an existing event
    if updated_title != title:
        existing_event_with_updated_title = table.get_item(Key={'title': updated_title}).get('Item')
        if existing_event_with_updated_title:
            # Event with the updated title already exists, show error message
            alert_message = f"이미 '{updated_title}' 이벤트가 존재합니다. 이름을 수정하세요."
            return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

    # Update data in the DynamoDB table
    table.update_item(
        Key={'title': title},
        UpdateExpression='SET #t = :updated_title, #yr = :year, #mo = :month, start_day = :start_day, '
                         'end_day = :end_day, goal = :goal, place = :place, content = :content',
        ExpressionAttributeNames={
            '#t': 'title',
            '#yr': 'year',
            '#mo': 'month'
        },
        ExpressionAttributeValues={
            ':updated_title': updated_title,
            ':year': item.year,
            ':month': item.month,
            ':start_day': item.start_day,
            ':end_day': item.end_day,
            ':goal': item.goal,
            ':place': item.place,
            ':content': item.content
        }
    )

    alert_message = "이벤트가 업데이트되었습니다."
    return Response(content=f"<script>alert('{alert_message}');</script>", media_type="text/html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
