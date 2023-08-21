from fastapi import FastAPI, HTTPException, Form
import boto3
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import uuid

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# AWS DynamoDB 리소스를 생성합니다.
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')
# 테이블 이름을 설정합니다.
table_name = 'Account'
# DynamoDB 테이블을 가져옵니다.
table = dynamodb.Table(table_name)

# "/" 경로에 대한 GET 요청 처리 함수입니다. HTML 파일을 반환합니다.
@app.get("/", response_class=HTMLResponse)
def read_root():
    return open("static/signup.html").read()

# 사용자 아이디가 이미 존재하는지 확인하는 함수입니다.
def is_user_exists(user_id):
    response = table.query(
        KeyConditionExpression='UserId = :id',
        ExpressionAttributeValues={':id': user_id}
    )
    return 'Items' in response and len(response['Items']) > 0

# 사용자 아이디와 비밀번호가 유효한지 확인하는 함수입니다.
def is_valid_password(user_id, user_name, password):
    response = table.get_item(
        Key={
            'UserId': user_id,
            'UserName': user_name
        }
    )
    item = response.get('Item')
    return item and item.get('Password') == password

# "/login/" 경로에 대한 POST 요청 처리 함수입니다.
@app.post("/login/")
def login(user_id: str, user_name: str, password: str):
    # is_valid_password 함수를 사용하여 사용자가 제공한 정보가 유효한지 확인합니다.
    if is_valid_password(user_id, user_name, password):
        return {"message": "로그인 성공"}
    else:
        # 유효하지 않은 경우 HTTP 401 에러를 반환합니다.
        raise HTTPException(status_code=401, detail="로그인 실패")

# "/logout/" 경로에 대한 POST 요청 처리 함수입니다.
@app.post("/logout/")
def logout():
    return {"message": "로그아웃 성공"}

# 회원가입에 필요한 데이터를 담는 Pydantic 모델입니다.
# class SignupData(BaseModel):
#     user_id: str
#     user_name: str
#     password: str
#     passwordcheck: str

# "/signup/" 경로에 대한 POST 요청 처리 함수입니다.
@app.post("/signup")
def signup(user_id: str = Form(...), user_name: str = Form(...), password: str = Form(...), passwordcheck: str = Form(...)):
    if is_user_exists(user_id):
        raise HTTPException(status_code=400, detail="This user already exists.")

    # Generate a new UUID for the user
    user_uuid = str(uuid.uuid4())

    item = {
        'UserId': user_id,
        'UserName': user_name,
        'Password': password,
        'PasswordCheck': passwordcheck,
        'UUID': user_uuid  # Include the UUID in the item
    }
    # Register user information in the table
    table.put_item(Item=item)
    return {"message": "Registration completed.", "user_uuid": user_uuid}

