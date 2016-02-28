var mongoose = require('mongoose');

// TODO(jetpack): This schema stores 1 document per-country-region per-timestamp
// (at least daily, potentially hourly). This seems like a lot. We could instead
// move the region_code into the data subdocument, and then have that be an
// Array. This would only be 1 document per-county, per-day (hour).
//
// data: [{region_code: String, temp_mean: Number, ...}]
//
// We /probably/ usually want weather data for all the regions in a country, so
// this probably makes more sense?

var weather_schema = new mongoose.Schema({
  // Which date this data is for. See note in Mobility schema for discussion
  // about how to represent different time granularities.
  date: Date,
  // Data subtype (e.g. "daily"/"hourly", "day"/"night", etc.).
  kind: String,
  // ISO 3166-1 alpha-2 two letter country code.
  country_code: {type: String, index: true},
  // Should match a Region document's region_code.
  region_code: String,
  data: {
    // Mean, min, and max temperature in degrees centigrade.
    temp_mean: Number,
    temp_min: Number,
    temp_max: Number
  }
});

// See note in Mobility schema on indexing subtleties, and links to
// documentation.

// -1 for `date` to get most recent data first.
weather_schema.index({country_code: 1, region_code: 1, date: -1});
weather_schema.index({country_code: 1, region_code: 1, kind: 1, date: -1});

module.exports = mongoose.model('Weather', weather_schema);
