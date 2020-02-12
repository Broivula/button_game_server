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

// setting up database connection

const databaseConnection = db.connect();

// routing for the express server, handling regular connections

app.get('/get/rooms_data', (req, res) => {
  const token = req.get('Authorization');

  db.tokenCheckPipeline(databaseConnection, token).then(((result) => {
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
  db.tokenCheckPipeline(databaseConnection, token, db.checkIfUserExists(databaseConnection, username)).then((result) => {
    const parsed = Object.values(result[0]);
    let available;
    (parsed === 1) ? available = false : available = true;
    res.json({ username_available: available });
  }).catch(() => {
    res.json({ error_msg: 'error ing username availability' });
  });
});

app.post('/post/newuser', (req, res) => {
  // username hard coded now for testing purposes
  const token = req.get('Authorization');
  const { username } = req.body;
  db.tokenCheckPipeline(databaseConnection, token, db.addUser(databaseConnection, username)).then((result) => {
    res.json({ uid: result });
  }).catch((err) => {
    console.log('error adding a new user');
    console.log(err);
    res.json({ error_msg: 'error inserting a new user to server db' });
  });
});


app.listen(3003);

// configuration for the socket connections

const server = net.createServer();

server.on('connection', (socket) => {
  socket.setEncoding('utf-8');

  socket.on('data', (data) => {
    if (data.length > 5) {
      try {
        const parsedData = JSON.parse(data.toString());
        db.tokenCheckPipeline(databaseConnection, parsedData.token).then(() => {
          const roomData = game.getRoomData(parsedData.roomNumber);
          switch (parsedData.event) {
            case 'JOIN_ROOM':
              if (game.checkIfRoomAvailable(parsedData.roomNumber)) {
                sf.createNewConnection({
                  socket,
                  username: parsedData.username,
                  roomNumber: parsedData.roomNumber,
                });
                db.checkIfUserHasScore(databaseConnection, parsedData.username, parsedData.roomNumber).then(((res) => {
                  const parsed = Object.values(res[0]);
                  if (parsed[0] === 0) {
                    db.updatePlayerScore(databaseConnection, parsedData.username, parsedData.roomNumber, startingScore);
                  }
                  const players = game.getRoomPlayerList(parsedData.roomNumber);
                  db.getRoomScores(databaseConnection, parsedData.roomNumber, players).then(((result) => {
                    sf.sendRoomScoresToClients(parsedData.roomNumber, result, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
                  }));
                }));
              } else {
                sf.socketErrorMsg(socket, sf.ErrorMsgCodes.ROOM_FULL, null)
              }
              break;

            // if the incoming data is the data received from a click
            case 'SEND_CLICK':
              if (parsedData.playerScore > 0) {
                const newClickAmount = game.addClick(roomData);
                let { playerScore } = parsedData;
                let didClickWin = false;
                let amountWon = 0;

                game.updateGameRoomClickAmount(newClickAmount, parsedData.roomNumber);
                if (newClickAmount % 10 === 0) {
                  amountWon = game.checkClick(newClickAmount);
                  playerScore += amountWon;
                  didClickWin = true;
                } else {
                  playerScore--;
                }
                db.updatePlayerScore(databaseConnection, parsedData.username, parsedData.roomNumber, playerScore)
                  .then(() => {
                    db.getRoomScores(databaseConnection, parsedData.roomNumber, game.getRoomPlayerList(parsedData.roomNumber))
                      .then(((res) => {
                        sf.sendRoomScoresToClients(parsedData.roomNumber, res, newClickAmount, roomData.turnHolder, didClickWin, roomData.clients, amountWon);
                      }
                      ));
                  });
              }
              break;

            case 'END_TURN':
              const players = game.getRoomPlayerList(parsedData.roomNumber);
              game.passTurnToNextClient(roomData);
              db.getRoomScores(databaseConnection, parsedData.roomNumber, players).then(((res) => {
                sf.sendRoomScoresToClients(parsedData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
              }));
              break;


            case 'EXIT_ROOM':
              sf.handleClientDisconnect(socket, databaseConnection);
              socket.end();
              break;

            case 'NEW_GAME':
              db.updatePlayerScore(databaseConnection, parsedData.username, parsedData.roomNumber, startingScore).then(() => {
                db.getRoomScores(databaseConnection, parsedData.roomNumber, game.getRoomPlayerList(parsedData.roomNumber)).then((res) => {
                  sf.sendRoomScoresToClients(parsedData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
                });
              });
              break;
            default:
              sf.socketErrorMsg(socket, sf.ErrorMsgCodes.UNKNOWN, "hit the default case, which should be impossible");
              break;
          }
        }).catch((err) => {
          console.log('invalid data sent via socket');
          console.log(err);
        });
      } catch (err) {
        console.log('error parsing incoming socket data');
        console.log(err);
      }
    }
  });

  socket.on('drain', () => {
    console.log('buffer cleared again, resume writing data');
    socket.resume();
  });

  socket.on('error', (err) => {
    console.log('something went wrong..');
    console.log(err);
  });

  socket.on('close', () => {
    console.log('socket closed');
    try {
      if (game.isClientStillInRoom(socket))sf.handleClientDisconnect(socket, databaseConnection);
    } catch (e) {
      console.log(e);
    }
  });
});

setInterval(() =>{
  db.getRoomScores(databaseConnection, 1, []).then((result) => {
    console.log('keeping up connection..');
    console.log(result);
  })
}, 100000);


server.listen(3366, () => {
  console.log('server started, listening to port 3366');
});

game.instantiateGameRooms();
