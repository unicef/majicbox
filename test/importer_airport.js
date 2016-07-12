var assert = require('chai').assert;
var mongoose = require('mongoose');

var Airport = require('../app/models/airport');
var importer = require('../lib/import/airports');
var testutil = require('./testutil');

var country_code = 'br';

describe('Import airports', function() {
  var airport_geojson = require('./data/geojson/airports.json');

  var geojson = './test/data/geojson/airports.json';

  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        return importer.import_airports(country_code, geojson);
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  describe('Airport data stored', function() {
    it('should store name', function(done) {
      var all_done = [];
      airport_geojson.features.forEach(function(feature) {
        var admin_code = String(feature.properties.adm2_code);
        var promise = new Promise(function(resolve) {
          Airport.findOne(
            {admin_code: admin_code},
            function(err, admin) {
              if (err) {
                throw err;
              }
              assert.strictEqual(admin_code, admin.admin_code);
              assert.match(admin.country_code, /[a-z]{2}/, 'regexp matches');
              assert(admin.admin_code, 'admin_code has not been set!');
              assert(admin.name, 'name has not been set!');
              resolve();
            });
        });
        all_done.push(promise);
      });
      Promise.all(all_done).then(function() {
        done();
      });
    });
  });
});
