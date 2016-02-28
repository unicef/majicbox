var util = require('./util');
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

beforeEach(function(done) {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.testdb, function(err) {
      if (err) {throw err;}
      return util.clearDB(done);
    });
  } else {
    return util.clearDB(done);
  }
});

afterEach(function(done) {
  mongoose.disconnect();
  return done();
});

describe('Mongoose indexes persist in mongodb', function() {
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

        assert(
          should_have_elem.length === 1, 'Index should exist for age'
        );

        assert(
          should_not_have_elem.length === 0, 'Index should not exist for height'
        );

        done();
      });
    });
  });
});
