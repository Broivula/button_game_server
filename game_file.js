
require('net');

const rooms = [];
const maxClientsPerRoom = 10;
const maxRooms = 3;

/**
 * InitiateGame is a function, which initiates the games with the given values.
 *
 * @param {number} roomNumber - The room number of the game being created.
 * @returns {object} The object of the game state.
 */
const initiateGame = (roomNumber) => ({
  clients: [],
  roomNumber,
  clickAmount: 0,
  turnHolder: 0,
});

/**
 * InitiateGameRooms is the function called from index.js when the server is started.
 * Creates the game rooms.
 */
const instantiateGameRooms = () => {
  for (let i = 1; i < (maxRooms + 1); i++) {
    rooms.push(initiateGame(i));
  }
};

/**
 * GetRoomData is a function, which returns the data of a given room.
 *
 * @param {number} roomNumber - The room number of the room being requested.
 * @returns {object} The object of the game state.
 */
const getRoomData = (roomNumber) => rooms.filter((room) => room.roomNumber === roomNumber)[0];

/**
 * GetRoomDataWithSocket is a function, which returns the data of a given room.
 * Differs from getRoomData -function in that, this one does it with the given
 * client connection --instead of roomNumber. Used  when sudden disconnects happen
 * and there is no time for the disconnected socket to message their roomNumber to the server.
 *
 * @param {object} client - The client data of the room being requested.
 * @returns {object} The object of the game state.
 */
const getRoomDataWithSocket = (client) => rooms.filter((room) => {
  const r = room.clients.filter((c) => { if (c.socket === client) return c; })[0];
  if (r !== undefined) return r;
})[0];

/**
 * GetAllRoomsData is a function, which returns the array containing the data of all of the rooms.
 *
 * @returns {Array} An array containing all the room states.
 */
const getAllRoomsData = () => rooms;

/**
 * GetGameRoomsData is a function, which returns formatted data of all of the rooms.
 * Used when routing requests the state of the rooms.
 *
 * @returns {Array} An array containing data of the room states.
 */
const getGameRoomsData = () => rooms.map((room) => ({
  roomNumber: room.roomNumber,
  playerCount: room.clients.length,
  curClick: room.clickAmount,
}));

/**
 * GetRoomPlayerList is a function, which returns the usernames of a given room.
 *
 * @param {number} roomNumber - Number of the room of being checked.
 * @returns {Array} An array containing the usernames of the clients in that room.
 */
const getRoomPlayerList = (roomNumber) => getRoomData(roomNumber).clients.map((client) => client.username);

/**
 * CheckIfRoomAvailable is a function, which returns a boolean stating if that room has any room
 * for more players to join.
 *
 * @param {number} roomNumber - Number of the room being checked.
 * @returns {boolean} The boolean value of is there more room in the... Well, room.
 */
const checkIfRoomAvailable = (roomNumber) => getRoomData(roomNumber).clients.length < maxClientsPerRoom;

/**
 * AddClientToRoom is a function, which adds the given client data into the array of the room clients.
 *
 * @param {object} clientData - The client data to be added into the room.
 */
const addClientToRoom = (clientData) => {
  getRoomData(clientData.roomNumber).clients.push(clientData);
};

/**
 * UpdateGameRoomClickAmount is a function, which updates the current click amount of a given room.
 *
 * @param {number} newAmount - Number of the new amount of clicks in that room.
 * @param {number} roomNumber - Number of the room being updated.
 *
 */
const updateGameRoomClickAmount = (newAmount, roomNumber) => {
  getRoomData(roomNumber).clickAmount = newAmount;
};

/**
 * IndexOfClientInRoom is a function, which returns the index of given client in that games client array.
 *
 * @param {object} client - Client being checked.
 * @returns {number} The index number of the client.
 */
const indexOfClientInRoom = (client) => getRoomDataWithSocket(client).clients.map((c) =>
{console.log('client is ' + client._sockname);
console.log('and c is: ' + c.username);
  return c.username}).indexOf(client._sockname);

/**
 * RemoveClientFromRoom is a function, which removes given client from their room.
 *
 * @param {object} client - Client being removed.
 */
const removeClientFromRoom = (client) => {
  getRoomDataWithSocket(client).clients.splice(indexOfClientInRoom(client), 1);
};


const syncTurnHolderToPlayerAmount = (roomData) => {
  if((roomData.clients.length - 1) < roomData.turnHolder && roomData.clients.length > 0) {
    roomData.turnHolder = roomData.clients.length -1
  }
};

/**
 * IsClientStillInRoom is a function, which checks if the given client is still occupying
 * their room. Is called when the servers on socket 'disconnect' -event is called.
 *
 * @param {object} client - Client being removed.
 * @returns {boolean} The boolean state of client occupying the room or not.
 */
const isClientStillInRoom = (client) => {
  const room = getRoomDataWithSocket(client);
  if (room === undefined) return false;
  return indexOfClientInRoom(client) !== undefined;
};

/**
 * PassTurnToNextClient is a function, which gives the turn to the next client in that games
 * client array.
 *
 * @param {object} roomData - The data of the room being modified.
 */
const passTurnToNextClient = (roomData) => {
  const next = roomData.turnHolder + 1;
  (next > roomData.clients.length - 1) ? getRoomData(roomData.roomNumber).turnHolder = 0 : getRoomData(roomData.roomNumber).turnHolder = next;
};

/**
 * WasItClientsTurn is a function, which checks if it currently is given clients turn.
 * Used when client unexpectedly disconnects and server needs to know wheter it was that clients turn or not.
 *
 * @param {object} roomData - The data of the room being checked.
 * @param {object} client - The socket data of the disconnected client.
 * @returns {boolean} The boolean state of whether it was clients turn or not.
 */
const wasItClientsTurn = (client, roomData) => {
  let turn = false;
  const clientData = roomData.clients.filter((c) => { if (c.socket === client) return c; })[0];
  if (clientData !== undefined) {
    const players = getRoomPlayerList(clientData.roomNumber);
    turn = players[roomData.turnHolder] === clientData.username;
  }
  return turn;
};

/**
 * AddClick is a function, which increments the given rooms click count.
 *
 * @param {object} roomData - The data of the room being modified.
 */
const addClick = (roomData) => roomData.clickAmount + 1;


/**
 * CheckClick is a function, which checks if the given click won anything.
 *
 * @param {number} clickAmount - Number being checked.
 * @returns {number} Returns the amount won with the click.
 */
const checkClick = (clickAmount) => {
  if ((clickAmount % 100) === 0) {
    return clickAmount % 500 === 0 ? 250 : 40;
  }
  return 5;
};

module.exports = {
  initiateGame,
  addClick,
  checkClick,
  getRoomData,
  getRoomPlayerList,
  checkIfRoomAvailable,
  addClientToRoom,
  updateGameRoomClickAmount,
  isClientStillInRoom,
  wasItClientsTurn,
  removeClientFromRoom,
  passTurnToNextClient,
  getRoomDataWithSocket,
  getAllRoomsData,
  instantiateGameRooms,
  getGameRoomsData,
  syncTurnHolderToPlayerAmount
};
