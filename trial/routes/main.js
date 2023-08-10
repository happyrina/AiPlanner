// // main.js
// const express = require('express');
// const { v4: uuidv4 } = require('uuid');
// const AWS = require('aws-sdk');
// const cookieParser = require('cookie-parser');
// const session = require('express-session');
// const MemoryStore = require('memorystore')(session);
// const router = express.Router();

// router.use(express.json());
// router.use(express.urlencoded({ extended: true }));
// router.use(cookieParser());

// // Serve static files from the "public" folder
// router.use(express.static(__dirname + "/public"));

// // AWS DynamoDB 연결 설정
// const dynamodb = new AWS.DynamoDB({ region: 'ap-northeast-2' });
// const tableName = 'Account'; // 사용자 정보를 저장할 테이블 이름

// // 세션 미들웨어 설정
// router.use(session({
//   secret: 'your-secret-key',
//   resave: false,
//   saveUninitialized: true,
//   store: new MemoryStore({
//     checkPeriod: 86400000 // 세션 만료 체크 주기 (1일)
//   }),
// }));

// // 로그인 세션을 저장하는 딕셔너리 선언
// const sessions = {};

// // 사용자 아이디가 이미 존재하는지 확인하는 함수
// async function isUserExists(userId) {
//   const params = {
//     TableName: tableName,
//     KeyConditionExpression: 'UserId = :id',
//     ExpressionAttributeValues: { ':id': { S: userId } },
//   };

//   try {
//     const response = await dynamodb.query(params).promise();
//     return response.Items.length > 0;
//   } catch (error) {
//     console.error('사용자 존재 여부 확인 오류:', error);
//     return false;
//   }
// }

// // 사용자 아이디와 비밀번호가 유효한지 확인하는 함수
// async function isValidPassword(userId, userName, password) {
//   const params = {
//     TableName: tableName,
//     Key: {
//       'UserId': { S: userId },
//       'UserName': { S: userName },
//     },
//   };

//   const response = await dynamodb.getItem(params).promise();
//   const item = response.Item;
//   return item && item.Password.S === password;
// }

// // 미들웨어 함수 - 세션 인증
// function requireAuth(req, res, next) {
//   const session_id = req.cookies.session_id;
//   if (session_id && sessions.hasOwnProperty(session_id)) {
//     // 세션 ID가 세션 딕셔너리에 존재하면 인증 성공
//     next();
//   } else {
//     // 세션 ID가 존재하지 않으면 인증 실패
//     return res.status(401).json({ detail: "로그인 후에 일정을 생성할 수 있습니다." });
//   }
// }

// // 로그인 페이지
// router.get("/", (req, res) => {
//   // Assuming login.html is in the "public" folder
//   res.sendFile("login.html", { root: __dirname + "/public" });
// });

// // 로그인 처리
// router.post("/login/", async (req, res) => {
//   const { user_id, user_name, password } = req.body;

//   if (!password) {
//     return res.status(400).json({ detail: "비밀번호가 필요합니다." });
//   }

//   try {
//     if (await isValidPassword(user_id, user_name, password)) {
//       // 세션 ID 생성 (uuidv4 사용)
//       const session_id = uuidv4();

//       // 세션 ID를 세션 딕셔너리에 저장
//       sessions[session_id] = { user_id, user_name };

//       // 세션 ID를 쿠키로 설정 (클라이언트로 전달)
//       res.cookie("session_id", session_id, { httpOnly: true, secure: false });

//       return res.json({ message: "로그인 성공" });
//     } else {
//       return res.status(401).json({ detail: "비밀번호를 확인하세요." });
//     }
//   } catch (error) {
//     console.error('필수 입력 사항을 확인하세요:', error);
//     return res.status(500).json({ detail: "필수 필드를 확인하세요." });
//   }
// });

// // 로그아웃 처리
// router.post("/logout/", (req, res) => {
//   const session_id = req.cookies.session_id;

//   // 세션 ID가 세션 딕셔너리에 있는지 확인
//   if (session_id && sessions.hasOwnProperty(session_id)) {
//     // 세션 ID를 세션 딕셔너리에서 제거
//     delete sessions[session_id];
//   }
//   // 응답에서 세션 ID 쿠키 삭제
//   res.clearCookie("session_id");
//   return res.json({ message: "로그아웃 성공" });
// });

// // 회원 가입 처리
// router.post("/signup", async (req, res) => {
//   const { user_id, user_name, password, passwordcheck } = req.body;

//   if (await isUserExists(user_id)) {
//     return res.status(400).json({ detail: "이미 존재하는 사용자입니다." });
//   }

//   if (password !== passwordcheck) {
//     return res.status(400).json({ detail: "비밀번호와 비밀번호 확인이 일치하지 않습니다." });
//   }

//   const user_uuid = uuidv4();

//   const params = {
//     TableName: tableName,
//     Item: {
//       'UserId': { S: user_id },
//       'UserName': { S: user_name },
//       'Password': { S: password },
//       'PasswordCheck': { S: passwordcheck },
//       'UUID': { S: user_uuid },
//     },
//   };

//   try {
//     await dynamodb.putItem(params).promise();
//     return res.json({ message: "회원 가입 완료", user_uuid: user_uuid });
//   } catch (error) {
//     console.error('사용자 등록 오류:', error);
//     return res.status(500).json({ detail: "회원 가입 실패" });
//   }
// });

// // 일정 정보를 저장하는 딕셔너리 선언
// const events = {};

// // 일정 생성
// router.post("/create-event/", requireAuth, (req, res) => {
//   const session_id = req.cookies.session_id;
//   const { destination, start_date, end_date, companion_type, interests } = req.body;

//   // 로그인한 사용자만 이벤트를 생성할 수 있도록 세션 인증 확인
//   if (session_id && sessions.hasOwnProperty(session_id)) {
//     const user_id = sessions[session_id].user_id;

//     // Generate a new UUID for the event
//     const event_uuid = uuidv4();

//     // Save event information in the dictionary
//     events[event_uuid] = {
//       event_uuid,
//       user_id,
//       destination,
//       start_date,
//       end_date,
//       companion_type,
//       interests,
//     };

//     return res.json({ message: "일정 생성 완료", event_uuid });
//   } else {
//     return res.status(401).json({ detail: "로그인 후에 일정을 생성할 수 있습니다." });
//   }
// });

// // 일정 조회
// router.get("/events/:eventId", requireAuth, (req, res) => {
//   const { eventId } = req.params;
//   const event = events[eventId];

//   if (event) {
//     // Check if the logged-in user is the owner of the event
//     const session_id = req.cookies.session_id;
//     if (session_id && sessions.hasOwnProperty(session_id)) {
//       const user_id = sessions[session_id].user_id;
//       if (event.user_id === user_id) {
//         return res.json(event);
//       } else {
//         return res.status(403).json({ detail: "일정을 조회할 권한이 없습니다." });
//       }
//     } else {
//       return res.status(401).json({ detail: "로그인 후에 일정을 조회할 수 있습니다." });
//     }
//   } else {
//     return res.status(404).json({ detail: "일정을 찾을 수 없습니다." });
//   }
// });

// // 일정 수정
// router.put("/events/:eventId", requireAuth, (req, res) => {
//   const { eventId } = req.params;
//   const session_id = req.cookies.session_id;

//   if (session_id && sessions.hasOwnProperty(session_id)) {
//     const user_id = sessions[session_id].user_id;
//     const event = events[eventId];

//     if (event) {
//       if (event.user_id === user_id) {
//         // 이 부분에 일정 수정 로직 구현 (예: events 딕셔너리에서 해당 이벤트 수정)
//         // 예시: events[eventId].destination = req.body.destination;
//         //       events[eventId].start_date = req.body.start_date;
//         //       events[eventId].end_date = req.body.end_date;
//         //       events[eventId].companion_type = req.body.companion_type;
//         //       events[eventId].interests = req.body.interests;

//         return res.json({ message: "일정 수정 완료" });
//       } else {
//         return res.status(403).json({ detail: "일정을 수정할 권한이 없습니다." });
//       }
//     } else {
//       return res.status(404).json({ detail: "일정을 찾을 수 없습니다." });
//     }
//   } else {
//     return res.status(401).json({ detail: "로그인 후에 일정을 수정할 수 있습니다." });
//   }
// });

// // 일정 삭제
// router.delete("/events/:eventId", requireAuth, (req, res) => {
//   const { eventId } = req.params;
//   const session_id = req.cookies.session_id;

//   if (session_id && sessions.hasOwnProperty(session_id)) {
//     const user_id = sessions[session_id].user_id;
//     const event = events[eventId];

//     if (event) {
//       if (event.user_id === user_id) {
//         // 이 부분에 일정 삭제 로직 구현 (예: events 딕셔너리에서 해당 이벤트 삭제)
//         // 예시: delete events[eventId];

//         return res.json({ message: "일정 삭제 완료" });
//       } else {
//         return res.status(403).json({ detail: "일정을 삭제할 권한이 없습니다." });
//       }
//     } else {
//       return res.status(404).json({ detail: "일정을 찾을 수 없습니다." });
//     }
//   } else {
//     return res.status(401).json({ detail: "로그인 후에 일정을 삭제할 수 있습니다." });
//   }
// });

// module.exports = router;
const express = require('express');
const { v4: uuidv4 } = require('uuid'); // uuid 모듈을 불러오기
const jwt = require('jsonwebtoken'); // jsonwebtoken 모듈을 불러오기
const AWS = require('aws-sdk'); // AWS SDK 불러오기
const cookieParser = require('cookie-parser');
const path = require('path'); // cookie-parser 미들웨어 사용

const app = express();

// 쿠키 파서 및 기타 미들웨어 설정
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // 기본값: __dir -> __dirname

// AWS DynamoDB 설정
const dynamodb = new AWS.DynamoDB({ region: 'ap-northeast-2' });
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
    console.error('에러 발생:', error);
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

// "/login/" POST 엔드포인트 설정
app.post("/login", async (req, res) => {
  const { user_id, user_name, password } = req.body;

  if (!password) {
    return res.status(400).json({ detail: "응답이 없습니다." });
  }

  try {
    if (await isValidPassword(user_id, user_name, password)) {
      // JWT 토큰 생성 및 쿠키에 설정
      const token = jwt.sign({ user_id, user_name }, 'secret_key', { expiresIn: '1h' });
      res.cookie("token", token);

      // 로그인이 성공하면 index.html로 리다이렉트
      return res.redirect("/index");
    } else {
      return res.status(401).json({ detail: "잠금 상태입니다." });
    }
  } catch (error) {
    console.error('에러 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

// "/logout/" POST 엔드포인트 설정
app.post("/logout/", (req, res) => {
  // 사용자 로그아웃 처리: 응답에서 토큰 쿠키 삭제
  res.clearCookie("token");
  return res.json({ message: "로그아웃 성공" });
});

// "/signup" POST 엔드포인트 설정
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
    console.error('에러 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});


// 디버깅: 토큰이 제대로 수신되었는지 확인
function requireLogin(req, res, next) {
  const token = req.cookies.token;
  console.log("Token:", token); // 디버깅을 위해 이 줄을 추가합니다.

  if (!token) {
    return res.status(401).json({ detail: "인증되지 않았습니다 - 로그인이 필요합니다." });
  }

  try {
    const decoded = jwt.verify(token, 'secret_key'); // 기존 비밀 키 사용
    req.user = decoded;
    next();
  } catch (error) {
    console.error("토큰 검증 오류:", error); // 디버깅을 위해 이 줄을 추가합니다.
    return res.status(401).json({ detail: "인증되지 않았습니다 - 잘못된 토큰입니다." });
  }
}


// Debugging: Check if the main page route is being accessed
app.get("/mainpage", requireLogin, (req, res) => {
  console.log("Accessing main page"); // Add this line for debugging
  res.sendFile(path.join(__dirname, '../public/main.html'));
});

app.get("/loginpage", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get("/signuppage", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/signup.html'));
});

app.get("/index", requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});



module.exports = app;