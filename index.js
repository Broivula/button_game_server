const express = require('express');

const app = express();
const net = require('net');
const bodyParser = require('body-parser');
const db = require('./database');
const game = require('./game_file');

const maxClientsPerRoom = 10;
const rooms = [];
const startingScore = 20;

// setting up server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// setting up database connection

const database_connection = db.connect();

// routing for the express server, handling regular connections

app.get('/', (req, res) => {
  db.pipeline(database_connection, 'proof_of_concept_token_for_button_game', db.getRoomScores(database_connection, 1, getRoomPlayerList(1))).then(((res) => {
    const parsed = JSON.parse(JSON.stringify(res));
    console.log(parsed);
  }
  ));
});


app.get('/test', (req, res) => {
  // game.addClick(rooms[0], 2)
//  const data = getGameRoomsData();
//  data.forEach((room) => { console.log(room); });
});

app.get('/get/rooms_data', (req, res) => {
  const token = req.get('Authorization');

  db.pipeline(database_connection, token).then(((result) => {
    if (result) {
      res.json(getGameRoomsData());
    } else {
      res.json({ error_msg: 'token auth failure' });
    }
  })).catch((err) => { console.log(err); });
});

app.post('/post/check_user_availability', (req, res) => {
  const token = req.get('Authorization');
  const { username } = req.body;
  console.log(`testing for username: ${username}`);
  db.pipeline(database_connection, token, db.checkIfUserExists(database_connection, username)).then((result) => {
    const parsed = Object.values(result[0]);
    let available;
    parsed === 1 ? available = false : available = true;
    res.json({ username_available: available });
  }).catch((err) => {
    res.json({ error_msg: 'error ing username availability' });
  });
});

app.post('/post/newuser', (req, res) => {
  // username hard coded now for testing purposes
  const token = req.get('Authorization');
  const { username } = req.body;
  db.pipeline(database_connection, token, db.addUser(database_connection, username)).then((result) => {
    console.log(result);
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

// routing functions

const getGameRoomsData = () => rooms.map((room) => ({
  roomNumber: room.roomNumber,
  playerCount: room.clients.length,
  curClick: room.clickAmount,
}));

const instantiateGameRooms = () => {
  for (let i = 1; i < 4; i++) {
    rooms.push(game.initiateGame(i));
  }
};

// configuration for the socket connections

const server = net.createServer();

server.on('connection', (socket) => {
  socket.setEncoding('utf-8');

  socket.on('data', (data) => {
    if (data.length > 5) {
      try {
        console.log('data incoming:');
        const parsedData = JSON.parse(data.toString());
        console.log(parsedData);
        switch (parsedData.event) {
          // if the incoming data is aiming to join a room
          case 'JOIN_ROOM':
            if (checkIfRoomAvailable(parsedData.roomNumber)) {
              const roomData = getRoomData(parsedData.roomNumber);
              // check the token
              db.pipeline(database_connection, parsedData.token).then(() => {
                createNewConnection({
                  socket,
                  username: parsedData.username,
                  roomNumber: parsedData.roomNumber,
                });

                // connection created, player has joined the room. now, send the room scores and relevant data to them.
                // first, check if player has a current score in the room --if not, add them there
                db.checkIfUserHasScore(database_connection, parsedData.username, parsedData.roomNumber).then((res => {
                  console.log('user score status: ');
                  const parsed = Object.values(res[0]);
                  console.log(parsed[0]);
                  // no score was found, add starting score in the table
                  if(parsed[0] === 0){
                    console.log('new user, create a score for this room!');
                    db.updatePlayerScore(database_connection, parsedData.username, parsedData.roomNumber, startingScore);
                  }
                  const players = getRoomPlayerList(parsedData.roomNumber);
                  db.getRoomScores(database_connection, parsedData.roomNumber, players).then(((res) => {
                    const gameScores = JSON.parse(JSON.stringify(res));
                    const msgData = {
                      roomNumber: parsedData.roomNumber,
                      clickAmount: roomData.clickAmount,
                      turnHolder : roomData.turnHolder,
                      players : players,
                      scores: gameScores,
                      didClickWin: false,
                    };
                    sendDataToRoomClients(roomData.clients, { statusCode: 200, msg: msgData });
                }));
                }));
              }).catch((err) => {
                console.log('invalid data sent via socket');
                console.log(err);
              });
            } else {
              // room was full, respond with appropriate message
              sendDataToClient(socket, { statusCode: 400, msg: 'room full bruh' });
            }
            break;

            // if the incoming data is the data received from a click
          case 'SEND_CLICK':
            if (parsedData.playerScore > 0) {
              // now we can do stuff
              // first update the gamestate data
              const roomData = getRoomData(parsedData.roomNumber);
              const newClickAmount = game.addClick(roomData);
              let { playerScore } = parsedData;
              let didClickWin = false;

              updateGameRoomClickAmount(newClickAmount, parsedData.roomNumber);

              // check if new clickamount wins anything
              if (newClickAmount % 10 === 0) {
                playerScore += game.checkClick(newClickAmount);
                didClickWin = true;
              } else {
                playerScore--;
              }

              console.log('starting the chain, with following values:');
              console.log(`score: ${playerScore}`);
              // update the database
              db.pipeline(database_connection, parsedData.token, db.updatePlayerScore(database_connection, parsedData.username, parsedData.roomNumber, playerScore))
                    .then(() => {
                // player score updated, send the new scores to all clients
                // ..so first get the new scores
                console.log('updating the score was succesfull, now to get the scores..');
                db.pipeline(database_connection, parsedData.token, db.getRoomScores
                  (database_connection, parsedData.roomNumber, getRoomPlayerList(parsedData.roomNumber)))
                      .then(((res) => {
                  const gameScores = JSON.parse(JSON.stringify(res));
                  const msgData = {
                    roomNumber: parsedData.roomNumber,
                    clickAmount: newClickAmount,
                    turnHolder : roomData.turnHolder,
                    scores: gameScores,
                    didClickWin,
                  };
                  sendDataToRoomClients(roomData.clients, { statusCode: 200, msg: msgData });
                }
                ));
              });
            }
            break;

          case 'EXIT_ROOM':
            removeClientFromRoom(socket);
            socket.end();
            break;

          default:
            // default case
            // just log something, I guess
            console.log('user msg hit the default case -> no event defined');
        }
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

  socket.on('close', (data) => {
    console.log('socket closed');
    removeClientFromRoom(socket);
  });
});


server.listen(3366, () => {
  console.log('server started, listening to port 3366');
});

// socket communication functions

const sendDataToClient = (client, data) => {
  const isBufferFull = client.socket.write(`${constructMessage(data)}\n`) ? console.log('data sent') : client.socket.pause();
};

const sendDataToRoomClients = (clients, data) => {
  try {
    clients.forEach((client) => {
      sendDataToClient(client, data);
    });
  } catch (err) { console.log(err); }
};

// since the tcp socket  cannot send straight up json, we construct the string here and send it
const constructMessage = (data) => {
  const stringifiedMsg = JSON.stringify(data.msg);
  return JSON.stringify({
    status: data.statusCode,
    msg: stringifiedMsg,
  });
};

const createNewConnection = (data) => {
  const clientData = {
    socket: data.socket,
    username: data.username,
    roomNumber: data.roomNumber,
  };
  addClientToRoom(clientData);
};

const getRoomData = (roomNumber) => rooms.filter((room) => room.roomNumber === roomNumber)[0];

const addClientToRoom = (clientData) => {
  getRoomData(clientData.roomNumber).clients.push(clientData);
};

const updateGameRoomClickAmount = (newAmount, roomNumber) => {
  getRoomData(roomNumber).clickAmount = newAmount;
};

const checkIfRoomAvailable = (roomNumber) => getRoomData(roomNumber).clients.length < maxClientsPerRoom;

const getRoomPlayerList = (roomNumber) => getRoomData(roomNumber).clients.map((client) => client.username);

const removeClientFromRoom = (client) => {
  rooms.forEach((room) => {
    room.clients = room.clients.filter((c) => c.socket !== client);
  });
};

// set up the game rooms

instantiateGameRooms();
