var mongoose = require('mongoose');
var GeoJSON = require('mongoose-geojson-schema');

// TODO(jetpack): administrative regions can change. think about the update
// story. maybe just created/updated_at fields?

var admin_schema = new mongoose.Schema({
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
  // Globally unique identifier for this admin. Should contain `<country_code>-` as a prefix.
  admin_code: {type: String, index: true},
  // Human-readable name, like "São Bernardo do Campo".
  name: String,
  population: Number,
  // Area in square kilometers.
  geo_area_sqkm: Number,
  // Polygon of the admin. Note: in practice, we send this data in TopoJSON format as simplified
  // polygons instead. See `lib/import/admin.js`.
  geo_feature: GeoJSON.Feature
});

admin_schema.index({country_code: 1, admin_code: 1});

module.exports = mongoose.model('Admin', admin_schema);
