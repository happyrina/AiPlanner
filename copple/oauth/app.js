const http = require("http");
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const passport = require("passport");
const fs = require("fs");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// secret.json 파일 읽기
const secretData = fs.readFileSync("../secret.json");
const secrets = JSON.parse(secretData);

// Google 클라이언트 ID와 시크릿
const GOOGLE_CLIENT_ID = secrets.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = secrets.GOOGLE_CLIENT_SECRET;

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

// image 사용을 위한 static folder 지정
app.use(express.static("public"));

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
      console.log(profile.id, profile.displayName, profile.email);
      try {
        // 사용자 정보를 데이터베이스에 저장하는 작업
        const [rows, fields] = await promisePool.query(
          `INSERT INTO users (id, name, email)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = ?, email = ?;`,
          [profile.id, profile.displayName, profile.email, profile.displayName, profile.email]
        );
        // console.log("User info saved to database:", rows);
        console.log("유저 정보 저장 완료.");
        // JWT 토큰 발급
        const token = jwt.sign({ id: profile.id }, jwtOptions.secretOrKey);
        console.log("JWT token generated:", token);
        return done(null, profile, token);
      } catch (err) {
        console.error("Error saving user info to database:", err);
        return done(err, null);
      }
    }
  )
);

// login 화면
// 이미 로그인한 회원이라면(session 정보가 존재한다면) main화면으로 리다이렉트
app.get("/login", (req, res) => {
  if (req.user) return res.redirect("/");
  fs.readFile("./webpage/login.html", (error, data) => {
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
  fs.readFile("./webpage/main.html", (error, data) => {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(data);
  });
});

// google login 화면
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

// 사용자 정보를 MySQL에 저장하는 미들웨어 적용
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: "/",
    failureRedirect: "/login",
  }),
  (req, res) => {
    // 로그인 성공 후, 토큰을 클라이언트로 전송
    res.json({ token: req.authInfo }); // req.authInfo에 JWT 토큰.
  }
);

// JWT를 이용하여 사용자 정보 조회하는 라우터
app.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    // Passport의 JWT Strategy를 통해 인증이 성공하면, req.user로 사용자 정보에 접근 가능
    res.json(req.user);
  }
);

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
    const [rows, fields] = await promisePool.query("SELECT * FROM users WHERE id = ?", [userData.id]);
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
    console.error("Error retrieving user from database:", err);
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

// Swagger UI 설정
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
