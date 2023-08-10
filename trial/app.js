// const express = require('express');
// const app = express();
// const cookieParser = require('cookie-parser');
// const session = require('express-session');
// const path = require('path');

// // 기본 미들웨어 설정
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(express.static('public'));
// app.use(cookieParser());

// // 세션 미들웨어를 앱에 추가
// app.use(session({
//   secret: 'your-secret-key', // 세션 데이터 암호화에 사용할 키, 암호화된 세션 데이터를 해독하기 위한 비밀값
//   resave: false, // 세션 데이터가 변경되지 않더라도 세션을 다시 저장할지 여부를 나타내는 옵션
//   saveUninitialized: true, // 초기화되지 않은 세션을 저장할지 여부를 나타내는 옵션
//   cookie: { secure: false } // HTTPS를 사용하는 경우 true로 설정, secure: false로 설정하면 HTTPS가 아닌 경우에도 세션 쿠키가 작동함
// }));

// // Include routes defined in main.js
// const appRoutes = require('./routes/main'); //./routes/main에서 정의된 라우팅을 앱에 적용함

// // Apply routes to the app
// app.use(appRoutes);

// // Start the server
// const PORT = 8000;
// app.listen(PORT, () => console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`));

// module.exports = app;

const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

// 기본 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

// 세션 미들웨어를 앱에 추가
app.use(session({
  secret: 'your-secret-key', // 세션 데이터 암호화에 사용할 키, 암호화된 세션 데이터를 해독하기 위한 비밀값
  resave: false, // 세션 데이터가 변경되지 않더라도 세션을 다시 저장할지 여부를 나타내는 옵션
  saveUninitialized: true, // 초기화되지 않은 세션을 저장할지 여부를 나타내는 옵션
  cookie: { secure: false } // HTTPS를 사용하는 경우 true로 설정, secure: false로 설정하면 HTTPS가 아닌 경우에도 세션 쿠키가 작동함
}));

// 라우팅 처리를 위해 main.js 파일에서 정의된 라우팅을 app에 적용함
const appRoutes = require('./routes/main');
app.use(appRoutes);

// Start the server
const PORT = 8000;
app.listen(PORT, () => console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`));

module.exports = app;
