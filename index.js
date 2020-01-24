const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

app.get('/', (req, res) => {
    console.log('working, alright');
});

io.on('connection', (socket) => {
    socket.emit('action', {data: "data"})
})

server.listen(3000, () => {
    console.log('server running on port 3000');
})
