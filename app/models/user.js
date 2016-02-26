var mongoose = require('mongoose');

var userSchema = new mongoose.Schema(
  {
    name: {type: String, index: { unique: true }},
  }, { collection : 'users' }
);

var User = mongoose.model('User', userSchema);

module.exports = User;
