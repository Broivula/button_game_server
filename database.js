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

const executeQuery = (conn, query, params) => {
    return new Promise ((resolve, reject) => {
        conn.query(query, params, (err, result) => {
            if(err) return reject(err);
            resolve(result);
        });
    });
};

const add_user = (conn, data) => {
    var username = data.username;
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

const get_usernames = (conn) => {
    var query = 'SELECT GROUP_CONCAT(username) FROM user_info' 
    return executeQuery(conn, query);
};

module.exports = {
    connect: connect,
    add_user: add_user,
    get_usernames: get_usernames,
}
