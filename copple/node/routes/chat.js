const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios')
const { v4: uuidv4 } = require('uuid');
const app = express();
const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, BatchGetItemCommand } = require('@aws-sdk/client-dynamodb');
const AWS_REGION = 'ap-northeast-2';
const dynamodbClient = new DynamoDBClient({ region: AWS_REGION });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


// 가져오려는 파일(event.js)을 가져오기
const eventApi = require('./event');


app.get('/goal/summary2/:user_id', async (req, res) => {
    const user_id = req.params.user_id; // Extract user_id from the URL parameter
    const eventType = 'Goal';
    const params = {
      TableName: 'Event',
      FilterExpression: 'EventType = :eventType AND UserId = :user_id', // Filter by user_id
      ExpressionAttributeValues: {
        ':eventType': { S: eventType },
        ':user_id': { S: user_id }, // Use the extracted user_id
      },
    };
    try {
      const command = new ScanCommand(params);
      const response = await dynamodbClient.send(command);
      // Create a list of updated event_ids to retrieve updated values
      const updatedEventIds = response.Items.map((item) => item.EventId.S);
  
      // Use BatchGetItem to get updated data
      if (updatedEventIds.length === 0) {
        return res.status(200).json({ detail: 'There are no goals for this user.' });
      }
  
      const batchGetParams = {
        RequestItems: {
          Event: {
            Keys: updatedEventIds.map((event_id) => ({
              EventId: { S: event_id },
            })),
          },
        },
      };
      const batchGetCommand = new BatchGetItemCommand(batchGetParams);
      const batchGetResponse = await dynamodbClient.send(batchGetCommand);
  
      // Select only the required fields, convert the data, and combine it into a string
      const formattedGoals = batchGetResponse.Responses['Event'].map((item) => ({
        title: item.Title.S,
        startDatetime: item.StartDatetime.S,
        endDatetime: item.EndDatetime.S,
        location: item.Location.S || 'No location information',
        content: item.Content.S || 'No content',
      }));
  
      const formattedGoalsString = formattedGoals
        .map((goal) =>
          `Goal: ${goal.title}\nDate: ${goal.startDatetime} ~ ${goal.endDatetime}\nLocation: ${goal.location}\nContent: ${goal.content}`
        )
        .join('\n\n'); // Separate each goal with a line break and combine it into a string
  
      return res.status(200).send(formattedGoalsString);
    } catch (error) {
      console.error('An error occurred while fetching goals: ', error);
      return res.status(500).json({ detail: 'An error occurred while loading the target list.' });
    }
  });


module.exports = app;