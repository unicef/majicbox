var assert = require('chai').assert;
var fs = require('fs');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');

var Admin = require('../app/models/admin');
var importer = require('../lib/import/admin');
var testutil = require('./testutil');

var topo_dir = './test/static-assets/';
var country_code = 'br';
var topo_file = country_code + '_topo.json';

describe('Import admins', function() {
  var admin_geojson = require('./data/geojson/' +
  country_code + '/admin2.json');

  var file = './test/data/geojson/' + country_code + '/admin2.json';

  before(function initializeDatabase() {
    return testutil.connect_and_clear_test_db()
      .then(function() {
        return importer.import_admins(file);
      });
  });

  after(function(done) {
    // Remove test topo file and dir
    fs.unlink(topo_dir + '/' + topo_file, function(err) {
      new Promise(function(resolve, reject) {
        if (err) { return reject(err);}
        fs.rmdir(topo_dir, function(err) {
          if (err) { console.log(err);}
          resolve();
        });
      })
      .then(mongoose.disconnect(done))
      .catch(function(err) {throw (err);});
    });
  });

  describe('Admin data stored', function() {
    it('should store population and area in topojson', function(done) {
      file = './test/static-assets/br_topo.json';
      jsonfile.readFile(file, function(err, topojson) {
        var col = topojson.objects.collection;
        assert(col.geometries[0].properties.population);
        assert(col.geometries[0].properties.geo_area_sqkm);
        assert.ifError(err);
        done();
      });
    });

    it('should store name', function(done) {
      var all_done = [];
      admin_geojson.features.forEach(function(feature) {
        var admin_code = country_code + '-' + feature.properties.ID_2;
        var promise = new Promise(function(resolve) {
          Admin.findOne(
            {admin_code: admin_code},
            function(err, admin) {
              if (err) {throw err;}
              assert.strictEqual(admin_code, admin.admin_code);
              assert.match(admin.country_code, /[a-z]{2}/, 'regexp matches');
              assert(admin.admin_code, 'admin_code has not been set!');
              assert(admin.name, 'name has not been set!');
              assert(admin.geo_area_sqkm, 'geo_area_sqkm has not been set!');
              assert(admin.population, 'population has not been set!');
              assert(admin.geo_feature, 'geo_feature has not been set!');
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
