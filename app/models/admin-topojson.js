var mongoose = require('mongoose');

// TODO(jetpack): administrative regions can change. think about the update
// story. maybe just created/updated_at fields?

var admin_topojson_schema = new mongoose.Schema({
  // ISO 3166-1 alpha-2 two letter country code.
  country_code: {
    type: String,
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
    required: true
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

admin_topojson_schema.index({country_code: 1, simplification: 1}, {unique: true});

module.exports = mongoose.model('AdminTopojson', admin_topojson_schema);
