import mongoose from 'mongoose'

const activity_schema = new mongoose.Schema({
  country_code: String,
  tweets_ids: [String],
  local_day: String,
  hours: [Number],
  admin_id: String
});

module.exports = mongoose.model('TwitterActivity', activity_schema);
