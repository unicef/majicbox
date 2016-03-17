var _ = require('lodash');
var assert = require('assert');
var mongoose = require('mongoose');

var Admin = require('../app/models/admin');
var Mobility = require('../app/models/mobility');
var Weather = require('../app/models/weather');
var util = require('../util');

var testutil = require('./testutil');

describe('get_admins', function() {
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

  // Helper function for building Admin documents.
  // eslint-disable-next-line require-jsdoc
  function admin(admin_code, name, geo_area_sqkm, geo_feature) {
    return new Admin({
      country_code: country_code, admin_code: admin_code, name: name,
      geo_area_sqkm: geo_area_sqkm, geo_feature: geo_feature});
  }

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var admins = [admin('d1', 'District 1', 100, geo_features[0]),
                     admin('d2', 'District 2', 200, geo_features[1]),
                     admin('d3', 'District 3', 300, geo_features[2])];
      return testutil.save_documents(admins);
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return all admins for country', function() {
    return util.get_admins(country_code)
      .then(function(result) {
        assert.strictEqual(3, result.length);
        _.range(3).forEach(function(i_zero) {
          var i = i_zero + 1;
          var admin_i = _.find(result, {admin_code: 'd' + i});
          assert(admin_i);
          assert.strictEqual('District ' + i, admin_i.name);
          assert.strictEqual(i * 100, admin_i.geo_area_sqkm);
          testutil.assert_equal(geo_features[i_zero],
                                admin_i.geo_feature);
        });
      });
  });

  it('should return empty object for unknown country', function() {
    return util.get_admins('unknown country code')
      .then(function(result) {
        testutil.assert_equal(result, []);
      });
  });
});

describe('Weather functions', function() {
  var country_code = 'br';
  var date1 = new Date('1999-12-31');
  var date2 = new Date('2000-01-01');
  var date3 = new Date('2000-01-02');
  var date1_key = date1.toISOString();
  var date2_key = date2.toISOString();
  var date3_key = date3.toISOString();

  // eslint-disable-next-line require-jsdoc
  function admin_code(number) { return country_code + '-' + number; }

  // Helper function for building Weather documents.
  // eslint-disable-next-line require-jsdoc
  function weather(date, admin_number, temp_mean) {
    return new Weather({
      date: date,
      country_code: country_code,
      admin_code: admin_code(admin_number),
      data: {temp_mean: temp_mean}
    });
  }

  // Data is missing for 'br-1' for date3 and missing for 'br-2' for date1.
  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      return testutil.save_documents([
        weather(date1, '1', 11),
        weather(date2, '1', 21), weather(date2, '2', 22),
        weather(date3, '2', 32)
      ]);
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  describe('get_country_weather', function() {
    it('should return data for all admins for country', function() {
      return Promise.all([
        util.get_country_weather(country_code, date1)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-1': {temp_mean: 11}}, result[date1_key]);
          }),
        util.get_country_weather(country_code, date2)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-1': {temp_mean: 21},
                                   'br-2': {temp_mean: 22}},
                                  result[date2_key]);
          }),
        util.get_country_weather(country_code, date3)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-2': {temp_mean: 32}}, result[date3_key]);
          })
      ]);
    });

    it('should return latest data when no date specified', function() {
      return util.get_country_weather(country_code)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({'br-2': {temp_mean: 32}}, result[date3_key]);
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

  describe('get_admin_weather', function() {
    it('should return data for single dates ', function() {
      return Promise.all([
        util.get_admin_weather(admin_code('1'), date1)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-1': {temp_mean: 11}}, result[date1_key]);
          }),
        util.get_admin_weather(admin_code('1'), date2)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-1': {temp_mean: 21}}, result[date2_key]);
          }),
        util.get_admin_weather(admin_code('2'), date3)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-2': {temp_mean: 32}}, result[date3_key]);
          })
      ]);
    });

    it('should return data for all dates in range', function() {
      return Promise.all([
        // Return data for all dates, inclusive.
        util.get_admin_weather(admin_code('2'), date2, date3)
          .then(function(result) {
            assert.strictEqual(2, _.size(result));
            testutil.assert_equal({'br-2': {temp_mean: 22}}, result[date2_key]);
            testutil.assert_equal({'br-2': {temp_mean: 32}}, result[date3_key]);
          }),
        // Return data for all dates when given range is larger.
        util.get_admin_weather(admin_code('2'), date1,
                               new Date('3000-12-31'))
          .then(function(result) {
            assert.strictEqual(2, _.size(result));
            testutil.assert_equal({'br-2': {temp_mean: 22}}, result[date2_key]);
            testutil.assert_equal({'br-2': {temp_mean: 32}}, result[date3_key]);
          }),
        // Return data for just date2 when range excludes date3.
        util.get_admin_weather(admin_code('2'), new Date('1999-01-01'),
                               date2)
          .then(function(result) {
            assert.strictEqual(1, _.size(result));
            testutil.assert_equal({'br-2': {temp_mean: 22}}, result[date2_key]);
          })
      ]);
    });

    it('should return latest data when no date specified', function() {
      return util.get_admin_weather(admin_code('2'))
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({'br-2': {temp_mean: 32}}, result[date3_key]);
        });
    });

    it('should return empty object for unknown admin', function() {
      return util.get_admin_weather('unknown admin code')
        .then(function(result) {
          testutil.assert_equal(result, {});
        });
    });

    it('should return empty object for dates we have no data for', function() {
      return util.get_admin_weather(admin_code('1'),
                                    new Date('1980-01-01'))
        .then(function(result) {
          testutil.assert_equal(result, {});
        });
    });
  });
});

// Helper function for building Mobility documents.
// eslint-disable-next-line require-jsdoc
function new_mobility(country_code, date, origin, destination, count) {
  return new Mobility({
    date: date,
    origin_country_code: country_code,
    destination_country_code: country_code,
    origin_admin_code: country_code + '-' + origin,
    destination_admin_code: country_code + '-' + destination,
    count: count});
}

describe('get_mobility_populations', function() {
  var country_code = 'br';
  var date1 = new Date('2016-02-28');
  var date2 = new Date('2016-02-29');

  // eslint-disable-next-line require-jsdoc
  function admin_code(number) { return country_code + '-' + number; }

  // Helper function for building Mobility documents.
  var movement = _.partial(new_mobility, country_code);

  before(function initialize_database() {
    return testutil.connect_and_clear_test_db().then(function() {
      var admins = [
        new Admin({country_code: country_code, admin_code: admin_code('1')}),
        new Admin({country_code: country_code, admin_code: admin_code('2')}),
        new Admin({country_code: country_code, admin_code: admin_code('3')})
      ];
      var mobility = [
        // date1:
        movement(date1, '1', '1', 11),  // 1 self-migration
        movement(date1, '1', '2', 12),
        movement(date1, '1', '3', 13),
        movement(date1, '2', '2', 22),  // 2 self-migration
        movement(date1, '3', '3', 33),  // 3 self-migration
        // date2:
        movement(date2, '1', '1', 110),  // 1 self-migration
        movement(date2, '1', '2', 120),
        movement(date2, '1', '3', 130),
        movement(date2, '2', '2', 220),  // 2 self-migration
        movement(date2, '3', '2', 320)
      ];
      return testutil.save_documents(_.concat(admins, mobility));
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

  // Note that br-3 only has population data for date1.
  // eslint-disable-next-line quote-props
  var check_date1 = _.partial(check_date_data, date1, {'br-1': 11, 'br-2': 22,
                                                       'br-3': 33});
  // eslint-disable-next-line quote-props
  var check_date2 = _.partial(check_date_data, date2, {'br-1': 110,
                                                       'br-2': 220});

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
      var admins = [
        new Admin({country_code: country_code, admin_code: 'mx-1'}),
        new Admin({country_code: country_code, admin_code: 'mx-3'}),
        new Admin({country_code: country_code, admin_code: 'mx-2'})
      ];
      var mobility = [
        // date1:
        movement(date1, '1', '1', 11),
        movement(date1, '1', '2', 12),
        movement(date1, '2', '1', 21),
        movement(date1, '3', '3', 33),
        // date2:
        movement(date2, '1', '2', 120),
        movement(date2, '2', '1', 210),
        movement(date2, '2', '2', 220)
      ];
      return testutil.save_documents(_.concat(admins, mobility));
    });
  });

  after(function disconnect_database(done) {
    mongoose.disconnect(done);
  });

  it('should return data for single dates', function() {
    return Promise.all([
      util.get_egress_mobility('mx-1', date1)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({'mx-1': {'mx-1': 11, 'mx-2': 12}}, result[date1_key]);
        }),
      util.get_egress_mobility('mx-2', date2)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({'mx-2': {'mx-1': 210, 'mx-2': 220}}, result[date2_key]);
        })
    ]);
  });

  it('should return data for all dates in range', function() {
    return Promise.all([
      // Return data for all dates, inclusive.
      util.get_egress_mobility('mx-1', date1, date2)
        .then(function(result) {
          assert.strictEqual(2, _.size(result));
          testutil.assert_equal({'mx-1': {'mx-1': 11, 'mx-2': 12}}, result[date1_key]);
          testutil.assert_equal({'mx-1': {'mx-2': 120}}, result[date2_key]);
        }),
      // Return data for all dates when given range is larger.
      util.get_egress_mobility('mx-2', new Date('1999-01-01'),
                               new Date('3000-12-31'))
        .then(function(result) {
          assert.strictEqual(2, _.size(result));
          testutil.assert_equal({'mx-2': {'mx-1': 21}}, result[date1_key]);
          testutil.assert_equal({'mx-2': {'mx-1': 210, 'mx-2': 220}}, result[date2_key]);
        }),
      // Return data for just date1 when range excludes date2.
      util.get_egress_mobility('mx-1', new Date('1999-01-01'), date1)
        .then(function(result) {
          assert.strictEqual(1, _.size(result));
          testutil.assert_equal({'mx-1': {'mx-1': 11, 'mx-2': 12}}, result[date1_key]);
        })
    ]);
  });

  it('should return latest data when no date specified', function() {
    return Promise.all([
      util.get_egress_mobility('mx-1').then(function(result) {
        assert.strictEqual(1, _.size(result));
        testutil.assert_equal({'mx-1': {'mx-2': 120}}, result[date2_key]);
      }),
      util.get_egress_mobility('mx-2').then(function(result) {
        assert.strictEqual(1, _.size(result));
        testutil.assert_equal({'mx-2': {'mx-1': 210, 'mx-2': 220}}, result[date2_key]);
      })
    ]);
  });

  it('should return empty object for unknown country or admin', function() {
    return Promise.all([
      util.get_egress_mobility('br-1')
        .then(function(result) {
          testutil.assert_equal(result, {});
        }),
      util.get_egress_mobility('mx-100')
        .then(function(result) {
          testutil.assert_equal(result, {});
        })
    ]);
  });

  it('should return empty object for dates we have no data for', function() {
    return util.get_egress_mobility('mx-1', new Date('1980-01-01'))
      .then(function(result) {
        testutil.assert_equal(result, {});
      });
  });
});
