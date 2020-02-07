
require('net');

const rooms = [];
const maxClientsPerRoom = 10;
const maxRooms = 3;

const initiateGame = (roomNumber) => ({
  clients: [],
  roomNumber,
  clickAmount: 0,
  turnHolder: 0,
});


const instantiateGameRooms = () => {
  for (let i = 1; i < (maxRooms + 1); i++) {
    rooms.push(initiateGame(i));
  }
};

const getRoomData = (roomNumber) => rooms.filter((room) => room.roomNumber === roomNumber)[0];


const getRoomDataWithSocket = (client) => rooms.filter((room) => {
  const r = room.clients.filter((c) => { if (c.socket === client) return c; })[0];
  if (r !== undefined) return r;
})[0];

const getAllRoomsData = () => rooms;

// a function specifically for when routing asks for roomdata
const getGameRoomsData = () => rooms.map((room) => ({
  roomNumber: room.roomNumber,
  playerCount: room.clients.length,
  curClick: room.clickAmount,
}));

// a function to get the playerlist of given room in string array
const getRoomPlayerList = (roomNumber) => getRoomData(roomNumber).clients.map((client) => client.username);

// a function to check if given room is available
const checkIfRoomAvailable = (roomNumber) => getRoomData(roomNumber).clients.length < maxClientsPerRoom;

// a function to push the clients data into the array containing room clients
const addClientToRoom = (clientData) => {
  getRoomData(clientData.roomNumber).clients.push(clientData);
};

// a function to to update the number of clicks in a given
const updateGameRoomClickAmount = (newAmount, roomNumber) => {
  getRoomData(roomNumber).clickAmount = newAmount;
};

const indexOfClientInRoom = (client) => getRoomDataWithSocket(client).clients.indexOf(client);

// a function to remove a client from a room --> works on given socket connection
const removeClientFromRoom = (client) => {
  getRoomDataWithSocket(client).clients.splice(indexOfClientInRoom(client), 1);
};

const isClientStillInRoom = (client) => {
  const room = getRoomDataWithSocket(client);
  if (room === undefined) return false;
  return indexOfClientInRoom(client) !== undefined
  //room.clients.filter((c) => { if (c.socket === client) return true; });
};

// a function to give the turn to the next person in line
const passTurnToNextClient = (roomData) => {
  const next = roomData.turnHolder + 1;
  (next > roomData.clients.length - 1) ? getRoomData(roomData.roomNumber).turnHolder = 0 : getRoomData(roomData.roomNumber).turnHolder = next;
};

const wasItClientsTurn = (client, roomData) => {
  let turn = false;
  const r = roomData.clients.filter((c) => { if (c.socket === client) return c; })[0];
  if (r !== undefined) {
    const players = getRoomPlayerList(r.roomNumber);
    turn = players[roomData.turnHolder] === r.username;
  }
  return turn;
};


const addClick = (roomData) => roomData.clickAmount + 1;

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
};
