var _ = require('lodash');

var Admin = require('./app/models/admin');
var Mobility = require('./app/models/mobility');
var Weather = require('./app/models/weather');

/**
 * Wrapper for _.setWith that is like _.set, except it works with number
 * strings. _.set with a number string in the path will create an array.
 * Example: _.set({}, ['br', '1'], 'value') -> {"br": [null,"value"]}
 * Versus: my_set({}, ['br', '1'], 'value') -> {"br": {"1": "value"}}
 *
 * @param{Object} object - Object to modify.
 * @param{Array|string} path - The path of property to set.
 * @param{*} value - Value to set in object.
 * @return{Object} Returns object.
 */
function my_set(object, path, value) {
  return _.setWith(object, path, value, Object);
}

/**
 * Return new UTC date incremented by number of days.
 * @param{Date} date - Starting date.
 * @param{Number} num_days - Number of days to add. Can be negative. Should be integral.
 * @return{Date} New date.
 */
function add_days(date, num_days) {
  var result = new Date(date);
  // Note! The `UTC` bits are important! Otherwise, this goes screwy when crossing timezones, of
  // course.
  result.setUTCDate(result.getUTCDate() + num_days);
  return result;
}

// TODO(jetpack): Should these functions throw errors when there's no data?

// A number of functions here take `start_time` and `end_time` parameters. The
// semantics for each of these are the same (unless otherwise noted):
// * If neither start_time nor end_time are given, the function returns the most
//   recent data available.
// * If only start_time given, returns data for that time.
// * If both given, returns all data between the 2 times (inclusive).
// * It's invalid for only end_time to be specified.

/**
 * Return all admins for the country.
 *
 * @param{string} country_code - Country.
 * @return{Promise} Array of Admin objects with properties `admin_code`,
 *   `name`, `geo_area_sqkm`, and `geo_feature`.
*/
function get_admins(country_code) {
  return Admin.find({country_code: country_code})
    .select('admin_code name geo_area_sqkm geo_feature')
    .then(function(admins) {
      return admins.map(function(admin) {
        var result = _.pick(admin, ['admin_code', 'name', 'geo_area_sqkm']);
        // Strip off extra Mongoose document stuff from geo_feature subdocument.
        result.geo_feature = admin.geo_feature.toObject();
        return result;
      });
    });
}

/**
 * Return weather data for all admins for the country.
 *
 * @param{string} country_code - Country.
 * @param{Date} date - Requested date. If none given, return latest available
 *   data.
 * @return{Promise} Map from date to admin code to Weather data. Example:
 *   {'2016-02-28T00:00:00.000Z': {'br-1': {'temp_mean': 23},
 *                                 'br-2': {'temp_mean': 25}}}
*/
function get_country_weather(country_code, date) {
  var conditions = {country_code: country_code};
  return get_date_condition(Weather, conditions, date)
    .then(function(latest_date) {
      if (!latest_date) { return {}; }
      conditions.date = latest_date;
      return Weather.find(conditions)
        .select('admin_code data')
        .then(function(docs) {
          return docs.reduce(function(result, doc) {
            return my_set(result,
                          [latest_date.toISOString(), doc.admin_code],
                          doc.data.toObject());
          }, {});
        });
    });
}

// TODO(jetpack): hey this can probably be merged into the previous function?

/**
 * Return weather data for given admin.
 *
 * @param{string} admin_code - Admin.
 * @param{Date} start_time - See comment near the top of this module.
 * @param{Date} end_time - See comment near the top of this module.
 * @return{Promise} Map from date to admin code to Weather data. Example:
 *   {'2016-02-29T00:00:00.000Z': {'br-1': {'temp_mean': 23}},
 *    '2016-02-28T00:00:00.000Z': {'br-1': {'temp_mean': 21}}}
 */
function get_admin_weather(admin_code, start_time, end_time) {
  var conditions = {admin_code: admin_code};
  return get_date_condition(Weather, conditions, start_time, end_time)
    .then(function(date_condition) {
      if (!date_condition) { return {}; }
      conditions.date = date_condition;
      return Weather.find(conditions)
        .select('date data')
        .then(function(docs) {
          // TODO(jetpack): use _.reduce + my_set pattern, like with
          // get_egress_mobility.
          var result = {};
          docs.forEach(function(doc) {
            var bleh = {};
            bleh[admin_code] = doc.data.toObject();
            result[doc.date.toISOString()] = bleh;
          });
          return result;
        });
    });
}

// TODO(jetpack): Change the date range params. Figure out how to do unions
// (null, 1 date, and pair of dates).

/**
 * Helper function to return the date condition to use, based on input
 * `start_time` and `end_time` parameters. If both are defined, the returned
 * date condition is an inclusive range. If only `start_time` is defined, an
 * exact date match is returned. If neither are defined, we search for the most
 * recent `date` value stored in the model's collection.
 *
 * @param{Model} model - Mongoose model collection.
 * @param{object} conditions - Conditions to filter for.
 * @param{Date} start_time - See comment near the top of this module.
 * @param{Date} end_time - See comment near the top of this module.
 * @return{Promise} Fulfilled with a value suitable for use as a condition
 *   filter on the `date` field *or* null if documents were found.
 */
function get_date_condition(model, conditions, start_time, end_time) {
  if (start_time && end_time) {
    return Promise.resolve({$gte: start_time, $lte: end_time});
  } else if (start_time) {
    return Promise.resolve(start_time);
  } else {
    return new Promise(function(res, rej) {
      model.findOne(conditions)
        .select('date')
        .sort('-date')
        .exec(function(err, doc) {
          if (err) { return rej(err); }
          if (!doc) { return res(null); }
          res(doc.date);
        });
    });
  }
}

/**
 * Returns egress mobility data for a admin. This indicates movement out of a
 * admin and into other admins.
 *
 * @param{string} origin_admin_code - Origin admin.
 * @param{Date} start_time - See comment near the top of this module.
 * @param{Date} end_time - See comment near the top of this module.
 * @return{Promise} A mapping from date to destination admin code to count
 *   value. Dates are in ISO string format. Counts represent movement from the
 *   origin admin to each destination admin. The origin and destination
 *   admins can be the same, indicating staying in the same admin. Example:
 *   {'2016-02-28T00:00:00.000Z': {'br-1': {'br-1': 123, 'br-2': 256}},
 *    '2016-02-29T00:00:00.000Z': {'br-1': {'br-1': 128, 'co-1': 512}}}
 */
function get_egress_mobility(origin_admin_code, start_time, end_time) {
  var conditions = {origin_admin_code: origin_admin_code};
  return get_date_condition(Mobility, conditions, start_time, end_time)
    .then(function(date_condition) {
      if (!date_condition) { return {}; }
      conditions.date = date_condition;
      return new Promise(function(res, rej) {
        Mobility.find(conditions).exec(function(err, docs) {
          if (err) { return rej(err); }
          res(docs.reduce(function(result, mobility) {
            return my_set(result, [mobility.date.toISOString(),
                                   mobility.origin_admin_code,
                                   mobility.destination_admin_code],
                          mobility.count);
          }, {}));
        });
      });
    });
}

/**
 * Returns relative population estimates for the country based on mobility data.
 *
 * @param{string} country_code - Country.
 * @param{Date} start_time - See comment near the top of this module.
 * @param{Date} end_time - See comment near the top of this module.
 * @return{Promise} Nested mapping from date to admin code to population value.
 *   Dates are in ISO string format. Example:
 *   {'2016-02-28T00:00:00.000Z': {'br1': 32123, 'br2': 75328},
 *    '2016-02-29T00:00:00.000Z': {'br1': 33843, 'br2': 70343}}
 */
function get_mobility_populations(country_code, start_time, end_time) {
  var conditions = {origin_country_code: country_code,
                    destination_country_code: country_code};
  return Promise.all([get_date_condition(Mobility, conditions, start_time,
                                         end_time),
                      Admin.find({country_code: country_code}).select(
                        'admin_code')])
    .then(_.spread(function(date_condition, admins) {
      if (!date_condition) { return {}; }
      conditions.date = date_condition;
      // For each admin, find the self-migration Mobility data and add it to
      // `result`. When all `admin_promises` are fulfilled, we're done.
      var result = {};
      var admin_promises = admins.map(function(admin) {
        return new Promise(function(resolve, reject) {
          var conditions_with_admins = _.assign(
            {origin_admin_code: admin.admin_code,
             destination_admin_code: admin.admin_code}, conditions);
          Mobility.find(conditions_with_admins)
            .exec(function(err, mobilities) {
              if (err) { return reject(err); }
              mobilities.forEach(function(mobility) {
                my_set(result,
                       [mobility.date.toISOString(), admin.admin_code],
                       mobility.count);
              });
              resolve();
            });
        });
      });
      return Promise.all(admin_promises).then(function() { return result; });
    }));
}

/**
 * Simple timing tool. `stopwatch.reset` resets the timer. Subsequent calls to
 * `stopwatch.click` will output a console message with the time since the last
 * `click` or `reset`.
 */
// TODO(jetpack): change to take key, so can have multiple, overlapping
// stopwatches running. or, return stopwatch objects.
var stopwatch = (function() {
  var global_stopwatch_last_time = 0;

  /**
   * Reset stopwatch to time new sequence.
   * @param{object} msg - Gets logged.
   */
  function reset(msg) {
    global_stopwatch_last_time = Date.now();
    if (msg) { console.log('\n' + msg, global_stopwatch_last_time); }
  }

  // TODO(jetpack): change to log `arguments`, like console.log.
  /**
   * Log time since last click (or reset).
   * @param{object} msg - Gets logged along with the time.
   */
  function click(msg) {
    var now = Date.now();
    console.log(msg, now - global_stopwatch_last_time);
    global_stopwatch_last_time = now;
  }

  return {reset: reset, click: click};
})();

module.exports = {
  get_admins: get_admins,
  get_country_weather: get_country_weather,
  get_admin_weather: get_admin_weather,
  get_egress_mobility: get_egress_mobility,
  get_mobility_populations: get_mobility_populations,
  add_days: add_days,
  stopwatch: stopwatch
};
