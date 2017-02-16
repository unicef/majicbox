var assert = require('chai').assert;
var activity = require('../../lib/travel_activity');
var helper = require('../../app/helpers/csv-helper');
var mongoose = require('mongoose');
var testutil = require('../testutil');
var path_to_csv = './test/data/amadeus_mobility/traffic/';
var csv_file = 'traffic_W_1284_09.csv';

describe('Aggregate travel activty by country', function() {
  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        var save_queue = helper.save_queue;
        // Run import_amadeus twice to make sure that
        // no file can be imported more than once.
        return helper.import_csv_mongo(
          save_queue,
          path_to_csv,
          'traffic',
          csv_file
        );
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
