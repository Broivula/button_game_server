/* eslint-disable max-len */
const db = require('./database');
const game = require('./game_file');


/**
 * ConstructMessage is a function, which builds the data to be sent via socket.
 *
 * @param {object} data - The data to be built -- contains status code and the message itself.
 * @returns {string} The stringified results of the object -- ready to be sent via socket.
 */
const constructMessage = (data) => {
  const stringifiedMsg = JSON.stringify(data.msg);
  return JSON.stringify({
    status: data.statusCode,
    msg: stringifiedMsg,
  });
};

/**
 * SendDataToClient is a function, which sends data to one client.
 *
 * @param {object} client - The object containing the client data -- socket information.
 * @param {object} data - The data to be sent.
 */
const sendDataToClient = (client, data) => {
  client.socket.write(`${constructMessage(data)}\n`) ? console.log('data sent') : client.socket.pause();
};

/**
 * SendDataToRoomClients is a function, which sends given data to all clients in a room.
 *
 * @param {Array} clients - An array containing the client information of all the connected clients in one room.
 * @param {object} data - The data to be sent.
 */
const sendDataToRoomClients = (clients, data) => {
  try {
    clients.forEach((client) => {
      sendDataToClient(client, data);
    });
  } catch (err) { console.log(err); }
};

/**
 * SendRoomScoresToClients is a function, which sends the scores of a given room to the clients in that room.
 * The scores are fetched from database -- then given as a parameter. Executes the data streaming pipeline.
 *
 * @param {number} roomNumber - The number of the room this action has taken place.
 * @param {Array} gameScores - An array containing objects of the scores -- paired with username and score.
 * @param {number} clickAmount - A number containing the current amount of clicks in the room.
 * @param {number} turnHolder - A numerical value for the current turn holder -- corresponding to the position in the
 *                              game states clients array.
 * @param {boolean} didClickWin - Boolean containing information about did the incoming click win.
 * @param {Array} clients - An array containing the clients in the room.
 */
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

/**
 * CreateNewConnection is a function, which is called when the user joins a room. A new client object is created
 * and then inserted into the rooms clients array.
 *
 * @param {object} data - The data of the connected client.
 */
const createNewConnection = (data) => {
  const clientData = {
    socket: data.socket,
    username: data.username,
    roomNumber: data.roomNumber,
  };
  game.addClientToRoom(clientData);
};


/**
 * MsgToDisconnectedClientsRoom is a function, which is called when a user disconnects from a room.
 * If there are still players in the room, the current room scores are fetched and returned to other clients.
 *
 * @param {object} roomData - The data of the room the client disconnected from.
 * @param {object} dbConn - The object containing the database connection information. Used to receive the latest
 *                          room score data.
 */
const msgToDisconnectedClientsRoom = (roomData, dbConn) => {
  const players = game.getRoomPlayerList(roomData.roomNumber);
  if (players.length > 0) {
    db.getRoomScores(dbConn, roomData.roomNumber, game.getRoomPlayerList(roomData.roomNumber)).then((res) => {
      sendRoomScoresToClients(roomData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients);
    });
  }
};

/**
 * HandleClientDisconnect is a function, which is called when a user is disconnected from a room due to a crash, or some
 * other mysterious error. First checks if it was the disconnected clients turn -- if was, advance turn to the next player.
 * If not, just remove the client from the room. Then inform rest of the clients in the room of the disconnect.
 *
 * @param {object} client - The client disconnected from the room.
 * @param {object} dbConn - The object containing the database connection information. Used to receive the latest
 *                          room score data.
 */
const handleClientDisconnect = (client, dbConn) => {
  const roomData = game.getRoomDataWithSocket(client);
  if (game.wasItClientsTurn(client, roomData)) {
    game.removeClientFromRoom(client);
    game.passTurnToNextClient(roomData);
  } else {
    game.removeClientFromRoom(client, dbConn);
  }
  msgToDisconnectedClientsRoom(roomData, dbConn);
};


module.exports = {
  createNewConnection,
  sendRoomScoresToClients,
  sendDataToClient,
  handleClientDisconnect,
};
