var mongoose = require('mongoose');

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

  // Movement origin and destination. Both values should match a Region
  // document's region_code.
  origin_region_code: String,
  destination_region_code: String,
  // Amount of movement from origin to destination.
  count: Number,

  // TODO(jetpack): Need anything else here?
  meta: {
    source: String
  }
});

// NOTE: Deciding which fields to index on and in what order is subtle, and
// depends on query patterns. One rule of thumb is to add fields that are
// queried by range to the end of the index[1]. Consult the Mongo docs on
// indexing[2], and use explain()[3] to investigate query efficiency.
//
// [1] http://blog.mongolab.com/2012/06/cardinal-ins/
// [2] https://docs.mongodb.org/manual/indexes/
// [3] https://docs.mongodb.org/manual/reference/explain-results/

// -1 for `date` to get most recent data first.
mobility_schema.index({country_code: 1, origin_region_code: 1, date: -1});
mobility_schema.index({country_code: 1, origin_region_code: 1,
                       destination_region_code: 1, date: -1});

module.exports = mongoose.model('Mobility', mobility_schema);
