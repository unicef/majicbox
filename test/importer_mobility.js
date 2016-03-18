var assert = require('chai').assert;
var csv = require('fast-csv');
var mongoose = require('mongoose');

var Mobility = require('../app/models/mobility');
var importer = require('../lib/import/mobility');
var testutil = require('./testutil');

var test_migrations_dir = './test/data/mobility/br';
var test_migrations_csv_filename = 'sample_mobility_matrix.csv';

var country_code = 'br';

describe('Import mobility', function() {
  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        return importer.import_mobility(test_migrations_dir, country_code);
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  // TODO(mikefab): make test more robust.
  describe('Mobility data stored', function() {
    it(
      'should store origin',
      function(done) {
        var all_done = [];
        var count = 0;
        csv.fromPath(test_migrations_dir + '/' + test_migrations_csv_filename)
        .on('data', function(data) {
          // country_code was added to admin ids during mobility import.
          // Prepend country code to origin admin id
          var origin_admin_code = country_code + '-' + data[1];

          var promise = new Promise(function(resolve) {
            // Get first mobility record (starts on the second line after row headers)
            if (count === 1) {
              Mobility.find({
                origin_admin_code: origin_admin_code
              }, function(err, records) {
                assert.ifError(err, 'error finding record');
                assert.strictEqual(
                  origin_admin_code,
                  records[0].origin_admin_code
                );
                resolve();
              });
            }
            count += 1;
          });
          if (count === 2) {
            all_done.push(promise);
          }
        })
        .on('end', function() {
          Promise.all(all_done).then(function() {
            done();
          });
        });
      });
  });
});
