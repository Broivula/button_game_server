const express = require('express');
const app = express();
const net = require('net');
const db = require('./database');
clients = [];

// setting up database connection

var database_connection = db.connect();

//console.log(result);

// routing for the express server, handling regular connections

app.get('/', (req, res) => {
    console.log('test');
   // result =  clients[0].write('data\n');
   // console.log('result of write: ' + result);
    db.add_user(database_connection).then((result) => 
    {
        var parsed = JSON.parse(JSON.stringify(result[0]))
        console.log(parsed);
    });
});

app.get('/get/usernames', (req, res) => {
    db.get_usernames(database_connection).then((result) => {
        var parsed = JSON.parse(JSON.stringify(result));
        console.log(parsed);
    });
});

app.post('/post/newuser', (req, res) => {
    db.add_user(database.connection).then((result) => {
        console.log(result);
    });
});

app.listen(3000);


// configuration for the socket connections

server = net.createServer()

server.on('connection', (socket) => {
    
    socket.setEncoding('utf-8');

    socket.on('data', (data) => {
        console.log('data incoming:');
        console.log(data.toString());

        var is_buffer_full = socket.write('response, yo! \n') ? console.log('data sent!')
            : socket.pause();
        
    });

    socket.on('drain', () => {
        console.log('buffer cleared again, resume writing data');
        socket.resume();
    });

    socket.on('error', (err) => {
        console.log('something went wrong..');
        console.log(err);
    });

    clients.push(socket);
});


server.on('connection', (s) => {
    console.log('new connection to server, wth dude');
});

server.listen(3366, () => {
    console.log('server started, listening to port 3366');
});

