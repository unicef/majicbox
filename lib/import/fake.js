var argparse = require('argparse');
var mongoose = require('mongoose');

var Region = require('../../app/models/region');
var Weather = require('../../app/models/weather');
var config = require('../../config');

/**
 * Add fake weather data for all regions.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{date} date - Date.
 * @return{Promise} Fulfilled when documents are saved.
 */
function add_fake_weather(country_code, date) {
  return new Promise(function(res, rej) {
    Region.find({country_code: country_code})
      .select('region_code')
      .exec(function(err, regions) {
        if (err) { return rej(err); }

        var weather_docs = regions.map(function(region) {
          var temp =
              // Base bias: for regions 0 to 5504, ranges from 0 to 37.
              Math.sqrt(parseInt(region.region_code, 10)) / 2 +
              // Temporal cycle: ranges from -20 to 20 over 1 year.
              Math.cos((date.getMonth() * 30 + date.getDay()) *
                       2 * Math.PI / 361 - Math.PI) * 20 +
              // Randomness: ranges from 0 to 5 for each date & region.
              Math.random() * 5;
          return new Weather({
            date: date,
            country_code: country_code,
            region_code: region.region_code,
            data: {temp_mean: temp}
          });
        });

        Weather.insertMany(weather_docs, function(err) {
          if (err) { return rej(err); }
          console.log('Added weather data for', regions.length, 'regions');
          res();
        });
      });
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
    {help: 'ISO 3166 alpha-2 two letter code for the country.'}
  );
  parser.addArgument(
    ['-d', '--date'],
    {help: 'Date. Defaults to today.'}
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
  console.log('Generating fake weather data for date:', date);

  mongoose.connect(config.database, function(err) {
    if (err) { throw err; }
    add_fake_weather(args.country_code, date)
      .then(process.exit);
  });
}

if (require.main === module) {
  main();
}
