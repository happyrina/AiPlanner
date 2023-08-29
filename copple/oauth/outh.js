const http = require("http");
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const passport = require("passport");
const fs = require("fs");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const NaverStrategy = require("passport-naver").Strategy;
const KakaoStrategy = require("passport-kakao").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;


const app = express();
const server = http.createServer(app);
const PORT = 3000;

// secret.json 파일 읽기
const secretData = fs.readFileSync("../secret.json");
const secrets = JSON.parse(secretData);

// Google 클라이언트 ID와 시크릿
const GOOGLE_CLIENT_ID = secrets.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = secrets.GOOGLE_CLIENT_SECRET;

// Naver 클라이언트 ID와 시크릿
const NAVER_CLIENT_ID = secrets.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = secrets.NAVER_CLIENT_SECRET;

// Kakao 클라이언트 ID와 시크릿
const KAKAO_CLIENT_ID = secrets.KAKAO_CLIENT_ID;
const KAKAO_CLIENT_SECRET = secrets.KAKAO_CLIENT_SECRET;

// Facebook 클라이언트 ID와 시크릿
const FACEBOOK_APP_ID = secrets.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = secrets.FACEBOOK_APP_SECRET;

// MySQL 정보
const MYSQL_HOSTNAME = secrets.Mysql_Hostname;
const MYSQL_PORT = secrets.Mysql_Port;
const MYSQL_USERNAME = secrets.Mysql_Username;
const MYSQL_PASSWORD = secrets.Mysql_Password;
const MYSQL_DBNAME = secrets.Mysql_DBname;

// MySQL 연결 설정
const pool = mysql.createPool({
  host: MYSQL_HOSTNAME,
  port: MYSQL_PORT,
  user: MYSQL_USERNAME,
  password: MYSQL_PASSWORD,
  database: MYSQL_DBNAME,
});

// MySQL 연결 풀에 대한 프라미스 래퍼
const promisePool = pool.promise();

// db session store options
const options = {
  host: MYSQL_HOSTNAME,
  port: MYSQL_PORT,
  user: MYSQL_USERNAME,
  password: MYSQL_PASSWORD,
  database: MYSQL_DBNAME,
};

// mysql session store 생성
const sessionStore = new MySQLStore(options, pool);

// express session 연결
app.use(
  session({
    secret: "secret key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
  })
);

// CSS 파일을 서비스하는 부분 추가
app.use(express.static("../client"));

// passport 초기화 및 session 연결
app.use(passport.initialize());
app.use(passport.session());

// JWT 설정
const jwtOptions = {
  secretOrKey: "your_secret_key", // 비밀 키
};

// Google login
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL:
        "http://ec2-13-124-209-114.ap-northeast-2.compute.amazonaws.com:3000/auth/google/callback",
      passReqToCallback: true,
    },
    async function (request, accessToken, refreshToken, profile, done) {
      console.log("Google Login Profile:", profile);
      try {
        // 사용자 정보를 데이터베이스에 저장하는 작업
        const [rows, fields] = await promisePool.query(
          `INSERT INTO users (id, name, email)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, email = ?;`,
          [
            profile.id,
            profile.displayName,
            profile.email,
            profile.displayName,
            profile.email,
          ]
        );
        console.log("Success saving user.");
        // JWT 토큰 발급
        const token = jwt.sign({ id: profile.id }, jwtOptions.secretOrKey);
        console.log("JWT token generated:", token);
        return done(null, profile, token);
      } catch (err) {
        console.error("Error saving user:", err);
        return done(err, null);
      }
    }
  )
);

// Naver login
passport.use(
  new NaverStrategy(
    {
      clientID: NAVER_CLIENT_ID,
      clientSecret: NAVER_CLIENT_SECRET,
      callbackURL:
        "http://ec2-13-124-209-114.ap-northeast-2.compute.amazonaws.com:3000/auth/naver/callback",
    },
    async function (accessToken, refreshToken, profile, done) {
      console.log("Naver Login Profile:", profile);
      try {
        // 사용자 정보를 데이터베이스에 저장하는 작업
        const [rows, fields] = await promisePool.query(
          `INSERT INTO users (id, name, email)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, email = ?;`,
          [
            profile.id,
            profile.displayName,
            profile.emails[0].value,
            profile.displayName,
            profile.emails[0].value,
          ]
        );
        console.log("Success saving user.");
        // JWT 토큰 발급
        const token = jwt.sign({ id: profile.id }, jwtOptions.secretOrKey);
        console.log("JWT token generated:", token);
        return done(null, profile, token);
      } catch (err) {
        console.error("Error saving user:", err);
        return done(err, null);
      }
    }
  )
);

// 카카오 로그인
passport.use(
  new KakaoStrategy(
    {
      clientID: KAKAO_CLIENT_ID,
      clientSecret: KAKAO_CLIENT_SECRET,
      callbackURL:
        "http://ec2-13-124-209-114.ap-northeast-2.compute.amazonaws.com:3000/auth/kakao/callback",
    },
    async function (accessToken, refreshToken, profile, done) {
      console.log("Kakao Login Profile:", profile);
      try {
        // 사용자 정보를 데이터베이스에 저장하는 작업
        const [rows, fields] = await promisePool.query(
          `INSERT INTO users (id, name, email)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, email = ?;`,
          [
            profile.id,
            profile._json.kakao_account.profile.nickname,
            profile._json.kakao_account.email,
            profile._json.kakao_account.profile.nickname,
            profile._json.kakao_account.email,
          ]
        );
        console.log("Success saving user.");
        // JWT 토큰 발급
        const token = jwt.sign({ id: profile.id }, jwtOptions.secretOrKey);
        console.log("JWT token generated:", token);
        return done(null, profile, token);
      } catch (err) {
        console.error("Error saving user:", err);
        return done(err, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL:
        "http://ec2-13-124-209-114.ap-northeast-2.compute.amazonaws.com:3000/auth/facebook/callback",
      profileFields: ["id", "displayName", "email"], // 사용자 정보 필드
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        // Facebook 로그인 처리 및 사용자 정보 저장 로직 추가
        const user = {
          id: profile.id,
          displayName: profile.displayName,
          email: profile.emails[0].value, // 첫 번째 이메일을 사용
        };

        // 사용자 정보를 데이터베이스에 저장하는 작업
        const [rows, fields] = await promisePool.query(
          `INSERT INTO users (id, name, email)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, email = ?;`,
          [user.id, user.displayName, user.email, user.displayName, user.email]
        );

        // JWT 토큰 발급
        const token = jwt.sign({ id: user.id }, jwtOptions.secretOrKey);
        return done(null, user, token);
      } catch (err) {
        console.error("Error saving user:", err);
        return done(err, null);
      }
    }
  )
);

// login 화면
// 이미 로그인한 회원이라면(session 정보가 존재한다면) main화면으로 리다이렉트
app.get("/login", (req, res) => {
  if (req.user) return res.redirect("/");
  fs.readFile("../client/login.html", (error, data) => {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

// login 화면
// 로그인 하지 않은 회원이라면(session 정보가 존재하지 않는다면) login화면으로 리다이렉트
app.get("/", (req, res) => {
  if (!req.user) return res.redirect("/login");
  fs.readFile("../client/main.html", (error, data) => {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

// 카카오 로그인 라우트
app.get("/auth/kakao", passport.authenticate("kakao"));

// 카카오 로그인 콜백 라우트
app.get(
  "/auth/kakao/callback",
  passport.authenticate("kakao", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
  (req, res) => {
    // 리다이렉트 또는 JWT 토큰 및 사용자 정보를 포함한 응답을 전송합니다
    const userName = req.user.username || req.user.name;
    res.json({ token: req.authInfo, userName: userName });
  }
);

// Naver 로그인 화면
app.get("/auth/naver", passport.authenticate("naver"));

// Naver 로그인 콜백 처리
app.get(
  "/auth/naver/callback",
  passport.authenticate("naver", {
    successRedirect:
      "http://ec2-43-200-73-25.ap-northeast-2.compute.amazonaws.com/",
    failureRedirect: "/login",
  }),
  (req, res) => {
    // 로그인 성공 후, 토큰을 클라이언트로 전송
    const userName = req.user.displayName || req.user.name; // displayName이 없을 경우 name 사용
    res.json({ token: req.authInfo, userName: userName }); // JWT 토큰과 사용자 이름 전송
  }
);

// Facebook 로그인 화면
app.get("/auth/facebook", passport.authenticate("facebook"));

// Facebook 로그인 콜백 처리
app.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
  (req, res) => {
    // 로그인 성공 후, 토큰을 클라이언트로 전송
    const userName = req.user.displayName || req.user.name; // displayName이 없을 경우 name 사용
    res.json({ token: req.authInfo, userName: userName }); // JWT 토큰과 사용자 이름 전송
  }
);

// google login 화면
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

// 사용자 정보를 MySQL에 저장하는 미들웨어 적용
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect:
      "http://ec2-43-200-73-25.ap-northeast-2.compute.amazonaws.com/",
    failureRedirect: "/login",
  }),
  (req, res) => {
    // 로그인 성공 후, 토큰을 클라이언트로 전송
    res.json({ token: req.authInfo }); // req.authInfo에 JWT 토큰.
  }
);

// JWT를 이용하여 사용자 정보 조회하는 라우터
app.get("/mypage", (req, res) => {
  // 세션을 통해 인증된 사용자인지 확인
  if (!req.isAuthenticated()) {
    return res.redirect("/login"); // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
  }

  const userId = req.user.id; // 세션에 저장된 사용자 ID

  // 데이터베이스에서 사용자 정보 조회
  promisePool
    .query("SELECT * FROM users WHERE id = ?", [userId])
    .then(([rows, fields]) => {
      if (rows.length === 0) {
        // 사용자 정보를 찾지 못한 경우 처리 (예: 404 페이지)
        return res.sendStatus(404);
      }

      // 프로필 페이지 템플릿을 읽고 사용자 정보를 채워서 응답
      fs.readFile("../client/mypage.html", (error, data) => {
        if (error) {
          console.log(error);
          return res.sendStatus(500);
        }

        const profileHtml = data
          .toString()
          .replace("{DISPLAY_NAME}", rows[0].name)
          .replace("{EMAIL}", rows[0].email);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(profileHtml);
      });
    })
    .catch((err) => {
      console.error("Error:", err);
      res.sendStatus(500);
    });
});

// login이 최초로 성공했을 때만 호출되는 함수
// 사용자의 ID 외에 displayName과 email도 세션에 저장
passport.serializeUser(function (user, done) {
  const userData = {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  };
  done(null, userData);
});

// 사용자가 페이지를 방문할 때마다 호출되는 함수
// deserializeUser를 이용해 사용자의 ID를 세션에서 찾아 사용자 정보를 복구
passport.deserializeUser(async function (userData, done) {
  try {
    // 데이터베이스에서 사용자 정보 조회
    const [rows, fields] = await promisePool.query(
      "SELECT * FROM users WHERE id = ?",
      [userData.id]
    );
    if (rows.length === 0) {
      // 해당 ID에 해당하는 사용자 정보가 없는 경우
      // 기존에 저장된 정보를 하드코딩하지 않고, 빈 사용자 정보를 세션에 저장
      const emptyUser = {
        id: userData.id,
        displayName: null,
        email: null,
      };
      return done(null, emptyUser);
    }

    // 조회한 사용자 정보를 세션에 저장
    const user = {
      id: rows[0].id,
      displayName: rows[0].name,
      email: rows[0].email,
    };
    done(null, user);
  } catch (err) {
    console.error("Error:", err);
    done(err, null);
  }
});

// logout
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.error("Error logging out:", err);
      return res.sendStatus(500);
    }

    res.redirect("/login");
  });
});

// // Swagger UI 설정
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
