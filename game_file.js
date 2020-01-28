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

    console.log('add click function, inc roomdata: ')
    console.log(roomData);
    var newClickAmount = room_data.clickAmount + 1;
    if(newClickAmount == 3){
        roomData.turnHolder.socket.write("congrats, you hit 3!")
    }
    roomData.clickAmount = newClickAmount;
    return roomData;
}

module.exports = {

    initiateGame : initiateGame, 
    addClick : addClick,

}
