var util = require('./clearDb');
var config = require('../config');
var assert = require('assert');
var mongoose = require('mongoose');
var thingSchema = new mongoose.Schema(
  {
    age: {type: Number, index: true},
    height: {type: Number}
  }
);

var Thing = mongoose.model('Thing', thingSchema);

// ensure the NODE_ENV is set to 'test'
// this is helpful when you would like to change behavior when testing
process.env.NODE_ENV = 'test';

describe('Mongoose indexes persist in mongodb', function() {
  var debug = false;
  var test_db = config.testdb;

  // Clear any existing data in test DB and load test data.
  before(function(done) {
    if (debug) {
      console.log('Connecting to test mongo', test_db);
    }
    mongoose.connect(test_db, function(err) {
      if (err) {
        throw err;
      }
      if (debug) {
        console.log('Clearing existing data in', test_db);
      }
      util.clearDB();
      done();
    });
  });
  after(function() {
    mongoose.disconnect();
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
