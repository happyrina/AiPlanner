const express = require('express'); // express 모듈 가져오기
const { v4: uuidv4 } = require('uuid'); // uuid 모듈 가져오기 (고유 식별자 생성)
const jwt = require('jsonwebtoken'); // jsonwebtoken 모듈 가져오기 (JWT 토큰 사용)
const AWS = require('aws-sdk'); // AWS SDK 모듈 가져오기
const cookieParser = require('cookie-parser'); // cookie-parser 모듈 가져오기
const path = require('path'); // path 모듈 가져오기 (파일 경로 조작)
const { OpenAIApi } = require('openai'); // OpenAI API 모듈 가져오기

const app = express(); // Express 애플리케이션 생성

// 쿠키 파서 및 다른 미들웨어 설정
app.use(express.json()); // JSON 요청 파싱
app.use(cookieParser()); // 쿠키 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩된 요청 파싱
app.use(express.static(path.join(__dirname, 'public'))); // 정적 파일 서비스 설정


// OpenAI API 키를 이용하여 클라이언트 생성
const openai = new OpenAIApi({
  key: ""
});

// 챗봇과 상호 작용하는 함수 구현
async function interactWithChatbot(chatbotInput) {
  const { UserId, Title, Interest, StartDate, EventId, CompanionType, Destination, EndDate } = chatbotInput;

  // GPT-3 API를 호출하여 챗봇 응답 생성
  const prompt = `UserId: ${UserId}
Title: ${Title}
Interest: ${Interest.join(', ')}
StartDate: ${StartDate}
EventId: ${EventId}
CompanionType: ${CompanionType}
Destination: ${Destination}
EndDate: ${EndDate}

User: `;

  try {
    const response = await openai.complete({
      prompt,
      max_tokens: 50, // 원하는 응답 토큰 개수로 수정
    });

    return response.choices[0].text.trim();
  } catch (error) {
    console.error('An error occurred while interacting with the chatbot:', error);
    return '챗봇과 상호 작용 중에 오류가 발생했습니다.';
  }
}


// POST 엔드포인트 "/chatbot"
app.post("/chatbot", requireLogin, async (req, res) => {
  const user = req.user; // JWT 토큰에서 사용자 세부 정보 가져오기

  // 사용자가 입력한 이벤트 데이터를 가져오기
  const { UserId, Title, Interest, StartDate, EventId, CompanionType, Destination, EndDate } = req.body;

  // chatbotInput에 사용자가 입력한 이벤트 데이터 할당
  const chatbotInput = {
    UserId,
    Title,
    Interest: Array.from(Interest), // Set을 Array로 변환
    StartDate,
    EventId,
    CompanionType,
    Destination,
    EndDate,
  };

  // chatbotInput을 사용하여 챗봇과 상호 작용하는 함수 호출
  const chatbotResponse = await interactWithChatbot(chatbotInput);

  // GPT-3에게 어떤 도움이 필요한지 묻는 프롬프트 생성
  const gpt3Prompt = `사용자가 입력한 이벤트 데이터:
UserId: ${UserId}
Title: ${Title}
Interest: ${Interest.join(', ')}
StartDate: ${StartDate}
EventId: ${EventId}
CompanionType: ${CompanionType}
Destination: ${Destination}
EndDate: ${EndDate}

어떤 도움이 필요하십니까?`;

  try {
    const gpt3Response = await interactWithChatbot({ UserId, Title, Interest, StartDate, EventId, CompanionType, Destination, EndDate, User: gpt3Prompt });

    return res.json({ chatbotResponse, gpt3Response });
  } catch (error) {
    console.error('An error occurred while interacting with GPT-3:', error);
    return res.status(500).json({ detail: "GPT-3와의 상호작용 중에 오류가 발생했습니다." });
  }
});


app.get("/", (req, res) => {
  // 로그인 전적 확인
  const cookies = req.headers.cookie;
  console.log(req.headers)
  if (cookies && cookies.includes("token")) {
    // Redirect the logged-in user to the main dashboard
    return res.redirect("/mypage");
  }

  res.sendFile(path.join(__dirname, "../public/index.html"))
});


app.get("/chatbot", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chatbot.html'));
});

module.exports = app; // 애플리케이션 모듈로 내보내기
