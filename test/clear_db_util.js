var mongoose = require('mongoose');

exports.clearDB = function() {
  Object.keys(mongoose.connection.collections).forEach(function(e) {
    mongoose.connection.collections[e].remove(function() {});
  });
};
