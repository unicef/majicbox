var mongoose = require('mongoose');
var GeoJSON = require('mongoose-geojson-schema');

// TODO(jetpack): administrative regions can change. think about the update
// story. maybe just created/updated_at fields?
//
// TODO(jetpack): do we need any metadata? probably not for this, which should
// be fully public and mostly static, right?
var region_schema = new mongoose.Schema({
  code: String,  // Unique, official (in some cases) identifier, such as ISO 3166-2.
  name: String,  // Human-readable name, like "São Bernardo do Campo".
  geo_area_sqkm: Number,  // Area of the region in square kilometers.
  geo_feature: GeoJSON.Feature  // Polygon of region.
});

module.exports = mongoose.model('Region', region_schema);
