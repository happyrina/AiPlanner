'use strict';

const AWS = require('aws-sdk');
const tableName = 'Event';

AWS.config.update({
  region: 'ap-northeast-2'
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const scanParams = {
  TableName: tableName
};

dynamoDB.scan(scanParams, (err, data) => {
  if (err) {
    console.error('Error while scanning the table:', err);
  } else {
    console.log('Items in the table:', data.Items);
  }
});
