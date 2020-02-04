
require('net');

const initiateGame = (roomNumber) => ({
  clients: [],
  roomNumber,
  clickAmount: 0,
  turnHolder: 0,
});


const addClick = (roomData) => {
  return roomData.clickAmount + 1;
};

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

};
