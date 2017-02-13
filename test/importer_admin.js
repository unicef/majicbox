var assert = require('chai').assert;
var mongoose = require('mongoose');

var Admin = require('../app/models/admin');
var AdminTopojson = require('../app/models/admin-topojson.js');
var importer = require('../lib/import/admin');
var testutil = require('./testutil');

var country_code = 'br';
var pub_src = 'gadm2-8';

describe('Import admins', function() {
  var admin_geojson = require('./data/geojson/' +
  country_code + '/admin2.json');

  var geojson = './test/data/geojson/' + country_code + '/admin2.json';
  // var population = './data/population/worldpop_br.csv';

  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        return importer.import_admins(country_code, geojson, 'gadm2-8');
      });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  describe('Admin data stored', function() {
    it('should store area in topojson', function(done) {
      AdminTopojson.findOne(
        {country_code: country_code},
        function(err, region_topojson) {
          if (err) {
            return done(err);
          }
          var col = region_topojson.topojson.objects.collection;
          assert(col.geometries[0].properties.geo_area_sqkm);
          var expected_area = 1595;
          assert(Math.abs(col.geometries[0].properties.geo_area_sqkm - expected_area) < 10);
          done();
        }
      );
    });

    it('should store name', function(done) {
      var all_done = [];
      admin_geojson.features.forEach(function(feature) {
        var props = feature.properties;
        var id_0 = props.ID_0;
        var id_1 = props.ID_1;
        var id_2 = props.ID_2;
        var iso = props.ISO;

        var admin_id = iso.toLowerCase();
        [id_0, id_1, id_2].forEach(function(e) {
          if (e) {
            admin_id = admin_id + '_' + e;
          }
        });
        var admin_code = admin_id + '_' + pub_src;

        var promise = new Promise(function(resolve) {
          Admin.findOne(
            {admin_code: admin_code},
            function(err, admin) {
              if (err) {throw err;}
              assert.strictEqual(admin_code, admin_code);
              assert.match(admin.country_code, /[a-z]{2}/, 'regexp matches');
              assert(admin.admin_code, 'admin_code has not been set!');
              assert(admin.name, 'name has not been set!');
              assert(admin.geo_area_sqkm, 'geo_area_sqkm has not been set!');
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
