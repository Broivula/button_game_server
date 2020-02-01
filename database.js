'use strict';
require('dotenv').config();
const mysql = require('mysql');
const uuidv4 = require('uuid/v4');

const connect = () => {
    return mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB,
        password: process.env.DB_PASS
    });
};


const pipeline = ((conn, token, func) => {
        return new Promise((resolve, reject) => {
            try{
                conn.query('SELECT * FROM token_table', (err, result) => {
                    if(err)throw(err);
                    let parsed_result = JSON.parse(JSON.stringify(result[0]));
                    if(token === parsed_result.TOKEN){
                        // if there was no function given, respond with
                        // just the result of token check
                        func !== undefined ? resolve(func) : resolve(true)
                    }
                    else{
                        console.log('token was incorrect!');
                        reject('error, token authentication failed.');
                    }
                });
            }catch(err){errorHandler(err);}
        }).catch(err => {
            errorHandler(err);
        });
});

const executeQuery = (conn, query, params) => {
    return new Promise ((resolve, reject) => {
        try {
            conn.query(query, params, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        }catch (err) {errorHandler(err)}
    }).catch((err) => {
       errorHandler(err)
    });
};

const addUser = (conn, username) => {
    let uid = uuidv4();
    return new Promise ((resolve, reject) => {
        executeQuery(conn,
       'INSERT INTO user_info (UID, username) VALUES (?, ?);',
        [uid, username]
    ).then((res) => {
        // user with uid generated, now return the new uid
        resolve(uid);
    });
    }).catch(err => {
        errorHandler(err);
    })
};

const updatePlayerScore = (conn, username, room, score ) => {
    return executeQuery(conn,
        'INSERT INTO game_scores_table (score, username, room) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score=?;',
        [score, username, room, score]
    )
};

const checkIfUserExists = (conn, username) => {
    return executeQuery(conn,
        'SELECT EXISTS(SELECT * FROM user_info WHERE username=?);',
        [username]
    )
};

const getRoomScores = (conn, room, players) => {
    return executeQuery(conn,
        'SELECT username, room, score FROM game_scores_table WHERE room=? AND username IN (?);',
        [room, players]
        )
};

const errorHandler = (err) => {
    console.log('error in the pipeline: ');
    console.log(err);
};


module.exports = {
    connect: connect,
    addUser: addUser,
    checkIfUserExists: checkIfUserExists,
    pipeline: pipeline,
    updatePlayerScore: updatePlayerScore,
    getRoomScores: getRoomScores
};
