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
  // ISO 3166-1 alpha-2 two letter country codes. NOTE: there are no indexes on these because we
  // don't have a usecase for it (yet).
  origin_country_code: String,
  destination_country_code: String,

  // Movement origin and destination. Both values should match a Admin
  // document's admin_code.
  origin_admin_code: String,
  destination_admin_code: String,
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
mobility_schema.index({origin_admin_code: 1, date: -1});
mobility_schema.index({origin_admin_code: 1, destination_admin_code: 1,
                       date: -1});

module.exports = mongoose.model('Mobility', mobility_schema);
