var _ = require('lodash');
var assert = require('assert');
var mongoose = require('mongoose');

var Mobility = require('../app/models/mobility');
var Region = require('../app/models/region');
var util = require('../util');

var testutil = require('./testutil');

describe('get_region_populations', function() {
  var country_code = 'br';
  var date1 = new Date('2016-02-28');
  var date2 = new Date('2016-02-29');

  // Helper function for building Mobility documents.
  // eslint-disable-next-line require-jsdoc
  function movement(date, origin, destination, count) {
    return new Mobility({
      date: date, country_code: country_code,
      origin_region_code: origin, destination_region_code: destination,
      count: count});
  }

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var regions = [
        new Region({country_code: country_code, region_code: 'br1'}),
        new Region({country_code: country_code, region_code: 'br2'}),
        new Region({country_code: country_code, region_code: 'br3'})
      ];
      var mobility = [
        // date1:
        movement(date1, 'br1', 'br1', 100),  // br1 self-migration
        movement(date1, 'br1', 'br2', 22),
        movement(date1, 'br1', 'br3', 33),
        movement(date1, 'br2', 'br2', 200),  // br2 self-migration
        movement(date1, 'br3', 'br2', 23),
        // date2:
        movement(date2, 'br1', 'br1', 1000),  // br1 self-migration
        movement(date2, 'br1', 'br2', 220),
        movement(date2, 'br1', 'br3', 330),
        movement(date2, 'br2', 'br2', 2000),  // br2 self-migration
        movement(date2, 'br3', 'br3', 3000)  // br3 self-migration
      ];
      return testutil.save_documents(_.concat(regions, mobility));
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return value for each self-migration', function() {
    return Promise.all([
      // date 1
      util.get_region_populations(country_code, date1).then(function(result) {
        var date_key = date1.toISOString();
        assert(result[date_key]);
        assert.strictEqual(2, _.size(result[date_key]));
        assert.strictEqual(100, result[date_key].br1);
        assert.strictEqual(200, result[date_key].br2);
      }),
      // date 2
      util.get_region_populations(country_code, date2)
        .then(function(result) {
          var date_key = date2.toISOString();
          assert(result[date_key]);
          assert.strictEqual(3, _.size(result[date_key]));
          assert.strictEqual(1000, result[date_key].br1);
          assert.strictEqual(2000, result[date_key].br2);
          assert.strictEqual(3000, result[date_key].br3);
        })
    ]);
  });

  it('should return data for all dates in range', function() {
    return util.get_region_populations(country_code, date1, date2)
      .then(function(result) {
        var date1_key = date1.toISOString();
        var date2_key = date2.toISOString();
        assert(result[date1_key]);
        assert.strictEqual(2, _.size(result[date1_key]));
        assert.strictEqual(100, result[date1_key].br1);
        assert.strictEqual(200, result[date1_key].br2);
        assert(result[date2_key]);
        assert.strictEqual(3, _.size(result[date2_key]));
        assert.strictEqual(1000, result[date2_key].br1);
        assert.strictEqual(2000, result[date2_key].br2);
        assert.strictEqual(3000, result[date2_key].br3);
      });
  });

  it('should return latest data when no date specified', function() {
    return util.get_region_populations(country_code)
      .then(function(result) {
        var date2_key = date2.toISOString();
        assert.strictEqual(1, _.size(result));
        assert(result[date2_key]);
        assert.strictEqual(3, _.size(result[date2_key]));
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_region_populations('unknown country code')
      .then(function(result) {
        assert(_.isEqual(result, {}));
      });
  });

  it('should return empty object for dates we have no data for', function() {
    return util.get_region_populations('br', new Date('1980-01-01'))
      .then(function(result) {
        assert(_.isEqual(result, {}));
      });
  });
});
