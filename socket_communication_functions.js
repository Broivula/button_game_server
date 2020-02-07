/* eslint-disable max-len */
const db = require('./database');
const game = require('./game_file');


// a function to construct the msg of the data being sent through the socket
const constructMessage = (data) => {
  const stringifiedMsg = JSON.stringify(data.msg);
  return JSON.stringify({
    status: data.statusCode,
    msg: stringifiedMsg,
  });
};


// a function to send data to a single client (mainly for error data)
const sendDataToClient = (client, data) => {
  client.socket.write(`${constructMessage(data)}\n`) ? console.log('data sent') : client.socket.pause();
};


// a function to send data to all the clients given as a parameter (mainly for people in a room)
const sendDataToRoomClients = (clients, data) => {
  try {
    clients.forEach((client) => {
      sendDataToClient(client, data);
    });
  } catch (err) { console.log(err); }
};

// the function to update connected clients about the room score situation

const sendRoomScoresToClients = (roomNumber, gameScores, clickAmount, turnHolder, didClickWin, clients) => {
  const players = game.getRoomPlayerList(roomNumber);
  const scores = JSON.parse(JSON.stringify(gameScores));
  const msgData = {
    roomNumber,
    clickAmount,
    turnHolder,
    scores,
    players,
    didClickWin,
  };

  sendDataToRoomClients(clients, { statusCode: 200, msg: msgData });
};


// a function to add the incoming socket into a room
const createNewConnection = (data) => {
  const clientData = {
    socket: data.socket,
    username: data.username,
    roomNumber: data.roomNumber,
  };
  game.addClientToRoom(clientData);
};


const msgToDisconnectedClientsRoom = (roomData, dbConn) => {
  const players = game.getRoomPlayerList(roomData.roomNumber);
  if (players.length > 0) {
    db.getRoomScores(dbConn, roomData.roomNumber, game.getRoomPlayerList(roomData.roomNumber)).then((res) => {
      sendRoomScoresToClients(roomData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients);
    });
  }
};

const handleClientDisconnect = (client, dbConn) => {
  const roomData = game.getRoomDataWithSocket(client);
  if (game.wasItClientsTurn(client, roomData)) {
    game.removeClientFromRoom(client);
    game.passTurnToNextClient(roomData);
  } else {
    game.removeClientFromRoom(client, dbConn);
  }
  msgToDisconnectedClientsRoom(roomData);
};


module.exports = {
  createNewConnection,
  sendRoomScoresToClients,
  sendDataToClient,
  handleClientDisconnect,
};
