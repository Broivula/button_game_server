require('dotenv').config()
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


const checkToken = ((conn, token, func) => {
    return new Promise((resolve, reject) => {
        conn.query('SELECT * FROM token_table', (err, result) => {
            var parsed_result = JSON.parse(JSON.stringify(result[0]));
            //console.log(parsed_result.TOKEN);
            if(token === parsed_result.TOKEN){
                resolve(func);
            }
            else{
                console.log('token was incorrect!');
                reject('error, token authentication failed.');
            }
        });
    });
});

const executeQuery = (conn, query, params) => {
    return new Promise ((resolve, reject) => {
        conn.query(query, params, (err, result) => {
            if(err) return reject(err);
            resolve(result);
        });
    });
};

const addUser = (conn, username) => {
    var uid = uuidv4();
    return new Promise ((resolve, reject) => {
        executeQuery(conn,
       'INSERT INTO user_info (UID, username) VALUES (?, ?);',
        [uid, username]
    ).then((res) => {
        // user with uid generated, now return the new uid
        resolve(uid);
    });
    })
};

const checkIfUserExists = (conn, username) => {
    var query = 'SELECT EXISTS(SELECT * FROM user_info WHERE username=?);' 
    return executeQuery(conn, query, [username])
};


module.exports = {
    connect: connect,
    addUser: addUser,
    checkIfUserExists: checkIfUserExists,
    checkToken: checkToken,
}
