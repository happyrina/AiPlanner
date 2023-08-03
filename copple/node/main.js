const AWS = require('aws-sdk');

// AWS 지역을 설정합니다.
AWS.config.update({ region: 'ap-northeast-2' });

// 새로운 DynamoDB 인스턴스를 생성합니다.
const dynamodb = new AWS.DynamoDB();

// 테이블 이름을 설정합니다.
const tableName = 'Account';

// 테이블에서 항목들을 가져오는 함수
function getItems() {
  const params = {
    TableName: tableName
  };

  return dynamodb.scan(params).promise();
}

// 사용 예제
async function main() {
  try {
    // 테이블에서 항목들을 가져옵니다.
    const result = await getItems();
    console.log(result.Items);
  } catch (error) {
    console.error('에러:', error);
  }
}

// main 함수를 호출합니다.
main();
