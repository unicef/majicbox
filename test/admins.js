var assert = require('assert');
var mongoose = require('mongoose');
var Region = require('../app/models/region');
var util = require('./testutil');
var config = require('../config');
var importer = require('../lib/import/region');

describe('Import admins', function() {
  var admin_geojson = require('./data/admin2.json');
  var path = './test/data/admin2.json';

  var debug = false;
  var country_code = 'br';

  var test_db = config.db_test;

  // Clear any existing data in test DB and load test data.
  before(function(done) {
    if (debug) {
      console.log('Connecting to test mongo', test_db);
    }
    mongoose.connect(test_db, function(err) {
      if (err) {throw err;}
      if (debug) {
        console.log('Clearing existing data in', test_db);
      }
      util.clearDB();

      importer.import_regions(country_code, path)
        .then(done);
    });
  });
  after(function() {
    mongoose.disconnect();
  });

  describe('Admin data stored', function() {
    it('should store name', function(done) {
      var all_done = [];
      admin_geojson.features.forEach(function(feature) {
        var promise = new Promise(function(resolve) {
          Region.findOne(
            {region_code: feature.properties.NAME_2},
            function(err, admin) {
              if (err) {throw err;}
              assert.strictEqual(
                feature.properties.NAME_2,
                admin.region_code
              );
              resolve();
            });
        });
        all_done.push(promise);
      });
      console.log('ALL DONE!');
      Promise.all(all_done).then(function() {
        done();
      });
    });
  });
});
