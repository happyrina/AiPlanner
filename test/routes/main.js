const express = require('express');
const router = express.Router();
const dynamodb = new AWS.DynamoDB({ region: 'ap-northeast-2' }); // AWS DynamoDB 인스턴스 생성
const tableName = 'events'; // 사용자 정보를 저장할 테이블 이름

// POST 요청 처리
router.post('/save', async (req, res) => {
  const requestBody = req.body;

  try {
    // 데이터를 DynamoDB에 저장
    await saveDataToDynamoDB(requestBody);

    res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error while saving data:', error);
    res.status(500).json({ error: 'Error while saving data' });
  }
});

module.exports = router;
