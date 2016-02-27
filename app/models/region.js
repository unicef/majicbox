var mongoose = require('mongoose');
var GeoJSON = require('mongoose-geojson-schema');

// TODO(jetpack): administrative regions can change. think about the update
// story. maybe just created/updated_at fields?
var region_schema = new mongoose.Schema({
  // ISO 3166-1 alpha-2 two letter country code in lowercase.
  country_code: {type: String, index: true},
  // Unique identifier for this region within the country (e.g. the 2nd part of
  // ISO 3166-2).
  region_code: String,
  // Human-readable name, like "São Bernardo do Campo".
  name: String,
  // Area of the region in square kilometers.
  geo_area_sqkm: Number,
  // Polygon of the region.
  geo_feature: GeoJSON.Feature
});

module.exports = mongoose.model('Region', region_schema);
