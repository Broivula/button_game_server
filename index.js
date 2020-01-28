const express = require('express');
const app = express();
const net = require('net');
const db = require('./database');
const game = require('./game_file');
const bodyParser = require('body-parser');
var clients = [];
var rooms = [];

// setting up server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// setting up database connection

var database_connection = db.connect();


// routing for the express server, handling regular connections

app.get('/', (req, res) => {
    instantiateGameRooms();
 //  replyFunc(filterClients(1), 'message only in this room \n ');

});

app.get('/test', (req, res) => {
   // game.addClick(rooms[0], 2)
    var data = getGameRoomsData();
    data.forEach(room => {console.log(room)});
})

app.get('/get/rooms_data', (req, res) => {
    var token = req.get('Authorization');

    db.checkToken(database_connection, token).then((result => {
        if(result){
            res.json(getGameRoomsData());
        }else{
            res.json({error_msg: 'token auth failure'});
        }
    }))
});

app.post('/post/check_user_availability', (req, res) => {
    var token = req.get('Authorization');
    var username = req.body.username;
    console.log('testing for username: ' + username);
    db.checkToken(database_connection, token, db.checkIfUserExists(database_connection, username)).then((result) => {
        var parsed = Object.values(result[0]);
        var available;
        parsed == 1 ? available = false : available = true;
        res.json({username_available: available });
    }).catch(err => {
        res.json({error_msg: 'error checking username availability'})
    });
});

app.post('/post/newuser', (req, res) => {
    // username hard coded now for testing purposes
    var token = req.get('Authorization');
    var username = req.body.username;
    db.checkToken(database_connection, token, db.addUser(database_connection, username)).then((result) => {
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
}

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
}

const instantiateGameRooms = () => {
    for (var i = 1; i < 4; i++){
       rooms.push(game.initiateGame(i))
    }
}

// configuration for the socket connections

server = net.createServer()

server.on('connection', (socket) => {
    
    socket.setEncoding('utf-8');

    socket.on('data', (data) => {
        if(data.length > 2){
            console.log('data incoming:');
            var parsedData = JSON.parse(data.toString());
            console.log(parsedData);

             createNewConnection({
                 socket : socket,
                 username : parsedData.username,
                 roomNumber : parsedData.roomNumber
             });

             var is_buffer_full = socket.write('response, yo! \n') ? console.log('data sent!')
                    : socket.pause();
        
        //        server.getConnections((err, count) => {console.log('number of connections ' + count)});
        };
    });

    socket.on('drain', () => {
        console.log('buffer cleared again, resume writing data');
        socket.resume();
    });

    socket.on('error', (err) => {
        console.log('something went wrong..');
        Vconsole.log(err);
    });

});


server.on('connection', (s) => {
    console.log('new connection to server, wth dude');
});

server.listen(3366, () => {
    console.log('server started, listening to port 3366');
});

// socket communication functions
const sendDataInRoom = (data) => {
    var room = data.room;
    var msg = data.msg;
}

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

const addClientToRoom = (clientData) => {
    rooms.filter((room) => { return room.roomNumber == clientData.roomNumber})[0].clients.push(clientData);
}

const replyFunc = (arr, data) => {arr.forEach(client =>{
    client.socket.write(data)
    })
};

const filterClients = (room) => clients.filter((client => {return client.roomNumber== room}))

