const express = require('express'); // Express.js 웹 프레임워크
const { v4: uuidv4 } = require('uuid'); // UUID 생성을 위한 모듈
const jwt = require('jsonwebtoken'); // JWT 토큰 생성 및 검증을 위한 모듈

// AWS SDK 모듈과 클라이언트 가져오기
const { DynamoDBClient, QueryCommand, GetItemCommand, PutItemCommand, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const S3 = new S3Client({ region: 'ap-northeast-2' }); // AWS S3 클라이언트 설정

const cookieParser = require('cookie-parser'); // 쿠키 파싱을 위한 모듈
const multer = require('multer'); // 파일 업로드를 위한 모듈

const storage = multer.memoryStorage(); // 파일을 메모리에 버퍼로 저장
const upload = multer({ storage: storage }); // 업로드 설정

const path = require('path'); // 파일 경로 관리를 위한 모듈
const app = express(); // Express 애플리케이션 생성

app.use(express.json()); // JSON 요청 바디 파싱
app.use(cookieParser()); // 쿠키 파싱
app.use(express.urlencoded({ extended: true })); // URL-encoded 요청 바디 파싱
app.use(express.static(path.join(__dirname, 'public'))); // 정적 파일 제공

const dynamodb = new DynamoDBClient({ region: 'ap-northeast-2' }); // DynamoDB 클라이언트 설정
const tableName = 'Account'; // DynamoDB 테이블 이름


// DynamoDB 쿼리를 사용하여 사용자 ID가 존재하는지 확인
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

// DynamoDB 쿼리를 사용하여 사용자 이름이 존재하는지 확인
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

// DynamoDB에서 사용자 ID 및 이름을 사용하여 비밀번호 확인
// async function isValidPassword(userId, userName, password) {
//   const params = {
//     TableName: tableName,
//     Key: {
//       'UserId': { S: userId },
//       'UserName': { S: userName },
//     },
//   };

//   try {
//     const command = new GetItemCommand(params);
//     const response = await dynamodb.send(command);
//     const item = response.Item;
//     return item && item.Password.S === password;
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return false;
//   }
// }

// JWT 토큰을 사용하여 사용자 인증 확인
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
    console.error("토큰 검증 오류:", error);
    return res.status(401).json({ detail: "인증되지 않았습니다 - 잘못된 토큰입니다." });
  }
}

// login 시 user_id와 password만 입력하게끔 수정함
app.post("/account/login", async (req, res) => {
    const { user_id, password } = req.body; // Only user_id and password are received instead of user_name
  
    console.log("Received login request for user_id:", user_id);
  
    if (!password) {
      return res.status(400).json({ detail: "Please enter your password." });
    }
  
    try {
      // Look up the user using user_id
      const userExists = await isUserExists(user_id);
  
      console.log("User exists:", userExists);
  
      if (!userExists) {
        return res.status(401).json({ detail: "User not found." });
      }
  
      // Authenticate the user based on user_id (without password check)
      const token = jwt.sign({ user_id }, 'secret_key', { expiresIn: '1h' });
      res.cookie("token", token);
  
      return res.json({ message: "Login successful" });
    } catch (error) {
      console.error('An error occurred:', error);
      return res.status(500).json({ detail: "Internal Server Error" });
    }
});

//   // 사용자 로그인을 처리하는 엔드포인트 (기존코드, isValidPassword 함수 사용)
// app.post("/account/login", async (req, res) => {
//   const { user_id, user_name, password } = req.body;

//   if (!password) {
//     return res.status(400).json({ detail: "비밀번호를 입력해주세요." });
//   }

//   try {
//     if (await isValidPassword(user_id, user_name, password)) {
//       const token = jwt.sign({ user_id, user_name }, 'secret_key', { expiresIn: '1h' });
//       res.cookie("token", token);

//       return res.json({ message: "로그인 성공" });
//     } else {
//       return res.status(401).json({ detail: "아이디와 비밀번호를 확인해주세요." });
//     }
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });

// 사용자 로그아웃을 처리하는 엔드포인트
app.post("/account/logout", requireLogin, (req, res) => {
  res.clearCookie("token");
  res.clearCookie("eventData");
  return res.json({ message: "로그아웃 성공" });
});

// 사용자 회원 가입을 처리하는 엔드포인트
app.post("/account/signup", async (req, res) => {
  const { user_id, user_name, password, passwordcheck } = req.body;

  if (await isUserExists(user_id)) {
    return res.status(400).json({ detail: "해당 사용자 ID가 이미 존재합니다." });
  }

  if (await isUserNameExists(user_name)) {
    return res.status(400).json({ detail: "해당 사용자 이름은 이미 사용 중입니다." });
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
    const command = new PutItemCommand(params);
    await dynamodb.send(command);
    return res.json({ message: "사용자 등록 완료", user_uuid: user_uuid });
  } catch (error) {
    console.error('오류 발생:', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});


// 사용자 프로필 조회 엔드포인트 (오류 해결해야함)
// app.get("/account/profile", requireLogin, async (req, res) => {
//   try {
//     const userId = req.user.user_id;
//     const userName = req.user.user_name;

//     // UserId 및 UserName을 기반으로 사용자 프로필 정보 가져오기
//     const params = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//     };

//     const command = new GetItemCommand(params);
//     const response = await dynamodb.send(command);
//     const userProfile = response.Item;

//     if (!userProfile) {
//       return res.status(404).json({ detail: "프로필을 찾을 수 없습니다." });
//     }

//     // 민감한 정보 (비밀번호 등) 응답 전에 제거
//     delete userProfile.Password;
//     delete userProfile.PasswordCheck;

//     return res.json({ profile: userProfile });
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });


// 비밀번호 재설정을 처리하는 엔드포인트
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

      // 새로운 임시 비밀번호 생성
      const newTemporaryPassword = generateTemporaryPassword();

      console.log("새로운 임시 비밀번호:", newTemporaryPassword); // 새로운 임시 비밀번호 로깅

      // 사용자의 비밀번호와 PasswordCheck 업데이트
      const updateParams = {
        TableName: tableName,
        Key: {
          'UserId': { S: user_id },
          'UserName': { S: user_name },
        },
        UpdateExpression: 'SET Password = :password, PasswordCheck = :passwordCheck', // PasswordCheck 업데이트
        ExpressionAttributeValues: {
          ':password': { S: newTemporaryPassword },
          ':passwordCheck': { S: newTemporaryPassword }, // PasswordCheck도 새로운 비밀번호로 업데이트
        },
      };

      const updateCommand = new UpdateItemCommand(updateParams);
      await dynamodb.send(updateCommand);

      return res.json({ message: "새로운 임시 비밀번호가 발급되었습니다.", temporaryPassword: newTemporaryPassword });
    } catch (error) {
      console.error('비밀번호 업데이트 중 오류 발생:', error);
      return res.status(500).json({ detail: "내부 서버 오류" });
    }
  });

 // 사용자 이름으로 ID를 찾는 엔드포인트
app.post("/account/find/id", async (req, res) => {
    const { user_name } = req.body;

    try {
      const params = {
        TableName: tableName,
        FilterExpression: 'UserName = :name',
        ExpressionAttributeValues: { ':name': { S: user_name } },
      };

      const command = new ScanCommand(params);
      const response = await dynamodb.send(command);
      const usersWithSameName = response.Items;

      if (usersWithSameName.length === 0) {
        return res.status(404).json({ detail: "해당 이름의 사용자가 없습니다." });
      }

      // 사용자 ID 반환
      const userIDs = usersWithSameName.map(user => user.UserId.S);

      return res.json({ user_ids: userIDs });
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

// 사용자 프로필 수정 엔드포인트 (오류 해결해야함)
// app.patch("/account/profile/edit", requireLogin, async (req, res) => {
//   try {
//     const userId = req.user.user_id;
//     const userName = req.user.user_name;
//     const { new_password, new_password_check } = req.body;

//     // UserId 및 UserName을 기반으로 사용자 프로필 정보 가져오기
//     const params = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//     };

//     const command = new GetItemCommand(params);
//     const response = await dynamodb.send(command);
//     const userProfile = response.Item;

//     if (!userProfile) {
//       return res.status(404).json({ detail: "프로필을 찾을 수 없습니다." });
//     }

//     // 새로운 비밀번호가 일치하는지 확인
//     if (new_password !== new_password_check) {
//       return res.status(400).json({ detail: "새 비밀번호가 일치하지 않습니다." });
//     }

//     // 사용자의 비밀번호와 PasswordCheck 업데이트
//     const updateParams = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//       UpdateExpression: 'SET Password = :password, PasswordCheck = :passwordCheck', // PasswordCheck 업데이트
//       ExpressionAttributeValues: {
//         ':password': { S: new_password },
//         ':passwordCheck': { S: new_password_check }, // PasswordCheck에 값 제공
//       },
//     };

//     const updateCommand = new UpdateItemCommand(updateParams);
//     await dynamodb.send(updateCommand);

//     return res.json({ message: "비밀번호 업데이트가 성공적으로 완료되었습니다." });
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });


 // 프로필 사진 업로드 엔드포인트
// app.post("/account/upload/photo", requireLogin, upload.single('profilePhoto'), async (req, res) => {
//   try {
//     const userId = req.user.user_id; // 로그인된 사용자의 ID
//     const userName = req.user.user_name; // 로그인된 사용자의 이름
//     const { originalname, buffer } = req.file; // 업로드된 파일 데이터

//     // Amazon S3 객체 키 생성
//     const s3Key = `profile_photos/${userId}-${Date.now()}-${originalname}`;

//     // Amazon S3 업로드 매개변수
//     const s3UploadParams = {
//       Bucket: 'seo-3169', // 사용할 S3 버킷 이름
//       Key: s3Key,
//       Body: buffer,
//       ContentType: 'image/jpeg', // 적절한 콘텐츠 타입 설정
//     };

//     // PutObjectCommand를 사용하여 이미지 업로드
//     const uploadCommand = new PutObjectCommand(s3UploadParams);

//     // 이미지 데이터 Amazon S3에 업로드
//     await S3.send(uploadCommand);

//     // 사용자 프로필의 PhotoUrl 업데이트
//     const updateParams = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//       UpdateExpression: 'SET PhotoUrl = :photoUrl',
//       ExpressionAttributeValues: {
//         ':photoUrl': { S: `seo-3169/${s3Key}` }, // S3 URL로 업데이트
//       },
//     };

//     const updateCommand = new UpdateItemCommand(updateParams);

//     await dynamodb.send(updateCommand);

//     return res.json({ message: "프로필 사진 업로드가 성공적으로 완료되었습니다." });
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });


 // 프로필 사진 조회 엔드포인트
// app.get("/account/profile/photo", requireLogin, async (req, res) => {
//   try {
//     const userId = req.user.user_id; // 로그인된 사용자의 ID
//     const userName = req.user.user_name; // 로그인된 사용자의 이름

//     // UserId 및 UserName을 기반으로 사용자 프로필 정보 가져오기
//     const params = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//     };

//     const command = new GetItemCommand(params);
//     const response = await dynamodb.send(command);
//     const userProfile = response.Item;

//     if (!userProfile) {
//       return res.status(404).json({ detail: "프로필을 찾을 수 없습니다." });
//     }

//     // 프로필 사진 URL 반환
//     const photoUrl = userProfile.PhotoUrl ? userProfile.PhotoUrl.S : null;
//     if (!photoUrl) {
//       return res.status(404).json({ detail: "프로필 사진을 찾을 수 없습니다." });
//     }

//     return res.json({ photoUrl: photoUrl });
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });

// // 프로필 사진 다운로드 엔드포인트
// app.get("/account/download/photo", requireLogin, async (req, res) => {
//   try {
//     const userId = req.user.user_id; // 로그인된 사용자의 ID
//     const userName = req.user.user_name; // 로그인된 사용자의 이름

//     // UserId 및 UserName을 기반으로 사용자 프로필 정보 가져오기
//     const params = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//     };

//     const command = new GetItemCommand(params);
//     const response = await dynamodb.send(command);
//     const userProfile = response.Item;

//     if (!userProfile) {
//       return res.status(404).json({ detail: "프로필을 찾을 수 없습니다." });
//     }

//     // 프로필 사진 URL 반환
//     const photoUrl = userProfile.PhotoUrl ? userProfile.PhotoUrl.S : null;
//     if (!photoUrl) {
//       return res.status(404).json({ detail: "프로필 사진을 찾을 수 없습니다." });
//     }

//     // Amazon S3 객체 키 추출
//     const s3Key = photoUrl.replace('seo-3169/', '');

//     // Amazon S3에서 이미지 데이터 추출
//     const s3DownloadParams = {
//       Bucket: 'seo-3169',
//       Key: s3Key,
//     };

//     const image = await S3.send(new GetObjectCommand(s3DownloadParams));

//     // 이미지 데이터를 응답으로 보내기
//     res.setHeader('Content-Type', 'image/jpeg');
//     res.end(image.Body.buffer); // buffer를 직접 사용하여 데이터를 보냅니다.
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });



// // 프로필 사진 삭제 엔드포인트
// app.delete("/account/delete/photo", requireLogin, async (req, res) => {
//   try {
//     const userId = req.user.user_id; // 로그인된 사용자의 ID
//     const userName = req.user.user_name; // 로그인된 사용자의 이름

//     // UserId 및 UserName을 기반으로 사용자 프로필 정보 가져오기
//     const params = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//     };

//     const command = new GetItemCommand(params);
//     const response = await dynamodb.send(command);
//     const userProfile = response.Item;

//     if (!userProfile) {
//       return res.status(404).json({ detail: "프로필을 찾을 수 없습니다." });
//     }

//     // 프로필 사진 URL 반환
//     const photoUrl = userProfile.PhotoUrl ? userProfile.PhotoUrl.S : null;
//     if (!photoUrl) {
//       return res.status(404).json({ detail: "프로필 사진을 찾을 수 없습니다." });
//     }

//     // Amazon S3 객체 키 추출
//     const s3Key = photoUrl.replace('seo-3169/', '');

//     // Amazon S3에서 이미지 데이터 삭제
//     const s3DeleteParams = {
//       Bucket: 'seo-3169',
//       Key: s3Key,
//     };

//     await S3.send(new DeleteObjectCommand(s3DeleteParams));

//     // 사용자 프로필의 PhotoUrl 업데이트 (null로 설정)
//     const updateParams = {
//       TableName: tableName,
//       Key: {
//         'UserId': { S: userId },
//         'UserName': { S: userName },
//       },
//       UpdateExpression: 'SET PhotoUrl = :photoUrl',
//       ExpressionAttributeValues: {
//         ':photoUrl': { NULL: true }, // PhotoUrl 값을 null로 업데이트
//       },
//     };

//     const updateCommand = new UpdateItemCommand(updateParams);

//     await dynamodb.send(updateCommand);

//     return res.json({ message: "프로필 사진 삭제가 성공적으로 완료되었습니다." });
//   } catch (error) {
//     console.error('오류 발생:', error);
//     return res.status(500).json({ detail: "내부 서버 오류" });
//   }
// });



module.exports = app; // 애플리케이션 모듈로 내보내기