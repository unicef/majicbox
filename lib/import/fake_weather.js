var _ = require('lodash');
var argparse = require('argparse');
var mongoose = require('mongoose');

var Admin = require('../../app/models/admin');
var Weather = require('../../app/models/weather');
var db = require('../../database');
var util = require('../../util');

// eslint-disable-next-line require-jsdoc
function bogus_temp(admin_code, date) {
  // Ranges from 0 to 40 + sqrt(#admins)/2. With ~5500 admins, that's
  // 0 to 77.
  var temp =
      // Base bias: for admins 0 to 5504, ranges from 0 to 37.
      Math.sqrt(parseInt(admin_code.match(/\d+/)[0], 10)) / 2 +
      // Temporal cycle: ranges from 0 to 40 over 1 year.
      (Math.cos((date.getMonth() * 30 + date.getDay()) *
                2 * Math.PI / 361 - Math.PI) + 1) * 20 +
      // Randomness: ranges from 0 to 5 for each date & admin.
      Math.random() * 5;
  return temp;
}

/**
 * Add fake weather data for all admins.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{Date} date - Last date of data.
 * @param{Number} num_days - How many days to generate data for, leading up to `date`.
 * @return{Promise} Fulfilled when documents are saved.
 */
function add_fake_weather(country_code, date, num_days) {
  var dates = _.range(num_days).map(function(num_prev_days) {
    return util.add_days(date, -1 * num_prev_days);
  });
  console.log('Creating fake weather for', country_code, dates);
  var admins_promise = new Promise(function(res, rej) {
    Admin.find({country_code: country_code})
      .select('admin_code')
      .exec(function(err, admins) {
        if (err) { return rej(err); }
        res(admins);
      });
  });
  return admins_promise.then(function(admins) {
    var result = Promise.resolve();
    dates.forEach(function(date) {
      result = result.then(function() {
        return new Promise(function(res, rej) {
          console.log('Saving weather data for', country_code, date);
          var weather_docs = admins.map(function(admin) {
            return new Weather({
              date: date,
              country_code: country_code,
              admin_code: admin.admin_code,
              data: {temp_mean: bogus_temp(admin.admin_code, date)}
            });
          });
          Weather.insertMany(weather_docs, function(err) {
            if (err) { return rej(err); }
            console.log('....weather data saved!', country_code, date);
            res();
          });
        });
      });
    });
    return result;
  });
}

/** @return{Date} Date of most recent midnight, UTC. */
function last_midnight() {
  var date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'Add fake weather data.'
  });
  parser.addArgument(
    ['-c', '--country_code'],
    {help: 'ISO 3166 alpha-3 three letter code for the country.'}
  );
  parser.addArgument(
    ['-d', '--date'],
    {help: 'Date. Defaults to today.'}
  );
  parser.addArgument(
    ['-n', '--num_days'],
    {help: 'Number of days in the past to generate data for. Defaults to 1.'}
  );
  var args = parser.parseArgs();

  var date;
  if (args.date) {
    if (!Date.parse(args.date)) {
      console.error('Invalid date:', args.date);
      process.exit(1);
    }
    date = new Date(args.date);
  } else {
    date = last_midnight();
  }
  var num_days = 1;
  if (args.num_days) {
    num_days = parseInt(args.num_days, 10);
    if (!num_days) {
      console.error('Invalid number of days:', num_days);
      process.exit(1);
    }
  }
  console.log('Generating fake weather data for date, n days:', date, num_days);

  mongoose.connect(db.database, function(err) {
    if (err) { throw err; }
    add_fake_weather(args.country_code, date, num_days)
      .then(process.exit)
      .catch(function(err) { console.log('Error!', err); process.exit(1); });
  });
}

if (require.main === module) {
  main();
}
