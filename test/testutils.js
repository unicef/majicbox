var mongoose = require('mongoose');

exports.clearDB = function() {
  for (var i in mongoose.connection.collections) {
    if (mongoose.connection.collections.hasOwnProperty(i)) {
      mongoose.connection.collections[i].remove(function() {});
    }
  }
};
