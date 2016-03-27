/**
 * Tests that the database schema works as expected
 */

var assert = require('assert');
var testutil = require('../testutil');
var mongoose = require('mongoose');
var RegionTopojson = require('../../app/models/region-topojson.js');

var insert_many = function(data) {
  return new Promise(function(resolve, reject) {
    RegionTopojson.insertMany(data, function(err) {
      return err ? reject(err) : resolve(err);
    });
  });
};

var expect_failure = function(promise, message) {
  return promise.then(function() {
    assert.fail("Expected to fail! " + message);
  }, function() {
    return true;
  });
};

describe('region-topojson model', function() {
  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db();
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  it('fails to save non-Topojson data (no topojson)', function() {
    return expect_failure(
      insert_many([{country_code: 'br'}]),
      'insert without topojson object'
    );
  });

  it('fails to save non-Topojson data (malformed topojson)', function() {
    return expect_failure(
      insert_many([{country_code: 'br', topojson: {}}]),
      'insert without topojson object'
    );
  });

  it('saves Topojson data', function() {
    return insert_many([{
      country_code: 'br',
      topojson: {
        type: "Topology"
      },
      simplification: 0.5
    }]);
  });
});
