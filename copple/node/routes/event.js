const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const cookieParser = require('cookie-parser');
const path = require('path');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const app = express();

const AWS_REGION = 'ap-northeast-2';

const s3Client = new S3Client({ region: AWS_REGION });
const dynamodbClient = new DynamoDBClient({ region: AWS_REGION });

// 쿠키 파서 및 다른 미들웨어 설정
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 디버깅: 토큰이 올바르게 수신되었는지 확인
function requireLogin(req, res, next) {
  const token = req.cookies.token;
  console.log("Token:", token);

  if (!token) {
    return res.status(401).json({ detail: "인증되지 않았습니다 - 로그인이 필요합니다." });
  }

  try {
    const decoded = jwt.verify(token, 'secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error("토큰 유효성 검사 오류:", error);
    return res.status(401).json({ detail: "인증되지 않았습니다 - 잘못된 토큰입니다." });
  }
}

// 목표 생성 upload.single("image") 미들웨어가 사용되고 있으므로, 사용자가 이미지를 업로드하려면 요청에 image라는 필드를 포함해야 합니다. req.file객체에 저장됨. 
app.post("/goal/create", requireLogin, upload.single("image"), async (req, res) => {
  const user = req.user;
  const { title, startDatetime, endDatetime, offset, location, content } = req.body;

  try {
    const fileBuffer = req.file.buffer; //사용자가 업로드한 이미지는 req.file.buffer를 통해 얻을 수 있으며, 이 데이터는 Amazon S3 버킷에 업로드 됨
    const fileType = req.file.mimetype; //Multipurpose Internet Mail Extensions, JPEG, PNG, GIF 이미지 등의 형식 식별시 사용
    const userId = user.user_id;
    const key = `travel_photos/${uuidv4()}.jpg`;

    const params = {
      Bucket: 'seo-3169',
      Key: key,
      Body: fileBuffer,
      ContentType: fileType,
    };

    await s3Client.send(new PutObjectCommand(params));

    const imageUrl = `https://${params.Bucket}.s3.ap-northeast-2.amazonaws.com/${params.Key}`;

    // 나머지 데이터와 함께 DynamoDB에 저장
    const event_id = uuidv4();
    const eventType = 'Goal';

    const eventParams = {
      TableName: 'Event',
      Item: {
        'EventId': { S: event_id },
        'UserId': { S: userId },
        'EventType': { S: eventType },
        'Title': { S: title },
        'StartDatetime': { S: startDatetime },
        'EndDatetime': { S: endDatetime },
        'Offset': { N: String(offset) },
        'Location': { S: location },
        'Content': { S: content },
        'PhotoURL': { S: imageUrl }
      },
    };

    await dynamodbClient.send(new PutItemCommand(eventParams));

    const goalData = {
      event_id,
      user_id: userId,
      eventType,
      title,
      startDatetime,
      endDatetime,
      offset,
      location,
      content,
      photoUrl: imageUrl
    };

    res.cookie('goalData', JSON.stringify(goalData));
    return res.status(200).json({
      event_id,
      message: "목표가 성공적으로 생성되었습니다."
    });
  } catch (error) {
    console.error('An error occurred while creating the goal with image: ', error);
    return res.status(500).json({ detail: "목표를 생성하는 중 오류가 발생했습니다." });
  }
});

// 목표 전체 조회
app.get("/goal/read", requireLogin, async (req, res) => {
  const user = req.user;
  const eventType = 'Goal';

  const params = {
    TableName: 'Event',
    FilterExpression: 'UserId = :userId AND EventType = :eventType',
    ExpressionAttributeValues: {
      ':userId': { S: user.user_id },
      ':eventType': { S: eventType },
    }
  };

  try {
    // AWS SDK 버전 3에서는 DynamoDBClient와 ScanCommand를 사용하여 요청을 생성합니다.
    const command = new ScanCommand(params);
    const response = await dynamodbClient.send(command);

    const goals = response.Items.map(item => ({
      event_id: item.EventId.S,
      user_id: item.UserId.S,
      eventType: item.EventType.S,
      title: item.Title.S,
      startDatetime: item.StartDatetime.S,
      endDatetime: item.EndDatetime.S,
      offset: Number(item.Offset.N),
      location: item.Location.S,
      content: item.Content.S,
      photoUrl: item.PhotoURL ? item.PhotoURL.S : null
    }));

    return res.json(goals);
  } catch (error) {
    console.error('An error occurred : ', error);
    return res.status(500).json({ detail: "내부 서버 오류" });
  }
});

// 한 개의 목표 조회
app.get("/goal/read/:event_id", requireLogin, async (req, res) => {
  const user = req.user;
  const event_id = req.params.event_id;

  const params = {
    TableName: 'Event',
    Key: {
      'EventId': { S: event_id }
    },
  };

  try {
    const command = new GetItemCommand(params);
    const response = await dynamodbClient.send(command);

    if (response.Item) {
      const goalData = {
        event_id: response.Item.EventId.S,
        user_id: response.Item.UserId.S,
        eventType: response.Item.EventType.S,
        title: response.Item.Title.S,
        startDatetime: response.Item.StartDatetime.S,
        endDatetime: response.Item.EndDatetime.S,
        offset: Number(response.Item.Offset.N), // Corrected the offset conversion
        location: response.Item.Location.S,
        content: response.Item.Content.S,
        photoUrl: response.Item.PhotoURL ? response.Item.PhotoURL.S : null
      };
      return res.json(goalData);
    } else {
      return res.status(404).json({ detail: "목표를 찾을 수 없습니다." });
    }
  } catch (error) {
    console.error('An error occurred : ', error);
    return res.status(500).json({ detail: "목표를 조회할 수 없습니다." });
  }
});




module.exports = app;