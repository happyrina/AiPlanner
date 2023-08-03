const express = require('express');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const dynamodb = new AWS.DynamoDB({ region: 'ap-northeast-2' });
const tableName = 'Account';

const sessions = {};


// This function checks if the user ID already exists.
async function isUserExists(userId) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'UserId = :id',
    ExpressionAttributeValues: { ':id': { S: userId } },
  };
  
  const response = await dynamodb.query(params).promise();

  if (response.Items.length > 0){
    return true
  }else{
    false
  }
//   return response.Items.length > 0;
} 

// This function checks if the user ID and password are valid.
async function isValidPassword(userId, userName, password) {
  const params = {
    TableName: tableName,
    Key: {
      'UserId': { S: userId },
      'UserName': { S: userName },
    },
  };
  
  const response = await dynamodb.getItem(params).promise();
  const item = response.Item;
  return item && item.Password.S == password;
}

// POST request processing function for the path "/login/".
app.post("/login/", (req, res) => {
  const { user_id, user_name, password } = req.body;
  console.log(user_id);
  console.log(user_name);
  // Use the isValidPassword function to check if the information provided by the user is valid.
  if (isValidPassword(user_id, user_name, password)) {
    // Generate a new UUID for the user session
    const session_id = uuidv4();
    // Store the session ID in the sessions dictionary
    sessions[session_id] = user_id;
    // Set the session ID as a cookie in the response
    res.cookie("session_id", session_id);
    return res.json({ message: "Login successful" });
  } else {
    // If invalid, return HTTP 401 error.
    return res.status(401).json({ detail: "Login failed" });
  }
});

// POST request processing function for the path "/logout/".
app.post("/logout/", (req, res) => {
  const session_id = req.cookies.session_id;

  // Check if the session ID exists in the sessions dictionary
  if (session_id && sessions.hasOwnProperty(session_id)) {
    // Remove the session ID from the sessions dictionary
    delete sessions[session_id];
  }
  // Clear the session ID cookie in the response
  res.clearCookie("session_id");
  return res.json({ message: "Logout successful" });
});

// POST request processing function for the path "/signup/".
app.post("/signup", (req, res) => {
  const { user_id, user_name, password, passwordcheck } = req.body;
  
  if (isUserExists(user_id) == true) {
    return res.status(400).json({ detail: "This user already exists." });
  }

  // Generate a new UUID for the user
  const user_uuid = uuidv4();

  const params = {
    TableName: tableName,
    Item: {
      'UserId': { S: user_id },
      'UserName': { S: user_name },
      'Password': { S: password },
      'PasswordCheck': { S: passwordcheck },
      'UUID': { S: user_uuid }, // Include the UUID in the item
    },
  };

  // Register user information in the table
  dynamodb.putItem(params, (err) => {
    if (err) {
      return res.status(500).json({ detail: "Registration failed" });
    }
    return res.json({ message: "Registration completed.", user_uuid: user_uuid });
  });
});

// ... Rest of the code ...

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
