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

app.get('/', (req, res) => {
  db.tokenCheckPipeline(databaseConnection, 'proof_of_concept_token_for_button_game', db.getRoomScores(databaseConnection, 1, game.getRoomPlayerList(1))).then(((result) => {
    const parsed = JSON.parse(JSON.stringify(result));
    console.log(parsed);
  }
  ));
});

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

const error_msg = (res) => {
  console.log('aaay, mistake bruh');
  res.json({ err: 'token authentication failure' });
};

app.listen(3000);

// configuration for the socket connections

const server = net.createServer();

server.on('connection', (socket) => {
  socket.setEncoding('utf-8');

  socket.on('data', (data) => {
    if (data.length > 5) {
      try {
        console.log('data incoming:');
        const parsedData = JSON.parse(data.toString());
        // check the token
        db.tokenCheckPipeline(databaseConnection, parsedData.token).then(() => {
          const roomData = game.getRoomData(parsedData.roomNumber);
          switch (parsedData.event) {
          // if the incoming data is aiming to join a room
            case 'JOIN_ROOM':
              if (game.checkIfRoomAvailable(parsedData.roomNumber)) {
                sf.createNewConnection({
                  socket,
                  username: parsedData.username,
                  roomNumber: parsedData.roomNumber,
                });

                // connection created, player has joined the room. now, send the room scores and relevant data to them.
                // first, check if player has a current score in the room --if not, add them there
                db.checkIfUserHasScore(databaseConnection, parsedData.username, parsedData.roomNumber).then(((res) => {
                  console.log('user score status: ');
                  const parsed = Object.values(res[0]);
                  console.log(parsed[0]);
                  // no score was found, add starting score in the table
                  if (parsed[0] === 0) {
                    console.log('new user, create a score for this room!');
                    db.updatePlayerScore(databaseConnection, parsedData.username, parsedData.roomNumber, startingScore);
                  }
                  const players = game.getRoomPlayerList(parsedData.roomNumber);
                  db.getRoomScores(databaseConnection, parsedData.roomNumber, players).then(((result) => {
                    sf.sendRoomScoresToClients(parsedData.roomNumber, result, roomData.clickAmount, roomData.turnHolder, false, roomData.clients);
                  }));
                }));
              } else {
              // room was full, respond with appropriate message
                sf.sendDataToClient(socket, { statusCode: 400, msg: 'room full bruh' });
              }
              break;

            // if the incoming data is the data received from a click
            case 'SEND_CLICK':
              if (parsedData.playerScore > 0) {
              // now we can do stuff
              // first update the gamestate data
                console.log('received msg in send_click, starting process now..');
                const newClickAmount = game.addClick(roomData);
                let { playerScore } = parsedData;
                let didClickWin = false;
                console.log(`old click score was: ${roomData.clickAmount}`);

                game.updateGameRoomClickAmount(newClickAmount, parsedData.roomNumber);

                console.log(`roomClickAmount updated, new amount:${newClickAmount}`);
                // check if new clickamount wins anything
                if (newClickAmount % 10 === 0) {
                  playerScore += game.checkClick(newClickAmount);
                  didClickWin = true;
                } else {
                  playerScore--;
                }
                // update the database
                db.updatePlayerScore(databaseConnection, parsedData.username, parsedData.roomNumber, playerScore)
                  .then(() => {
                    // player score updated, send the new scores to all clients
                    // ..so first get the new scores
                    console.log('updating the score was succesfull, now to get the scores..');
                    db.getRoomScores(databaseConnection, parsedData.roomNumber, game.getRoomPlayerList(parsedData.roomNumber))
                      .then(((res) => {
                        sf.sendRoomScoresToClients(parsedData.roomNumber, res, newClickAmount, roomData.turnHolder, didClickWin, roomData.clients);
                      }
                      ));
                  });
              }
              break;

            case 'END_TURN':
              const players = game.getRoomPlayerList(parsedData.roomNumber);
              game.passTurnToNextClient(roomData);
              db.getRoomScores(databaseConnection, parsedData.roomNumber, players).then(((res) => {
                sf.sendRoomScoresToClients(parsedData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients);
              }));
              break;


            case 'EXIT_ROOM':
              sf.handleClientDisconnect(socket);
              // passTurnToNextClient(roomData);
              socket.end();
              break;

            case 'NEW_GAME':
            // what we need to do, is add starting points to client and send other players the new data
              db.updatePlayerScore(databaseConnection, parsedData.username, parsedData.roomNumber, startingScore).then(() => {
                db.getRoomScores(databaseConnection, parsedData.roomNumber, game.getRoomPlayerList(parsedData.roomNumber)).then((res) => {
                  sf.sendRoomScoresToClients(parsedData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients);
                });
              });
              break;
            default:
            // default case
            // just log something, I guess
              console.log('user msg hit the default case -> no event defined');
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
      if (game.isClientStillInRoom(socket))sf.handleClientDisconnect(socket);
    } catch (e) {
      console.log(e);
    }
  });
});


server.listen(3366, () => {
  console.log('server started, listening to port 3366');
});

game.instantiateGameRooms();
