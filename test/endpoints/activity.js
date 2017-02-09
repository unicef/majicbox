var assert = require('chai').assert;
var mongoose = require('mongoose');
var activity = require('../../util');
var importer = require('../../lib/import/amadeus_mobility');
var testutil = require('../testutil');

describe('Import amadeus mobility', function() {
  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        // Run import_amadeus twice to make sure that
        // no file can be imported more than once.
        return importer.import_amadeus(1).then(function() {
          importer.import_amadeus(1);
        });
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  // TODO(mikefab): make test more robust.
  describe('travel_from_country_activity', function() {
    it(
      'should return activity for Argentina only',
      function(done) {
        activity.travel_from_country_activity(
          1267936000000,
          1567936000000,
          'ARG'
        )
        .then(results => {
          var country_codes = results.reduce((h, result) => {
            h[result.origin_country_code] = 1;
            return h;
          }, {});
          assert.strictEqual(Object.keys(country_codes).length, 1);
          assert.strictEqual(results[0].count, 28);
          done();
        });
      });

    it(
      'should return activity for multiple countries',
      function(done) {
        activity.travel_from_country_activity(
          1474516800000,
          1474603200000
        )
        .then(results => {
          var country_codes = results.reduce((h, result) => {
            h[result.origin_country_code] = 1;
            return h;
          }, {});
          assert.isAbove(Object.keys(country_codes).length, 1);
          done();
        });
      });
  });
});
