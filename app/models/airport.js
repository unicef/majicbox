var mongoose = require('mongoose');

var airport_schema = new mongoose.Schema({
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

  // AIRP for airport, PPL for population center
  fcode: String,

  // three-letter airport or city code
  airport_code: {
    type: String,
    index: true,
    validate: {
      validator: function(v) {
        return /[a-z]{3}/.test(v);
      },
      message: '{VALUE} is not a valid name!'
    }
  },

  // geo-indexed [longitude, latitude]
  geo: {
    type: [Number],
    index: '2d'
  }
});

airport_schema.index({country_code: 1, admin_code: 1, airport_code: 1, fcode: 1}, {unique: true});

module.exports = mongoose.model('Airport', airport_schema);
