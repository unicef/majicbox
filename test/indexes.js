var utils = require('util');
var User = require('../app/models/user');

describe('Mongoose indexes persist in mongodb', function() {
  describe('#create()', function() {
    it('Should fail with duplicate name error', function(done) {
      var user1 = new User({
        name: 'Andy'
      });

      var user2 = new User({
        name: 'Andy'
      });

      user1.save().then(function() {
      }).then(function() {
        user2.save().then(function() {
          // TODO(mikefab): Catch error
          // When names are different, test hangs with:
          // "Error: timeout of 2000ms exceeded. Ensure the done() callback is being called in this test."
        }, function(err) {
          err.message.match(/duplicate/);
          done();
        });
      });
    });
  });
});
