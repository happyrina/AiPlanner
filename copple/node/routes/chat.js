const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios')

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.post('/summarize', (req, res) => {
    // Extract the `text` from the request body
    const { text } = req.body;

    // Make an Axios POST request to the external API
    axios
        .post('http://43.201.211.135:8000/summarize', { text }) // Pass `text` in the request body
        .then(response => {
            console.log(`statusCode : ${response.status}`);
            console.log(response.data);
            res.send(response.data);
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('An error occurred while making the request.');
        });
});

module.exports = app;