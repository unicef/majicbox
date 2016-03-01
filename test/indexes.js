var assert = require('assert');
var mongoose = require('mongoose');

var testutil = require('./testutil');

var thingSchema = new mongoose.Schema(
  {
    age: {type: Number, index: true},
    height: {type: Number}
  }
);

var Thing = mongoose.model('Thing', thingSchema);

describe('Mongoose indexes persist in mongodb', function() {
  beforeEach(function() {
    return testutil.connect_and_clear_test_db();
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  describe('Create first thing and verify mongo index created', function() {
    it('Should reveal one index only on age', function(done) {
      var thing = new Thing({
        age: 140,
        height: 4
      });

      thing.save(function() {
        thing.collection.getIndexes(function(err, results) {
          if (err) { return done(err); }

          var should_have_elem = Object.keys(results).filter(
            function(e) {
              return e === 'age_1';
            }
          );

          var should_not_have_elem = Object.keys(results).filter(
            function(e) {
              return e === 'height_1';
            }
          );

          assert.strictEqual(
            should_have_elem.length,
            1,
            'Index should exist for age'
          );

          assert.strictEqual(
            should_not_have_elem.length,
            0,
            'Index should not exist for height'
          );
          done();
        });
      });
    });
  });
});
