var mongoose = require('mongoose');
var config = require('../config');

/** Drops all data from connected MongoDB.
 * @return{Promise} Fulfilled when all collections are dropped.
 */
function clearDb() {
  var all_done = [];
  Object.keys(mongoose.connection.collections).forEach(function(e) {
    all_done.push(new Promise(function(res, rej) {
      mongoose.connection.collections[e].remove(function(err) {
        if (err) { return rej(err); }
        res();
      });
    }));
  });
  // The no-op function for `then` here is so we can say `clearDb.then(done)` in
  // mocha (`done` should only be given an argument when there is an error.
  return Promise.all(all_done).then(function() {});
}

/** Connect to test database and clear existing data.
 * @return{Promise} Fulfilled when connection is established and data is
 *   cleared.
 */
function connectAndClearTestDb() {
  return new Promise(function(res, rej) {
    if (mongoose.connection.readyState === 0) {
      mongoose.connect(config.testdb, function(err) {
        if (err) {
          rej(err);
        } else {
          clearDb().then(res);
        }
      });
    } else {
      clearDb().then(res);
    }
  });
}

module.exports = {
  connectAndClearTestDb: connectAndClearTestDb
};
