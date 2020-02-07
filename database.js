
require('dotenv').config();
const mysql = require('mysql');
const uuidv4 = require('uuid/v4');

/**
 * Connect is a function, which establishes the database connection.
 *
 * @returns {object} The database connection is returned as an object.
 */

const connect = () => mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB,
  password: process.env.DB_PASS,
});


const errorHandler = (err) => {
  console.log('error in the pipeline: ');
  console.log(err);
};

/**
 * ExecuteQuery is a function, which executes the given database query.
 * It creates a new promise, which then goes on to either resolve or reject the outcome.
 *
 * @param {object} conn - The database connection.
 * @param {string} query - The given query in a string format.
 * @param {Array} params - The given parameters for the query.
 * @returns {Promise} The result of the query is returned.
 */

const executeQuery = (conn, query, params) => new Promise((resolve, reject) => {
  try {
    conn.query(query, params, (err, result) => {
      if (err) reject(err);
      resolve(result);
    });
  } catch (err) { errorHandler(err); }
}).catch((err) => {
  errorHandler(err);
});

/**
 * TokenCheckPipeline is a function, which is used to check if given token is valid.
 * Optionally, you can also provide a function as a parameter, which will be executed
 * if given token was valid. If no token were given, then it will return the result
 * of the token check.
 *
 * @param {object} conn - The database connection.
 * @param {string} token - Token to be checked.
 * @param {Function} func - Function to be executed if token was authorized.
 * @returns {Promise} The result of the promise is returned.
 */

const tokenCheckPipeline = ((conn, token, func) => new Promise((resolve, reject) => {
  try {
    executeQuery(
      conn,
      'SELECT * FROM token_table',
      [],
    ).then((result) => {
      const parsedResult = JSON.parse(JSON.stringify(result[0]));
      if (token === parsedResult.TOKEN) {
        func !== undefined ? resolve(func) : resolve(true);
      } else {
        console.log('token was incorrect!');
        reject('error, token authentication failed.');
      }
    });
  } catch (err) { errorHandler(err); }
}).catch((err) => {
  errorHandler(err);
}));


/**
 * AddUser is a function, which adds the given user into the game database.
 *
 * @param {object} conn - The database connection.
 * @param {string} username - The username to be added into the database.
 * @returns {Promise} If the creation was success, the UID of the created user
 *                     is returned to the client.
 */
const addUser = (conn, username) => {
  const uid = uuidv4();
  return new Promise((resolve, reject) => {
    executeQuery(conn,
      'INSERT INTO user_info (UID, username) VALUES (?, ?);',
      [uid, username]).then(() => {
      // user with uid generated, now return the new uid
      resolve(uid);
    });
  }).catch((err) => {
    errorHandler(err);
  });
};

/**
 * UpdatePlayerScore is a function, which updates/creates the score of the player into the database.
 * NOTE : If no score was found in the database, a new entry is created with the given score.
 *
 * @param {object} conn - The database connection.
 * @param {string} username - The username of the user to be updated.
 * @param {number} room - The number of the room the user occupies.
 * @param {number} score - The new score, to be updated into.
 * @returns {Promise} Returns the result of the query.
 */

const updatePlayerScore = (conn, username, room, score) => executeQuery(conn,
  'INSERT INTO game_scores_table (score, username, room) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE score=?;',
  [score, username, room, score]);


/**
 * CheckIfUserExists is a function, which checks if the given username is already taken.
 *
 * @param {object} conn - The database connection.
 * @param {string} username - The username to be checked.
 * @returns {Promise} Returns the result of the query.
 */
const checkIfUserExists = (conn, username) => executeQuery(conn,
  'SELECT EXISTS(SELECT * FROM user_info WHERE username=?);',
  [username]);

/**
 * CheckIfUserHasScore is a function, which checks if the user has a score in the given room.
 *
 * @param {object} conn - The database connection.
 * @param {string} username - The username to be checked.
 * @param {number} room - The number of the room the user occupies.
 * @returns {Promise} Returns the result of the query.
 */

const checkIfUserHasScore = (conn, username, room) => executeQuery(conn,
  'SELECT EXISTS (SELECT * FROM game_scores_table WHERE room=? AND username=?);',
  [room, username]);

/**
 * GetRoomScore is a function, which returns the scores of given players in a given room.
 *
 * @param {object} conn - The database connection.
 * @param {number} room - The number of the room the user occupies.
 * @param {Array} players - An array of player usernames to be checked.
 * @returns {Promise} Returns the result of the query.
 */

const getRoomScores = (conn, room, players) => executeQuery(conn,
  'SELECT username, score FROM game_scores_table WHERE room=? AND username IN (?);',
  [room, players]);


module.exports = {
  connect,
  addUser,
  checkIfUserExists,
  tokenCheckPipeline,
  updatePlayerScore,
  getRoomScores,
  checkIfUserHasScore,
};
