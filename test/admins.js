var assert = require('assert');
var mongoose = require('mongoose');
var importer = require('../lib/import/region');
var Region = require('../app/models/region');
var testutil = require('./testutil');

describe('Import admins', function() {
  var country_code = 'br';
  var admin_geojson = require('./data/geojson/' +
  country_code + '/admin2.json');

  var file = 'admin2';
  var path = './test/data/geojson/';

  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        return importer.import_regions(country_code, file, path);
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  describe('Admin data stored', function() {
    it('should store name', function(done) {
      var all_done = [];
      admin_geojson.features.forEach(function(feature) {
        var promise = new Promise(function(resolve) {
          Region.findOne(
            {region_code: feature.properties.ID_2},
            function(err, admin) {
              if (err) {throw err;}
              assert.strictEqual(
                String(feature.properties.ID_2),
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
