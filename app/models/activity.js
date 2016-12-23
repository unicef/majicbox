import mongoose from 'mongoose';
var DateOnly = require('mongoose-dateonly')(mongoose);

const activity_schema = new mongoose.Schema({
  date: DateOnly,
  frequency: {type: String, enum: ['daily', 'weekly', 'monthly']},
  country_code: String,
  admin_code: String,
  key_ids: [String], // in twitter activity record this will represent counted tweet ids
  counts: [Number],
  data_source: String,
  crawler: String, // northwest, rio de
  type: String // tweets, SMS, calls
});

export default mongoose.model('Activity', activity_schema);
