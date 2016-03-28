/**
 * Tests for the admin (administrative region) model.
 */
var _ = require('lodash');
var assert = require('assert');
var mongoose = require('mongoose');

var Admin = require('../../app/models/admin.js');
var testutil = require('../testutil');

describe('get_admins', function() {
  var country_code = 'br';

  // Helper function for building Admin documents.
  // eslint-disable-next-line require-jsdoc
  function admin(admin_code, name, geo_area_sqkm) {
    return new Admin({
      country_code: country_code, admin_code: admin_code, name: name,
      geo_area_sqkm: geo_area_sqkm
    });
  }

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var admins = [
        admin('d1', 'District 1', 100),
        admin('d2', 'District 2', 200),
        admin('d3', 'District 3', 300)
      ];
      return testutil.save_documents(admins);
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return all admins for country', function(done) {
    Admin.find({country_code: country_code})
      .exec(function(err, result) {
        if (err) {
          return done(err);
        }
        assert.strictEqual(3, result.length);
        _.range(3).forEach(function(i_zero) {
          var i = i_zero + 1;
          var admin_i = _.find(result, {admin_code: 'd' + i});
          assert(admin_i);
          assert.strictEqual('District ' + i, admin_i.name);
          assert.strictEqual(i * 100, admin_i.geo_area_sqkm);
        });
        done();
      });
  });

  it('should return empty object for unknown country', function(done) {
    Admin.find({country_code: 'unknown country code'})
      .exec(function(err, result) {
        if (err) {
          return done(err);
        }
        testutil.assert_equal(result, []);
        done();
      });
  });
});
