var mongoose = require('mongoose');

// TODO(jetpack): Per-country, per-day, this schema stores 1 document per
// region. This is probably fine, though alternatively, we could store 1
// document per (origin, destination) pair. This shouldn't be too expensive as
// the mobility matrix should be quite sparse, and maybe simplifies some
// application logic(?).

var mobility_schema = new mongoose.Schema({
  // Which date this data is for.
  //
  // Note that there isn't an explicit time granularity specified in the schema,
  // so this could hold weekly/daily/hourly data. One can use the `kind` field
  // to make that distinction. For example, if both daily and hourly data is
  // stored, there may be 2 documents with date: `2016-02-27 00:00:00` for daily
  // and hourly data. The `kind` field can specify "daily" or "hourly" to
  // distinguish these two records.
  date: Date,
  // Data subtype (e.g. "daily"/"hourly", "day"/"night", etc.).
  kind: String,
  // ISO 3166-1 alpha-2 two letter country code.
  //
  // Note: this country applies to both the origin and destination region codes,
  // so this schema can't represent inter-country mobility. There are a few
  // options to enable that, if we need it:
  // * Rename `country_code` to `origin_country_code`, and add country codes to
  //   all the destination data.
  // * Change the Region schema's region_code to be globally unique (currently,
  //   they only need to be unique within a country).
  country_code: String,

  // Movement origin. Should match a Region document's region_code.
  origin_region_code: String,
  // Movement destinations. Array of (destination region code, count) pairs.
  destinations: [{code: String, count: Number}]
});

// TODO(jetpack): you're gonna want some indices on this thing. probably a
// compound index on {date, country_code} and maybe {date, country_code, and
// origin_region_code}. not sure about kind?

module.exports = mongoose.model('Mobility', mobility_schema);
