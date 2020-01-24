const express = require('express');
const app = express();
const net = require('net');

clients = [];

server = net.createServer((socket) => {
    
    connection = socket.connect();
    clients.push(connection);
    console.log('new connection!');

    socket.on('data', (data) => {
        console.log('data incoming:');
        console.log(data.toString());
        socket.write('holla right back at ya');
    });

    socket.on('error', (err) => {
        console.log('something went wrong..');
        console.log(err);
    });

});

server.listen(3366, () => {
    console.log('server started, listening to port 3366');
});

