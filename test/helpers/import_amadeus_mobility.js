var assert = require('chai').assert;
var csv = require('fast-csv');
var mongoose = require('mongoose');

var Mobility = require('../../app/models/mobility');
var testutil = require('../testutil');
var test_migrations_dir = './test/data/amadeus_mobility/traffic/';
var test_migrations_csv_filename = 'traffic_W_1284_09.csv';
var helper = require('../../app/helpers/amadeus');

describe('Import amadeus mobility', function() {
  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        // Run import_amadeus twice to make sure that
        // no file can be imported more than once.

        return helper.import_csv_mongo(
          helper.save_queue,
           test_migrations_dir,
          'traffic',
          test_migrations_csv_filename
        );
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  // TODO(mikefab): make test more robust.
  describe('Mobility data stored', function() {
    it(
      'should store origin and only import file once',
      function(done) {
        var all_done = [];
        csv.fromPath(
          test_migrations_dir + '/' + test_migrations_csv_filename,
          {headers: true}
        ).on('data', function(data) {
          // country_code was added to admin ids during mobility import.
          // Prepend country code to origin admin id
          var origin_admin_code = data.origin_id;
          var dest_admin_code = data.dest_id;
          var promise = new Promise(function(resolve) {
            Mobility.find({
              origin_admin_code: origin_admin_code,
              destination_admin_code: dest_admin_code
            }, function(err, records) {
              assert.ifError(err, 'error finding record');
              assert.strictEqual(
                records.length,
                1
              );
              resolve();
            });
          });
          all_done.push(promise);
        })
        .on('end', function() {
          Promise.all(all_done).then(function() {
            done();
          });
        });
      });
  });
});
