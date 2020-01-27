const express = require('express');
const app = express();
const net = require('net');
const db = require('./database');
const bodyParser = require('body-parser');
clients = [];


// setting up server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// setting up database connection

var database_connection = db.connect();

//console.log(result);

// routing for the express server, handling regular connections

app.get('/', (req, res) => {
    console.log('test');
   // result =  clients[0].write('data\n');
   // console.log('result of write: ' + result);
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
        /*
    db.add_user(database_connection, data).then((uid) => {
       console.log(uid); 
    }).catch(err => {
        res.json({error_msg: 'error inserting a new user to server db'})
    });
    */
});

const error_msg = (res) => {
    console.log('aaay, mistake bruh');
    res.json({err: 'token authentication failure'})
}

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

