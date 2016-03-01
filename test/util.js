var _ = require('lodash');
var assert = require('assert');
var mongoose = require('mongoose');

var Mobility = require('../app/models/mobility');
var Region = require('../app/models/region');
var Weather = require('../app/models/weather');
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
        _.range(3).forEach(function(i_zero) {
          var i = i_zero + 1;
          var region_i = _.find(result, {region_code: 'd' + i});
          assert(region_i);
          assert.strictEqual('District ' + i, region_i.name);
          assert.strictEqual(i * 100, region_i.geo_area_sqkm);
          testutil.assert_equal(geo_features[i_zero],
                                region_i.geo_feature);
        });
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_regions('unknown country code')
      .then(function(result) {
        testutil.assert_equal(result, []);
      });
  });
});

describe('get_country_weather', function() {
  var country_code = 'br';
  var date1 = new Date('1999-12-31');
  var date2 = new Date('2000-01-01');
  var date3 = new Date('2000-01-02');
  var date1_key = date1.toISOString();
  var date2_key = date2.toISOString();
  var date3_key = date3.toISOString();

  // Helper function for building Weather documents.
  // eslint-disable-next-line require-jsdoc
  function weather(date, region_code, temp_mean) {
    return new Weather({
      date: date,
      country_code: country_code,
      region_code: region_code,
      data: {temp_mean: temp_mean}
    });
  }

  // Data is missing for 'br1' for date3 and missing for 'br2' for date1.
  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      return testutil.save_documents([
        weather(date1, 'br1', 11),
        weather(date2, 'br1', 21), weather(date2, 'br2', 22),
        weather(date3, 'br2', 32)
      ]);
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return data for all regions for country', function() {
    return Promise.all([
      util.get_country_weather(country_code, date1)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({br1: {temp_mean: 11}}, result[date1_key]);
        }),
      util.get_country_weather(country_code, date2)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({br1: {temp_mean: 21}, br2: {temp_mean: 22}},
                                result[date2_key]);
        }),
      util.get_country_weather(country_code, date3)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({br2: {temp_mean: 32}}, result[date3_key]);
        })
    ]);
  });

  it('should return latest data when no date specified', function() {
    return util.get_country_weather(country_code)
      .then(function(result) {
        assert.strictEqual(1, _.size(result));
        testutil.assert_equal({br2: {temp_mean: 32}}, result[date3_key]);
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_country_weather('unknown country code')
      .then(function(result) {
        testutil.assert_equal(result, {});
      });
  });

  it('should return empty object for dates we have no data for', function() {
    return util.get_country_weather(country_code, new Date('1980-01-01'))
      .then(function(result) {
        testutil.assert_equal(result, {});
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

describe('get_mobility_populations', function() {
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
        movement(date1, 'br1', 'br1', 11),  // br1 self-migration
        movement(date1, 'br1', 'br2', 12),
        movement(date1, 'br1', 'br3', 13),
        movement(date1, 'br2', 'br2', 22),  // br2 self-migration
        movement(date1, 'br3', 'br3', 33),  // br3 self-migration
        // date2:
        movement(date2, 'br1', 'br1', 110),  // br1 self-migration
        movement(date2, 'br1', 'br2', 120),
        movement(date2, 'br1', 'br3', 130),
        movement(date2, 'br2', 'br2', 220),  // br2 self-migration
        movement(date2, 'br3', 'br2', 320)
      ];
      return testutil.save_documents(_.concat(regions, mobility));
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  /**
   * Helper function to check that the result has the expected data for the
   * given date.
   *
   * @param{Date} date - Date to check.
   * @param{Object} expected_data - Data we expect in the result.
   * @param{Object} result - Result returned from get_mobility_populations.
   * @param{Boolean} allow_multiple_dates_in_result - Whether to allow data for
   *   other dates in the result.
   */
  function check_date_data(date, expected_data, result,
                           allow_multiple_dates_in_result) {
    var date_key = date.toISOString();
    assert(result[date_key], 'Expected data for date ' + date);
    testutil.assert_equal(expected_data, result[date_key]);
    if (!allow_multiple_dates_in_result) {
      assert.strictEqual(
        1, _.size(result), 'Expected only 1 result but got: ' +
          JSON.stringify(result));
    }
  }

  // Note that br3 only has population data for date1.
  var check_date1 = _.partial(check_date_data, date1, {br1: 11, br2: 22,
                                                       br3: 33});
  var check_date2 = _.partial(check_date_data, date2, {br1: 110, br2: 220});

  it('should return data for single dates', function() {
    return Promise.all([
      util.get_mobility_populations(country_code, date1).then(function(result) {
        check_date1(result);
      }),
      util.get_mobility_populations(country_code, date2).then(function(result) {
        check_date2(result);
      })
    ]);
  });

  it('should return data for all dates in range', function() {
    return Promise.all([
      // Return data for all dates, inclusive.
      util.get_mobility_populations(country_code, date1, date2)
        .then(function(result) {
          assert.strictEqual(2, _.size(result));
          check_date1(result, true);
          check_date2(result, true);
        }),
      // Return data for all dates when given range is larger.
      util.get_mobility_populations(country_code, new Date('1999-01-01'),
                                  new Date('3000-12-31'))
        .then(function(result) {
          assert.strictEqual(2, _.size(result));
          check_date1(result, true);
          check_date2(result, true);
        }),
      // Return data for just date1 when range excludes date2.
      util.get_mobility_populations(country_code, new Date('1999-01-01'), date1)
        .then(function(result) {
          check_date1(result);
        })
    ]);
  });

  it('should return latest data when no date specified', function() {
    return util.get_mobility_populations(country_code)
      .then(function(result) {
        check_date2(result);
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_mobility_populations('unknown country code')
      .then(function(result) {
        testutil.assert_equal(result, {});
      });
  });

  it('should return empty object for dates we have no data for', function() {
    return util.get_mobility_populations(country_code, new Date('1980-01-01'))
      .then(function(result) {
        testutil.assert_equal(result, {});
      });
  });
});

describe('get_egress_mobility', function() {
  var country_code = 'mx';
  var date1 = new Date('2016-03-14');
  var date2 = new Date('2016-03-15');
  var date1_key = date1.toISOString();
  var date2_key = date2.toISOString();

  // Helper function for building Mobility documents.
  var movement = _.partial(new_mobility, country_code);

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var regions = [
        new Region({country_code: country_code, region_code: 'mx1'}),
        new Region({country_code: country_code, region_code: 'mx3'}),
        new Region({country_code: country_code, region_code: 'mx2'})
      ];
      var mobility = [
        // date1:
        movement(date1, 'mx1', 'mx1', 11),
        movement(date1, 'mx1', 'mx2', 12),
        movement(date1, 'mx2', 'mx1', 21),
        movement(date1, 'mx3', 'mx3', 33),
        // date2:
        movement(date2, 'mx1', 'mx2', 120),
        movement(date2, 'mx2', 'mx1', 210),
        movement(date2, 'mx2', 'mx2', 220)
      ];
      return testutil.save_documents(_.concat(regions, mobility));
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return data for single dates', function() {
    return Promise.all([
      util.get_egress_mobility(country_code, 'mx1', date1)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({mx1: 11, mx2: 12}, result[date1_key]);
        }),
      util.get_egress_mobility(country_code, 'mx2', date2)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({mx1: 210, mx2: 220}, result[date2_key]);
        })
    ]);
  });

  it('should return data for all dates in range', function() {
    return Promise.all([
      // Return data for all dates, inclusive.
      util.get_egress_mobility(country_code, 'mx1', date1, date2)
        .then(function(result) {
          assert.strictEqual(2, _.size(result));
          testutil.assert_equal({mx1: 11, mx2: 12}, result[date1_key]);
          testutil.assert_equal({mx2: 120}, result[date2_key]);
        }),
      // Return data for all dates when given range is larger.
      util.get_egress_mobility(country_code, 'mx2', new Date('1999-01-01'),
                               new Date('3000-12-31'))
        .then(function(result) {
          assert.strictEqual(2, _.size(result));
          testutil.assert_equal({mx1: 21}, result[date1_key]);
          testutil.assert_equal({mx1: 210, mx2: 220}, result[date2_key]);
        }),
      // Return data for just date1 when range excludes date2.
      util.get_egress_mobility(country_code, 'mx1', new Date('1999-01-01'),
                                  date1)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({mx1: 11, mx2: 12}, result[date1_key]);
        })
    ]);
  });

  it('should return latest data when no date specified', function() {
    return Promise.all([
      util.get_egress_mobility(country_code, 'mx1').then(function(result) {
        assert.strictEqual(1, _.size(result));
        testutil.assert_equal({mx2: 120}, result[date2_key]);
      }),
      util.get_egress_mobility(country_code, 'mx2').then(function(result) {
        assert.strictEqual(1, _.size(result));
        testutil.assert_equal({mx1: 210, mx2: 220}, result[date2_key]);
      })
    ]);
  });

  it('should return empty object for unknown country or region', function() {
    return Promise.all([
      util.get_egress_mobility('unknown country', 'unknown region')
        .then(function(result) {
          testutil.assert_equal(result, {});
        }),
      util.get_egress_mobility('unknown country', 'mx1')
        .then(function(result) {
          testutil.assert_equal(result, {});
        }),
      util.get_egress_mobility(country_code, 'unknown region')
        .then(function(result) {
          testutil.assert_equal(result, {});
        })
    ]);
  });

  it('should return empty object for dates we have no data for', function() {
    return util.get_egress_mobility(country_code, 'mx1', new Date('1980-01-01'))
      .then(function(result) {
        testutil.assert_equal(result, {});
      });
  });
});
