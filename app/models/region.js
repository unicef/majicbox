var mongoose = require('mongoose');
var GeoJSON = require('mongoose-geojson-schema');

// TODO(jetpack): administrative regions can change. think about the update
// story. maybe just created/updated_at fields?

var region_schema = new mongoose.Schema({
  // ISO 3166-1 alpha-2 two letter country code.
  country_code: {
    type: String,
    index: true,
    validate: {
      validator: function(v) {
        return /[a-z]{2}/.test(v);
      },
      message: '{VALUE} is not a valid name!'
    }
  },
  // Globally unique identifier for this region. Should contain `<country_code>-` as a prefix.
  region_code: String,
  // Human-readable name, like "São Bernardo do Campo".
  name: String,
  // Area of the region in square kilometers.
  geo_area_sqkm: Number,
  // Polygon of the region. Note: in practice, we send this data in TopoJSON format as simplified
  // polygons instead. See `lib/import/region.js`.
  geo_feature: GeoJSON.Feature
});

region_schema.index({country_code: 1, region_code: 1});

module.exports = mongoose.model('Region', region_schema);
