/* eslint-disable max-len */
const db = require('./database');
const game = require('./game_file');

const ErrorMsgCodes = {
  ROOM_FULL: 'ROOM_FULL',
  DISCONNECT: 'DISCONNECT',
  UNKNOWN: 'UNKNOWN',
};
Object.freeze(ErrorMsgCodes);


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
 * SocketErrorMsg is a function, which reports error cases that client needs to be notified with.
 * For example, if the room is full -- or if the client was disconnected.
 *
 * @param {object} socket - Connected socket.
 * @param {ErrorMsgCodes} ErrorMsgCodes - The JS -styled enums containing error cases.
 * @param {string} err - Optional string containing the error msg.
 */
const socketErrorMsg = (socket, ErrorMsgCodes, err) => {
  console.log(`error code${ErrorMsgCodes}`);
  const data = {
    statusCode: 500,
  };
  switch (ErrorMsgCodes) {
    case 'ROOM_FULL':
      data.msg = {
        errorMsg: 'Room was full, try again later',
      };
      break;
    case 'DISCONNECT':
      data.msg = {
        errorMsg: 'Disconnected from the server',
      };
      break;
    case 'UNKNOWN':
      data.msg = {
        errorMsg: 'Unknown error',
      };
      console.log('unkown cause of error, errormsg: ');
      console.log(err);
      break;
  }
  const client = {
    socket,
  };

  sendDataToClient(client, data);
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
 * @param {number} amountWon - A numerical value representing the amount won, if won anything.
 */
const sendRoomScoresToClients = (roomNumber, gameScores, clickAmount, turnHolder, didClickWin, clients, amountWon) => {
  const players = game.getRoomPlayerList(roomNumber);
  const scores = JSON.parse(JSON.stringify(gameScores));
  const msgData = {
    roomNumber,
    clickAmount,
    turnHolder,
    scores,
    players,
    didClickWin,
    amountWon,
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
 */
const msgToDisconnectedClientsRoom = (roomData) => {
  const players = game.getRoomPlayerList(roomData.roomNumber);
  if (players.length > 0) {
    db.getRoomScores(roomData.roomNumber, game.getRoomPlayerList(roomData.roomNumber)).then((res) => {
      sendRoomScoresToClients(roomData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
    });
  }
};

/**
 * HandleClientDisconnect is a function, which is called when a user is disconnected from a room due to a crash, or some
 * other mysterious error. First checks if it was the disconnected clients turn -- if was, advance turn to the next player.
 * If not, just remove the client from the room. Then inform rest of the clients in the room of the disconnect.
 *
 * @param {object} client - The client disconnected from the room.
 */
const handleClientDisconnect = (client) => {
  const roomData = game.getRoomDataWithSocket(client);
  game.removeClientFromRoom(client);
  game.syncTurnHolderToPlayerAmount(roomData);
  client.end();
  msgToDisconnectedClientsRoom(roomData);
};

/**
 * HandleIncomingSocketData is a function, which takes in the incoming byte data, turns it into a string,
 * and then does whatever the incoming data does. Nothing crucial is done before a token is checked from the message.
 * @param socket
 * @param data
 */


const handleIncomingSocketData = (socket, data) => {

  const parsedData = JSON.parse(data.toString());
  db.tokenCheckPipeline(parsedData.token).then(() => {
    socket._sockname = parsedData.username;
    const roomData = game.getRoomData(parsedData.roomNumber);
    switch (parsedData.event) {
      case 'JOIN_ROOM':
        if (game.checkIfRoomAvailable(parsedData.roomNumber)) {
          createNewConnection({
            socket,
            username: parsedData.username,
            roomNumber: parsedData.roomNumber,
          });
          db.checkIfUserHasScore(parsedData.username, parsedData.roomNumber).then(((res) => {
            const parsed = Object.values(res[0]);
            if (parsed[0] === 0) {
              console.log('new player!');
              db.updatePlayerScore(parsedData.username, parsedData.roomNumber, game.playerStartingScore).then(() => {
                const players = game.getRoomPlayerList(parsedData.roomNumber);
                db.getRoomScores(parsedData.roomNumber, players).then(((result) => {
                  sendRoomScoresToClients(parsedData.roomNumber, result, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
                }));
              })
            }else {
              const players = game.getRoomPlayerList(parsedData.roomNumber);
              db.getRoomScores(parsedData.roomNumber, players).then(((result) => {
                sendRoomScoresToClients(parsedData.roomNumber, result, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
              }));
            }
          }));
        } else {
          socketErrorMsg(socket, ErrorMsgCodes.ROOM_FULL, null);
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
          db.updatePlayerScore(parsedData.username, parsedData.roomNumber, playerScore)
              .then(() => {
                db.getRoomScores(parsedData.roomNumber, game.getRoomPlayerList(parsedData.roomNumber))
                    .then(((res) => {
                          sendRoomScoresToClients(parsedData.roomNumber, res, newClickAmount, roomData.turnHolder, didClickWin, roomData.clients, amountWon);
                        }
                    ));
              });
        }
        break;

      case 'END_TURN':
        const players = game.getRoomPlayerList(parsedData.roomNumber);
        game.passTurnToNextClient(roomData);
        db.getRoomScores(parsedData.roomNumber, players).then(((res) => {
          sendRoomScoresToClients(parsedData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
        }));
        break;


      case 'EXIT_ROOM':
        handleClientDisconnect(socket);
        // socket.end();
        break;

      case 'NEW_GAME':
        db.updatePlayerScore(parsedData.username, parsedData.roomNumber, game.playerStartingScore).then(() => {
          db.getRoomScores(parsedData.roomNumber, game.getRoomPlayerList(parsedData.roomNumber)).then((res) => {
            sendRoomScoresToClients(parsedData.roomNumber, res, roomData.clickAmount, roomData.turnHolder, false, roomData.clients, null);
          });
        });
        break;
      default:
        socketErrorMsg(socket, sf.ErrorMsgCodes.UNKNOWN, 'hit the default case, which should be impossible');
        break;
    }
  }).catch((err) => {
    console.log('token data invalid');
    console.log(err);
  });
};


module.exports = {
  createNewConnection,
  sendRoomScoresToClients,
  sendDataToClient,
  handleClientDisconnect,
  socketErrorMsg,
  ErrorMsgCodes,
  handleIncomingSocketData,
};
