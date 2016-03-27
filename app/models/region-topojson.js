var mongoose = require('mongoose');
var GeoJSON = require('mongoose-geojson-schema');

// TODO(jetpack): administrative regions can change. think about the update
// story. maybe just created/updated_at fields?

var region_topojson_schema = new mongoose.Schema({
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

  // Retention percentage that was given to topojson.simplify() call.
  simplification: {
    type: Number,
    required: true,
    index: true
  },

  // TopoJSON object of interest.
  topojson: {
    type: {},
    validate: {
      validator: function(v) {
        return v.type === 'Topology';
      }
    },
    required: true
  }
});

region_topojson_schema.index({country_code: 1, simplification: 1});

module.exports = mongoose.model('RegionTopojson', region_topojson_schema);
