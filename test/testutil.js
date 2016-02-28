var mongoose = require('mongoose');

var config = require('../config');

/** Drops all data from connected MongoDB.
 * @param{callback} done - Called when complete.
 */
function clearDb(done) {
  Object.keys(mongoose.connection.collections).forEach(function(e) {
    mongoose.connection.collections[e].remove(function() {});
  });
  done();
}

/** Connect to test database and clear existing data.
 * @param{callback} done - Called when complete.
 */
function connectAndClearTestDb(done) {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.testdb, function(err) {
      if (err) { throw err; }
      clearDb(done);
    });
  } else {
    clearDb(done);
  }
}

module.exports = {
  connectAndClearTestDb: connectAndClearTestDb
};
