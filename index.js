/* eslint-disable max-len */
const express = require('express');

const app = express();
const net = require('net');
const bodyParser = require('body-parser');
const db = require('./database');
const game = require('./game_file');
const sf = require('./socket_communication_functions');

const startingScore = 20;

// setting up server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// routing for the express server, handling regular connections

app.get('/get/rooms_data', (req, res) => {
  const token = req.get('Authorization');

  db.tokenCheckPipeline(token).then(((result) => {
    if (result) {
      res.json(game.getGameRoomsData());
    } else {
      res.json({ error_msg: 'token auth failure' });
    }
  })).catch((err) => { console.log(err); });
});

app.post('/post/check_user_availability', (req, res) => {
  const token = req.get('Authorization');
  const { username } = req.body;
  db.tokenCheckPipeline(token, db.checkIfUserExists(username)).then((result) => {
    const parsed = Object.values(result[0]);
    console.log('username: ' + username + ' is available: ' + parsed);
    let available;
    (parseInt(parsed.toString()) === 1) ? available = false : available = true;
    res.json({ username_available: available });
  }).catch(() => {
    res.json({ error_msg: 'error ing username availability' });
  });
});

app.post('/post/newuser', (req, res) => {
  // username hard coded now for testing purposes
  const token = req.get('Authorization');
  const { username } = req.body;
  db.tokenCheckPipeline(token, db.addUser(username)).then((result) => {
    res.json({ uid: result });
  }).catch((err) => {
    console.log('error adding a new user');
    console.log(err);
    res.json({ error_msg: 'error inserting a new user to server db' });
  });
});


app.listen(3003);

// configuration for the socket connections

const server = net.createServer({ allowHalfOpen: true });

server.on('connection', (socket) => {
  socket.setEncoding('utf-8');

  socket.on('data', (data) => {
    if (data.length > 5) {
      try {
        sf.handleIncomingSocketData(socket, data);
      } catch (err) {
        console.log('error handling incoming socket data');
        console.log(err);
      }
    }
  });

  socket.on('drain', () => {
    console.log('buffer cleared again, resume writing data');
    socket.resume();
  });

  socket.on('end', (data) => {
    try {
      if (game.isClientStillInRoom(socket))sf.handleClientDisconnect(socket);
    } catch (e) {
      console.log(e);
    }
    console.log(data);
  });

  socket.on('error', (err) => {
    console.log('something went wrong..');
    try {
      if (game.isClientStillInRoom(socket))sf.handleClientDisconnect(socket);
    } catch (e) {
      console.log(e);
    }
    console.log(err);
  });

  socket.on('close', () => {
    console.log('socket closed');
  });
});


server.listen(3366, () => {
  console.log('server started, listening to port 3366');
});

game.instantiateGameRooms();
