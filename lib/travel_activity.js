var fs = require('fs');
// For google geochart in magicbox dashboard app
var country_code_3_to_2 = JSON.parse(fs.readFileSync('./lib/country_codes.json', 'utf8'));
var Mobility = require('../app/models/mobility');
var moment = require('moment');

/**
 * Returns aggregated activity by country.
 *
 * @param{Date} start_date - See comment near the top of this module.
 * @param{Date} end_date - See comment near the top of this module.
 * @param{string} origin_country_code - Origin country.
 * @return{Promise} Aggregate country departure activty by date.
  Example:
 * {
 *   "origin_country_code": "VI",
 *   "count": 17869
 * },
 */
exports.travel_from_country_activity = function(start_date, end_date, origin_country_code) {
  start_date = moment(parseInt(start_date, 10)).toDate();
  end_date = moment(parseInt(end_date, 10)).toDate();

  var obj_match = {
    date: {$gte: start_date, $lte: end_date}
  };

  if (origin_country_code) {
    obj_match = Object.assign(
      {origin_country_code: origin_country_code.toUpperCase()},
      obj_match
    );
  }

  return new Promise(function(resolve, reject) {
    Mobility.aggregate(
      [
        {$match: obj_match
        },
        {
          $group:
          {
            _id: {origin_country_code: "$origin_country_code"},
            count: {$sum: "$count"}
          }
        }
      ]
    ).exec(function(err, doc) {
      if (err) {
        return reject(err);
      }
      resolve(
        doc.map(function(obj) {
          return {
            origin_country_code: country_code_3_to_2[obj._id.origin_country_code],
            count: obj.count
          };
        })
      );
    });
  });
};
