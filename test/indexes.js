var util = require('./util');
var config = require('../config');
var should = require('should');
var mongoose = require('mongoose');

var thingSchema = new mongoose.Schema(
  {
    age: {type: Number, index: true},
    height: {type: Number},
    build: {type: String}
  }, {collection: 'things'}
);

var Thing = mongoose.model('Thing', thingSchema);

// ensure the NODE_ENV is set to 'test'
// this is helpful when you would like to change behavior when testing
process.env.NODE_ENV = 'test';

beforeEach(function(done) {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.testdb, function(err) {
      if (err) {
        throw err;
      }
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
      height: 4,
      build: 'short'
    });

    thing.save(function() {
      thing.collection.getIndexes(function(err, results) {
        if (err) {
          done();
        }
        // Index should exist for age
        Object.keys(results).filter(
          function(e) {
            return e === 'age_1';
          }
          ).length.should.equal(1);
        // Index should not exist for height
        Object.keys(results).filter(
          function(e) {
            return e === 'height_1';
          }).length.should.equal(0);
        done();
      });
    });
  });
});
