'use strict';
require('net');

const initiateGame = (roomNumber) => {
    return {
        clients : [],
        roomNumber : roomNumber,
        clickAmount : 1,
        turnHolder : 0
    }
}


const addClick = (roomData) => {

    console.log('add click function, inc roomdata: ');
    console.log(roomData);
    return roomData.clickAmount + 1;

};

const checkClick = (clickAmount) => {
    if((clickAmount % 100) === 0){
        return clickAmount % 500 === 0 ? 250 : 100
    }else{
        return 10
    }
};

module.exports = {

    initiateGame : initiateGame, 
    addClick : addClick,
    checkClick : checkClick,

}
