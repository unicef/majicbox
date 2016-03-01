var mongoose = require('mongoose');

var config = require('../config');

/**
 * Drops all data from connected MongoDB.
 *
 * @return{Promise} Fulfilled when all collections are dropped.
 */
function clear_db() {
  var all_done = [];
  Object.keys(mongoose.connection.collections).forEach(function(e) {
    all_done.push(new Promise(function(res, rej) {
      mongoose.connection.collections[e].remove(function(err) {
        if (err) { return rej(err); }
        res();
      });
    }));
  });
  // The no-op function for `then` here is so we can say `clear_db.then(done)` in
  // mocha (`done` should only be given an argument when there is an error.
  return Promise.all(all_done).then(function() {});
}

/**
 * Connect to test database and clear existing data.
 *
 * @return{Promise} Fulfilled when connection is established and data is
 *   cleared.
 */
function connect_and_clear_test_db() {
  return new Promise(function(res, rej) {
    if (mongoose.connection.readyState === 0) {
      mongoose.connect(config.testdb, function(err) {
        if (err) {
          rej(err);
        } else {
          clear_db().then(res);
        }
      });
    } else {
      clear_db().then(res);
    }
  });
}

/**
 * Save all documents.
 *
 * @param{Array} docs - Documents to save.
 * @return{Promise} Fulfilled when documents saved.
 */
function save_documents(docs) {
  var promises = docs.map(function(doc) {
    return new Promise(function(res, rej) {
      doc.save(function(err) {
        if (err) {
          return rej(err);
        } else {
          return res();
        }
      });
    });
  });
  return Promise.all(promises);
}

module.exports = {
  connect_and_clear_test_db: connect_and_clear_test_db,
  save_documents: save_documents
};
