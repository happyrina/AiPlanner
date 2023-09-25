from fastapi import FastAPI, HTTPException, Form, Response, Cookie
import boto3
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import uuid

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create AWS DynamoDB resources.
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')
# Set the table name.
table_name = 'Account'
# Import the DynamoDB table.
table = dynamodb.Table(table_name)

# This dictionary will be used to store session information.
sessions = {}

# GET request processing function for the "/" path. Returns an HTML file.
@app.get("/", response_class=HTMLResponse)
def read_root():
    return open("static/signup.html").read()

# This function checks if the user ID already exists.
def is_user_exists(user_id):
    response = table.query(
        KeyConditionExpression='UserId = :id',
        ExpressionAttributeValues={':id': user_id}
    )
    return 'Items' in response and len(response['Items']) > 0

# This function checks if the user ID and password are valid.
def is_valid_password(user_id, user_name, password):
    response = table.get_item(
        Key={
            'UserId': user_id,
            'UserName': user_name
        }
    )
    item = response.get('Item')
    return item and item.get('Password') == password

# POST request processing function for the path "/login/".
@app.post("/login/")
def login(user_id: str, user_name: str, password: str, response: Response):
    # Use the is_valid_password function to check if the information provided by the user is valid.
    if is_valid_password(user_id, user_name, password):
        # Generate a new UUID for the user session
        session_id = str(uuid.uuid4())
        # Store the session ID in the sessions dictionary
        sessions[session_id] = user_id
        # Set the session ID as a cookie in the response
        response.set_cookie(key="session_id", value=session_id)
        return {"message": "Login successful"}
    else:
        # If invalid, return HTTP 401 error.
        raise HTTPException(status_code=401, detail="Login failed")

# POST request processing function for the path "/logout/".
@app.post("/logout/")
def logout(response: Response, session_id: str = Cookie(None)):
    # Check if the session ID exists in the sessions dictionary
    if session_id in sessions:
        # Remove the session ID from the sessions dictionary
        sessions.pop(session_id)
    # Clear the session ID cookie in the response
    response.delete_cookie(key="session_id")
    return {"message": "Logout successful"}

# This is a Pydantic model that contains the data required for membership registration.
# class SignupData(BaseModel):
# user_id: str
# user_name: str
# password: str
# passwordcheck: str

# POST request processing function for the path "/signup/".
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
        'UUID': user_uuid # Include the UUID in the item
    }
    # Register user information in the table
    table.put_item(Item=item)
    return {"message": "Registration completed.", "user_uuid": user_uuid}

# ... Rest of the code ...
