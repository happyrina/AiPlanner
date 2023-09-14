const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({ region: 'ap-northeast-2' });
const cookieParser = require('cookie-parser');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const dynamodb = new DynamoDBClient({ region: 'ap-northeast-2' });
const tableName = 'Account';

async function isUserExists(userId) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'UserId = :id',
    ExpressionAttributeValues: { ':id': { S: userId } },
  };

  try {
    const command = new QueryCommand(params);
    const response = await dynamodb.send(command);
    return response.Items.length > 0;
  } catch (error) {
    console.error('오류 발생:', error);
    return false;
  }
}

async function isUserNameExists(userName) {
  const params = {
    TableName: tableName,
    FilterExpression: 'UserName = :name',
    ExpressionAttributeValues: { ':name': { S: userName } },
  };

  try {
    const command = new QueryCommand(params);
    const response = await dynamodb.send(command);
    return response.Items.length > 0;
  } catch (error) {
    console.error('오류 발생:', error);
    return false;
  }
}

function requireLogin(req, res, next) {
  const token = req.cookies.token;
  console.log("토큰:", token);

  if (!token) {
    return res.status(401).json({ detail: "인증되지 않았습니다 - 로그인이 필요합니다." });
  }

  try {
    const decoded = jwt.verify(token, 'secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error("토큰 확인 오류:", error);
    return res.status(401).json({ detail: "인증되지 않았습니다 - 잘못된 토큰입니다." });
  }
}

app.post("/account/login", async (req, res) => {
  const { user_id, password } = req.body;
  const data = [user_id, password];
  console.log("사용자 ID를 사용하여 로그인 요청 받음:", user_id);

  if (!password) {
    return res.status(400).json({ detail: "패스워드를 입력하세요." });
  }

  try {
    const userExists = await isUserExists(user_id);

    console.log("사용자 존재 여부:", userExists);

    if (!userExists) {
      return res.status(401).json({ detail: "사용자를 찾을 수 없습니다." });
    }

    const token = jwt.sign({ user_id }, 'secret_key', { expiresIn: '1h' });
    res.cookie("token", token);

    return res.json(data);
  } catch (error) {
    console.error('오류 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

app.post("/account/logout", requireLogin, (req, res) => {
  res.clearCookie("token");
  res.clearCookie("eventData");
  return res.json({ message: "로그아웃 성공" });
});

app.post("/account/signup", async (req, res) => {
  const { user_id, user_name, password, passwordcheck } = req.body;

  if (await isUserExists(user_id)) {
    return res.status(400).json({ detail: "이미 존재하는 사용자 ID입니다." });
  }

  if (await isUserNameExists(user_name)) {
    return res.status(400).json({ detail: "이미 사용 중인 사용자 이름입니다." });
  }

  if (password !== passwordcheck) {
    return res.status(400).json({ detail: "패스워드가 일치하지 않습니다." });
  }

  const user_uuid = uuidv4();

  const params = {
    TableName: tableName,
    Item: {
      'UserId': { S: user_id },
      'UserName': { S: user_name },
      'Password': { S: password },
      'PasswordCheck': { S: passwordcheck },
      'UUID': { S: user_uuid },
    },
  };

  try {
    const command = new PutItemCommand(params);
    await dynamodb.send(command);
    return res.json({ message: "사용자 등록 완료", user_uuid: user_uuid });
  } catch (error) {
    console.error('오류 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

app.post("/account/find/pw", async (req, res) => {
  const { user_id, user_name } = req.body;

  try {
    const params = {
      TableName: tableName,
      Key: {
        'UserId': { S: user_id },
        'UserName': { S: user_name },
      },
    };

    const command = new GetItemCommand(params);
    const response = await dynamodb.send(command);
    const userProfile = response.Item;

    if (!userProfile) {
      return res.status(404).json({ detail: "사용자를 찾을 수 없습니다." });
    }

    const newTemporaryPassword = generateTemporaryPassword();

    console.log("새로운 임시 패스워드:", newTemporaryPassword);

    const updateParams = {
      TableName: tableName,
      Key: {
        'UserId': { S: user_id },
        'UserName': { S: user_name },
      },
      UpdateExpression: 'SET Password = :password, PasswordCheck = :passwordCheck',
      ExpressionAttributeValues: {
        ':password': { S: newTemporaryPassword },
        ':passwordCheck': { S: newTemporaryPassword },
      },
    };

    const updateCommand = new UpdateItemCommand(updateParams);
    await dynamodb.send(updateCommand);

    return res.json({ message: "새로운 임시 패스워드가 발급되었습니다.", temporaryPassword: newTemporaryPassword });
  } catch (error) {
    console.error('패스워드 업데이트 중 오류 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

app.post("/account/find/id", async (req, res) => {
  const { user_id } = req.body;

  try {
    const params = {
      TableName: tableName,
      FilterExpression: 'UserId = :id',
      ExpressionAttributeValues: { ':id': { S: user_id } },
    };

    const command = new ScanCommand(params);
    const response = await dynamodb.send(command);
    const usersWithSameId = response.Items;

    if (usersWithSameId.length === 0) {
      return res.status(404).json({ detail: "해당 ID의 사용자가 없습니다." });
    }

    // 사용자 이름 반환
    const userNames = usersWithSameId.map(user => user.UserName.S);

    return res.json({ user_names: userNames });
  } catch (error) {
    console.error('오류 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

// 임시 비밀번호 생성 함수
function generateTemporaryPassword() {
// 랜덤 임시 비밀번호 생성 로직 구현
// 여기서는 간단한 임시 비밀번호 생성 로직 사용
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const temporaryPassword = Array.from({ length: 10 }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
return temporaryPassword;
}



module.exports = app;
