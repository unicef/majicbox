var assert = require('assert');
var mongoose = require('mongoose');
var importer = require('../lib/import/region');
var Region = require('../app/models/region');
var testutil = require('./testutil');

describe('Import admins', function() {
  var admin_geojson = require('./data/admin2.json');
  var country_code = 'br';
  var path = './test/data/admin2.json';

  before(function initializeDatabase(done) {
    return testutil.connectAndClearTestDb().then(function() {
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
