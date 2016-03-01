var _ = require('lodash');

var Mobility = require('./app/models/mobility');
var Region = require('./app/models/region');
var Weather = require('./app/models/weather');

// TODO(jetpack): Should these functions throw errors when there's no data?

/**
 * Return all regions for the country.
 *
 * @param{string} country_code - Country.
 * @return{Promise} Array of Region objects with properties `region_code`,
 *   `name`, `geo_area_sqkm`, and `geo_feature`.
*/
function get_regions(country_code) {
  return Region.find({country_code: country_code})
    .select('region_code name geo_area_sqkm geo_feature')
    .then(function(regions) {
      return regions.map(function(region) {
        var result = _.pick(region, ['region_code', 'name', 'geo_area_sqkm']);
        // Strip off extra Mongoose document stuff from geo_feature subdocument.
        result.geo_feature = region.geo_feature.toObject();
        return result;
      });
    });
}

/**
 * Return weather data for all regions for the country.
 *
 * @param{string} country_code - Country.
 * @param{Date} date - Requested date. If none given, return latest available
 *   data.
 * @return{Promise} Map from date to region code to Weather data. Example:
 *   {'2016-02-28T00:00:00.000Z': {'br1': {'temp_mean': 23},
 *                                 'br2': {'temp_mean': 25}}}
*/
function get_country_weather(country_code, date) {
  var conditions = {country_code: country_code};
  return get_date_condition(Weather, conditions, date)
    .then(function(latest_date) {
      if (!latest_date) { return {}; }
      conditions.date = latest_date;
      return Weather.find(conditions)
        .select('region_code data')
        .then(function(docs) {
          return docs.reduce(function(result, doc) {
            return _.set(result,
                         [latest_date.toISOString(), doc.region_code],
                         doc.data.toObject());
          }, {});
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
 * @param{Date} start_time - See `get_region_population` JSDoc.
 * @param{Date} end_time - See `get_region_population` JSDoc.
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
 * Returns egress mobility data for a region. This indicates movement out of a
 * region and into other regions.
 *
 * @param{string} country_code - Country.
 * @param{string} origin_region_code - Origin region.
 * @param{Date} start_time - Date. See comment for get_region_populations.
 * @param{Date} end_time - Date. See comment for get_region_populations.
 * @return{Promise} A mapping from date to destination region code to count
 *   value. Dates are in ISO string format. Counts represent movement from the
 *   origin region to each destination region. The origin and destination
 *   regions can be the same, indicating staying in the same region. Example:
 *   {'2016-02-28T00:00:00.000Z': {'br1': 123, 'br2': 256},
 *    '2016-02-29T00:00:00.000Z': {'br1': 128, 'br2': 512}}
 */
function get_egress_mobility(country_code, origin_region_code, start_time,
                             end_time) {
  var conditions = {country_code: country_code,
                    origin_region_code: origin_region_code};
  return get_date_condition(Mobility, conditions, start_time, end_time)
    .then(function(date_condition) {
      if (!date_condition) { return {}; }
      conditions.date = date_condition;
      return new Promise(function(res, rej) {
        Mobility.find(conditions).exec(function(err, docs) {
          if (err) { return rej(err); }
          res(docs.reduce(function(result, mobility) {
            return _.set(result, [mobility.date.toISOString(),
                                  mobility.destination_region_code],
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
 * @param{Date} start_time - Date. See comment for end_time.
 * @param{Date} end_time - Date. If neither start_time nor end_time are given,
 *   returns the most recent data available. If only start_time given, returns
 *   data for that time. If both given, returns all data between the 2 times
 *   (inclusive). It's invalid for only end_time to be specified.
 * @return{Promise} Nested mapping from date to region code to population value.
 *   Dates are in ISO string format. Example:
 *   {'2016-02-28T00:00:00.000Z': {'br1': 32123, 'br2': 75328},
 *    '2016-02-29T00:00:00.000Z': {'br1': 33843, 'br2': 70343}}
 */
function get_mobility_populations(country_code, start_time, end_time) {
  var conditions = {country_code: country_code};
  return Promise.all([get_date_condition(Mobility, conditions, start_time,
                                         end_time),
                      Region.find(conditions).select('region_code')])
    .then(_.spread(function(date_condition, regions) {
      if (!date_condition) { return {}; }
      conditions.date = date_condition;
      // For each region, find the self-migration Mobility data and add it to
      // `result`. When all `region_promises` are fulfilled, we're done.
      var result = {};
      var region_promises = regions.map(function(region) {
        return new Promise(function(resolve, reject) {
          var conditions_with_regions = _.assign(
            {origin_region_code: region.region_code,
             destination_region_code: region.region_code}, conditions);
          Mobility.find(conditions_with_regions)
            .exec(function(err, mobilities) {
              if (err) { return reject(err); }
              mobilities.forEach(function(mobility) {
                _.set(result, [mobility.date.toISOString(), region.region_code],
                      mobility.count);
              });
              resolve();
            });
        });
      });
      return Promise.all(region_promises).then(function() { return result; });
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
  get_regions: get_regions,
  get_country_weather: get_country_weather,
  get_egress_mobility: get_egress_mobility,
  get_mobility_populations: get_mobility_populations,
  stopwatch: stopwatch
};
