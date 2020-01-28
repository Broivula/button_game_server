require('net');

const initiateGame = (client_list, room_number) => {
    return {
        clients : client_list,
        room_number : room_number,
        click_amount : 1,
        turn_holder : client_list[0]
    }
}


const addClick = (room_data) => {

    console.log('add click function, inc roomdata: ')
    console.log(room_data);
    var new_click = room_data.click_amount + 1;
    if(new_click == 3){
        room_data.turn_holder.socket.write("congrats, you hit 3!")
    }
    room_data.click_amount = new_click;
    return room_data;
}

module.exports = {

    initiateGame : initiateGame, 
    addClick : addClick,

}
