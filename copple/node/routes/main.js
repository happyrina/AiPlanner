const express = require('express'); // express 모듈 가져오기
const { v4: uuidv4 } = require('uuid'); // uuid 모듈 가져오기 (고유 식별자 생성)
const jwt = require('jsonwebtoken'); // jsonwebtoken 모듈 가져오기 (JWT 토큰 사용)
const AWS = require('aws-sdk'); // AWS SDK 모듈 가져오기
const cookieParser = require('cookie-parser'); // cookie-parser 모듈 가져오기
const path = require('path'); // path 모듈 가져오기 (파일 경로 조작)

const app = express(); // Express 애플리케이션 생성

// 쿠키 파서 및 다른 미들웨어 설정
app.use(express.json()); // JSON 요청 파싱
app.use(cookieParser()); // 쿠키 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩된 요청 파싱
app.use(express.static(path.join(__dirname, 'public'))); // 정적 파일 서비스 설정

// AWS DynamoDB 설정
const dynamodb = new AWS.DynamoDB({ region: 'ap-northeast-2' }); // AWS DynamoDB 인스턴스 생성
const tableName = 'Account'; // 사용자 정보를 저장할 테이블 이름

// 사용자 ID가 이미 존재하는지 확인하는 함수
async function isUserExists(userId) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'UserId = :id',
    ExpressionAttributeValues: { ':id': { S: userId } },
  };

  try {
    const response = await dynamodb.query(params).promise();
    return response.Items.length > 0;
  } catch (error) {
    console.error('An error occurred:', error);
    return false;
  }
}

// 사용자 ID와 비밀번호가 유효한지 확인하는 함수
async function isValidPassword(userId, userName, password) {
  const params = {
    TableName: tableName,
    Key: {
      'UserId': { S: userId },
      'UserName': { S: userName },
    },
  };

  const response = await dynamodb.getItem(params).promise();
  const item = response.Item;
  return item && item.Password.S === password;
}

// POST 엔드포인트 "/login/"
app.post("/login", async (req, res) => {
  const { user_id, user_name, password } = req.body;

  if (!password) {
    return res.status(400).json({ detail: "응답 없음." });
  }

  try {
    if (await isValidPassword(user_id, user_name, password)) {
      // JWT 토큰 생성 및 쿠키에 설정
      const token = jwt.sign({ user_id, user_name }, 'secret_key', { expiresIn: '1h' });
      res.cookie("token", token);

      return res.json({ message: "로그인 성공" });
    } else {
      return res.status(401).json({ detail: "잠김 상태." });
    }
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

// POST 엔드포인트 "/logout/"
app.post("/logout/", (req, res) => {
  // 사용자 로그아웃 처리: 응답에서 토큰 쿠키 삭제
  res.clearCookie("token");
  return res.json({ message: "로그아웃 성공" });
});

// POST 엔드포인트 "/signup"
app.post("/signup", async (req, res) => {
  const { user_id, user_name, password, passwordcheck } = req.body;

  if (await isUserExists(user_id)) {
    return res.status(400).json({ detail: "이미 존재하는 사용자 ID입니다." });
  }

  if (password !== passwordcheck) {
    return res.status(400).json({ detail: "비밀번호가 일치하지 않습니다." });
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
    await dynamodb.putItem(params).promise();
    return res.json({ message: "사용자 등록 완료", user_uuid: user_uuid });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

// 디버깅: 토큰이 올바르게 수신되었는지 확인
function requireLogin(req, res, next) {
  const token = req.cookies.token;
  console.log("Token:", token); // 디버깅을 위해 추가

  if (!token) {
    return res.status(401).json({ detail: "인증되지 않았습니다 - 로그인이 필요합니다." });
  }

  try {
    const decoded = jwt.verify(token, 'secret_key'); // 기존 비밀 키 사용
    req.user = decoded;
    next();
  } catch (error) {
    console.error("토큰 유효성 검사 오류:", error); // 디버깅을 위해 추가
    return res.status(401).json({ detail: "인증되지 않았습니다 - 잘못된 토큰입니다." });
  }
}

// 새로운 POST 엔드포인트 "/create-event"
app.post("/create-event", requireLogin, async (req, res) => {
  const user = req.user; // JWT 토큰에서 사용자 세부 정보 가져오기

  const { destination, start_date, end_date, companion_type, interest } = req.body;

  // 고유한 이벤트 ID 생성
  const event_id = uuidv4();

  // Interest 속성을 배열로 변환
  const interestArray = Array.isArray(interest) ? interest : [interest];
  const destinationArray = Array.isArray(destination) ? destination : [destination];
  // 데이터베이스에 저장할 항목 준비
  const params = {
    TableName: 'Event', // 이벤트용 테이블 이름으로 변경
    Item: {
      'EventId': { S: event_id },
      'UserId': { S: user.user_id }, // JWT 토큰에서 사용자 ID 저장
      'Title': { S: '이벤트 제목' }, // 제목 속성 추가
      'Destination': { SS: destinationArray }, // 배열로 저장
      'StartDate': { S: start_date },
      'EndDate': { S: end_date },
      'CompanionType': { S: companion_type },
      'Interest': { SS: interestArray }, // 배열로 저장
    },
  };

  try {
    await dynamodb.putItem(params).promise();
    return res.json({ message: "이벤트가 성공적으로 생성되었습니다.", event_id: event_id });
  } catch (error) {
    console.error('An error occurred:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});


app.get("/mainpage", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/main.html'));
});

app.get("/loginpage", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get("/signuppage", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/signup.html'));
});

module.exports = app; // 애플리케이션 모듈로 내보내기
