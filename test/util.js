var _ = require('lodash');
var assert = require('assert');
var mongoose = require('mongoose');

var Mobility = require('../app/models/mobility');
var Region = require('../app/models/region');
var util = require('../util');

var testutil = require('./testutil');

describe('get_regions', function() {
  var country_code = 'br';
  var geo_features = [
    {type: 'Feature',
     properties: {name: 'Staten Island'},
     geometry: {type: 'MultiPolygon',
                coordinates: [[[[-74.0531, 40.57770], [-74.05406, 40.57711]]]]}
    },
    {type: 'Feature',
     properties: {name: 'Queens'},
     geometry: {type: 'MultiPolygon',
                coordinates: [[[[-75.0531, 41.57770], [-75.05406, 41.57711]]]]}
    },
    {type: 'Feature',
     properties: {name: 'Bronx'},
     geometry: {type: 'MultiPolygon',
                coordinates: [[[[-76.0531, 42.57770], [-76.05406, 42.57711]]]]}
    }
  ];

  // Helper function for building Region documents.
  // eslint-disable-next-line require-jsdoc
  function region(region_code, name, geo_area_sqkm, geo_feature) {
    return new Region({
      country_code: country_code, region_code: region_code, name: name,
      geo_area_sqkm: geo_area_sqkm, geo_feature: geo_feature});
  }

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var regions = [region('d1', 'District 1', 100, geo_features[0]),
                     region('d2', 'District 2', 200, geo_features[1]),
                     region('d3', 'District 3', 300, geo_features[2])];
      return testutil.save_documents(regions);
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return all regions for country', function() {
    return util.get_regions(country_code)
      .then(function(result) {
        assert.strictEqual(3, result.length);
        _.range(3).forEach(function(i) {
          var i_1 = i + 1;
          assert.strictEqual('d' + i_1, result[i].region_code);
          assert.strictEqual('District ' + i_1, result[i].name);
          assert.strictEqual(i_1 * 100, result[i].geo_area_sqkm);
          // TODO(jetpack): _.isEqual fails when testing the whole geo_feature
          // for some reason.
          assert(_.isEqual(geo_features[i].properties,
                           result[i].geo_feature.properties));
          assert(_.isEqual(geo_features[i].geometry.type,
                           result[i].geo_feature.geometry.type));
          assert(_.isEqual(geo_features[i].geometry.coordinates,
                           result[i].geo_feature.geometry.coordinates));
        });
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_regions('unknown country code')
      .then(function(result) {
        assert(_.isEqual(result, []));
      });
  });
});

// Helper function for building Mobility documents.
// eslint-disable-next-line require-jsdoc
function new_mobility(country_code, date, origin, destination, count) {
  return new Mobility({
    date: date, country_code: country_code,
    origin_region_code: origin, destination_region_code: destination,
    count: count});
}

describe('get_region_populations', function() {
  var country_code = 'br';
  var date1 = new Date('2016-02-28');
  var date2 = new Date('2016-02-29');

  // Helper function for building Mobility documents.
  var movement = _.partial(new_mobility, country_code);

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var regions = [
        new Region({country_code: country_code, region_code: 'br1'}),
        new Region({country_code: country_code, region_code: 'br2'}),
        new Region({country_code: country_code, region_code: 'br3'})
      ];
      var mobility = [
        // date1:
        movement(date1, 'br1', 'br1', 100),  // br1 self-migration
        movement(date1, 'br1', 'br2', 22),
        movement(date1, 'br1', 'br3', 33),
        movement(date1, 'br2', 'br2', 200),  // br2 self-migration
        movement(date1, 'br3', 'br2', 23),
        // date2:
        movement(date2, 'br1', 'br1', 1000),  // br1 self-migration
        movement(date2, 'br1', 'br2', 220),
        movement(date2, 'br1', 'br3', 330),
        movement(date2, 'br2', 'br2', 2000),  // br2 self-migration
        movement(date2, 'br3', 'br3', 3000)  // br3 self-migration
      ];
      return testutil.save_documents(_.concat(regions, mobility));
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  // Helper function to check data for date1.
  // eslint-disable-next-line require-jsdoc
  function check_date1(result, check_only_result) {
    var date_key = date1.toISOString();
    assert(result[date_key]);
    assert(_.isEqual({br1: 100, br2: 200}, result[date_key]));
    if (check_only_result) {
      assert.strictEqual(1, _.size(result));
    }
  }

  // Helper function to check data for date2.
  // eslint-disable-next-line require-jsdoc
  function check_date2(result, check_only_result) {
    var date_key = date2.toISOString();
    assert(result[date_key]);
    assert(_.isEqual({br1: 1000, br2: 2000, br3: 3000}, result[date_key]));
    if (check_only_result) {
      assert.strictEqual(1, _.size(result));
    }
  }

  it('should return data for single dates', function() {
    return Promise.all([
      util.get_region_populations(country_code, date1).then(function(result) {
        check_date1(result, true);
      }),
      util.get_region_populations(country_code, date2).then(function(result) {
        check_date2(result, true);
      })
    ]);
  });

  it('should return data for all dates in range', function() {
    return util.get_region_populations(country_code, date1, date2)
      .then(function(result) {
        assert.strictEqual(2, _.size(result));
        check_date1(result);
        check_date2(result);
      });
  });

  it('should return latest data when no date specified', function() {
    return util.get_region_populations(country_code)
      .then(function(result) {
        check_date2(result, true);
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_region_populations('unknown country code')
      .then(function(result) {
        assert(_.isEqual(result, {}));
      });
  });

  it('should return empty object for dates we have no data for', function() {
    return util.get_region_populations('br', new Date('1980-01-01'))
      .then(function(result) {
        assert(_.isEqual(result, {}));
      });
  });
});
