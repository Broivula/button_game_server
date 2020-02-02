'use strict';
const express = require('express');
const app = express();
const net = require('net');
const db = require('./database');
const game = require('./game_file');
const bodyParser = require('body-parser');
const maxClientsPerRoom = 10;
var clients = [];
var rooms = [];

// setting up server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// setting up database connection

const database_connection = db.connect();

// routing for the express server, handling regular connections

app.get('/', (req, res) => {
 //  replyFunc(filterClients(1), 'message only in this room \n ');
    //console.log(getRoomData(1).clients < 10)
    db.pipeline(database_connection, 'proof_of_concept_token_for_button_game', db.getRoomScores(database_connection, 1, getRoomPlayerList(1) )).then((res => {
            let parsed = JSON.parse(JSON.stringify(res));
            console.log(parsed);
        }
    ));
});

app.get('/test', (req, res) => {
   // game.addClick(rooms[0], 2)
    var data = getGameRoomsData();
    data.forEach(room => {console.log(room)});
})

app.get('/get/rooms_data', (req, res) => {
    let token = req.get('Authorization');

    db.pipeline(database_connection, token).then((result => {
        if(result){
            res.json(getGameRoomsData());
        }else{
            res.json({error_msg: 'token auth failure'});
        }
    })).catch(err => {console.log(err);});
});

app.post('/post/check_user_availability', (req, res) => {
    let token = req.get('Authorization');
    let username = req.body.username;
    console.log('testing for username: ' + username);
    db.pipeline(database_connection, token, db.checkIfUserExists(database_connection, username)).then((result) => {
        let parsed = Object.values(result[0]);
        let available;
        parsed === 1 ? available = false : available = true;
        res.json({username_available: available });
    }).catch(err => {
        res.json({error_msg: 'error ing username availability'})
    });
});

app.post('/post/newuser', (req, res) => {
    // username hard coded now for testing purposes
    let token = req.get('Authorization');
    let username = req.body.username;
    db.pipeline(database_connection, token, db.addUser(database_connection, username)).then((result) => {
        console.log(result);
        res.json({uid: result});
    }).catch(err => {
        console.log('error adding a new user');
        console.log(err);
        res.json({error_msg: 'error inserting a new user to server db'});
    });
});

const error_msg = (res) => {
    console.log('aaay, mistake bruh');
    res.json({err: 'token authentication failure'})
};

app.listen(3000);

// routing functions

const getGameRoomsData = () => {
    return  rooms.map(room => {
    return({
        roomNumber : room.roomNumber,
        playerCount : room.clients.length,
        curClick : room.clickAmount,
    });
   })    
};

const instantiateGameRooms = () => {
    for (let i = 1; i < 4; i++){
       rooms.push(game.initiateGame(i))
    }
};

// configuration for the socket connections

const server = net.createServer();

server.on('connection', (socket) => {

    socket.setEncoding('utf-8');

    socket.on('data', (data) => {
        if(data.length > 5){
            try{
                console.log('data incoming:');
                let parsedData = JSON.parse(data.toString());
                console.log(parsedData);
                switch (parsedData.event) {
                    //if the incoming data is aiming to join a room
                    case 'JOIN_ROOM':
                        if(checkIfRoomAvailable(parsedData.roomNumber)){
                            let roomData = getRoomData(parsedData.roomNumber);
                            db.pipeline(database_connection, parsedData.token).then((res, err) => {
                                createNewConnection({
                                    socket : socket,
                                    username : parsedData.username,
                                    roomNumber : parsedData.roomNumber
                                });

                                // connection created, player has joined the room. now, send the room scores and relevant data to them.
                                db.pipeline(database_connection, parsedData.token, db.getRoomScores(database_connection, parsedData.roomNumber, getRoomPlayerList(parsedData.roomNumber))).then((res => {
                                        let turnHolder = roomData.clients[roomData.turnHolder] === socket;
                                        let gameScores = JSON.parse(JSON.stringify(res));
                                        let msgData = {
                                            roomNumber : parsedData.roomNumber,
                                            clickAmount : roomData.clickAmount,
                                            turnHolder : turnHolder,
                                            scores : gameScores,
                                            didClickWin : false
                                        };
                                        sendDataToRoomClients(roomData.clients, {statusCode:200, msg:msgData})
                                })
                                )

                            }).catch(err => {
                                console.log('invalid data sent via socket');
                                console.log(err);
                            });
                        }else{
                            // room was full, respond with appropriate message
                            sendDataToClient(socket, {statusCode:400, msg:"room full bruh"})
                        }
                        break;

                        // if the incoming data is the data received from a click
                    case 'SEND_CLICK':
                        if(parsedData.playerScore > 0){
                            // now we can do stuff
                            // first update the gamestate data
                            let roomData = getRoomData(parsedData.roomNumber);
                            let newClickAmount = game.addClick(roomData);
                            let playerScore = parsedData.playerScore;
                            let didClickWin = false;

                            updateGameRoomClickAmount(newClickAmount, parsedData.roomNumber);

                            // check if new clickamount wins anything
                            if(newClickAmount % 10 === 0){
                                playerScore = playerScore + game.checkClick(newClickAmount);
                                didClickWin = true
                            }else{
                                playerScore--;
                            }

                            console.log('starting the chain, with following values:');
                            console.log('score: ' + playerScore);
                            // update the database
                            db.pipeline(database_connection, parsedData.token, db.updatePlayerScore(database_connection, parsedData.username, parsedData.roomNumber, playerScore)).then(() => {
                                // player score updated, send the new scores to all clients
                                // ..so first get the new scores
                                console.log('updating the score was succesfull, now to get the scores..');
                                db.pipeline(database_connection, parsedData.token, db.getRoomScores(database_connection, parsedData.roomNumber, getRoomPlayerList(parsedData.roomNumber))).then((res => {
                                        let turnHolder = roomData.clients[roomData.turnHolder] === socket;
                                        let gameScores = JSON.parse(JSON.stringify(res));
                                        let msgData = {
                                            roomNumber : parsedData.roomNumber,
                                            clickAmount : newClickAmount,
                                            turnHolder : turnHolder,
                                            scores : gameScores,
                                            didClickWin : didClickWin
                                        };
                                        sendDataToRoomClients(roomData.clients, {statusCode:200, msg:msgData})
                                    }
                                ));
                            })
                        }
                }

           }catch(err){
               console.log('error parsing incoming socket data');
               console.log(err)
           }
        };
    });

    socket.on('drain', () => {
        console.log('buffer cleared again, resume writing data');
        socket.resume();
    });

    socket.on('error', (err) => {
        console.log('something went wrong..');
        console.log(err);
    });

});


server.listen(3366, () => {
    console.log('server started, listening to port 3366');
});

// socket communication functions
const sendDataInRoom = (data) => {
    var room = data.room;
    var msg = data.msg;
}

const updatePlayerScore = () => {

};

const sendDataToClient = (client, data) => {
    let isBufferFull =  client.socket.write(constructMessage(data) + '\n') ? console.log('data sent') : client.socket.pause();
};

const sendDataToRoomClients = (clients, data) => {
    try{
        clients.forEach(client =>{
        sendDataToClient(client, data) 
        })
    }catch (err) {console.log(err)}

};

// since the tcp socket  cannot send straight up json, we construct the string here and send it
const constructMessage = (data) => {
    let stringifiedMsg = JSON.stringify(data.msg);
    return JSON.stringify({
        status: data.statusCode,
        msg: stringifiedMsg,
    })
};

const createNewConnection = (data) => {
   const clientData =
   {
       socket : data.socket,
       username : data.username,
       roomNumber : data.roomNumber
   };
    clients.push(clientData);
    addClientToRoom(clientData);
};

const getRoomData = (roomNumber) => {
    return rooms.filter((room) => {return room.roomNumber === roomNumber})[0]
};

const addClientToRoom = (clientData) => {
    getRoomData(clientData.roomNumber).clients.push(clientData);
};

const updateGameRoomClickAmount = (newAmount, roomNumber) => {
    getRoomData(roomNumber).clickAmount = newAmount
};

const checkIfRoomAvailable = (roomNumber) => {
    return getRoomData(roomNumber).clients.length < maxClientsPerRoom
};

const getRoomPlayerList = (roomNumber) => {
    return getRoomData(roomNumber).clients.map((client) => {return client.username})
};



const filterClients = (room) => clients.filter((client => {return client.roomNumber== room}));

// set up the game rooms

instantiateGameRooms();
