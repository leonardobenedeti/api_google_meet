const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'token.json';

var express = require("express");
var bodyParser = require("body-parser");
var app = express();

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), checkAuth);
});

var authGoogle = null;

function checkAuth(auth){
  authGoogle = auth;
}

app.use(bodyParser.raw());
app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

var server = app.listen(process.env.PORT || 8080, function () {
  var port = server.address().port;
  console.log("App now running on port", port);
});

function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}




app.post("/event/new", function(req, res){
  createEvent(authGoogle, req, res);
});

app.get("/event/list", function(req, res){
  listEvents(authGoogle, req, res);
});


function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function listEvents(auth, request, response) {

  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    console.log(res.data);
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
        console.log(JSON.stringify(event));
      });
      response.send(events);
    } else {
      response.send('No upcoming events found.');
    }
  });
}

function createEvent(auth, request, response){

  const {local, medico, paciente, inicio, fim} = request.body;

  var event = {
    'summary': 'Consulta com o Dr.'+medico,
    'description': paciente+' no dia da consulta clique em Participar do Hangouts',
    'location': local,
    'start': {
      'dateTime': inicio,
      'timeZone': 'America/Los_Angeles',
    },
    'end': {
      'dateTime': fim,
      'timeZone': 'America/Los_Angeles',
    },
    'recurrence': [
      'RRULE:FREQ=DAILY;COUNT=1'
    ],
    'attendees': [
      {'email': 'leonardobenedeti@gmail.com'},
      {'email': 'iago.novoa.antunes@gmail.com'},
    ],
    'reminders': {
      'useDefault': false,
      'overrides': [
        {'method': 'email', 'minutes': 24 * 60},
      ],
    },
    'conferenceData': {
      'createRequest': {
        'requestId': 'testeXPTO',
        'conferenceSolutionKey': {
          'type': 'eventHangout'
        }
      },
      
    }
  };
  
  const calendar = google.calendar({version: 'v3', auth});

  calendar.events.insert({
    auth: auth,
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
  }, function(err, event) {
    if (err) {
      response.send('There was an error contacting the Calendar service: ' + err);
    }
    response.send(event.data.hangoutLink);
  });
}
