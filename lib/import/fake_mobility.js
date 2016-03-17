var _ = require('lodash');
var argparse = require('argparse');
var d3 = require('d3');
var mongoose = require('mongoose');

var Mobility = require('../../app/models/mobility');
var config = require('../../config');
var util = require('../../util');

var get_mobility_data = function(country_code, date, min_count) {
  return new Promise(function(res, rej) {
    // Note: if there are cross-country records, we only copy egress from the country.
    var conditions = {origin_country_code: country_code,
                      date: date,
                      count: {$gte: min_count}};
    Mobility.find(conditions)
      .exec(function(err, mobilities) {
        if (err) { return rej(err); }
        res(mobilities.map(function(m) {
          var o = m.toObject();
          delete o._id;
          return o;
        }));
      });
  });
};

/**
 * Add fake mobility data based on existing mobility data stored for given date.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{Date} date - Mobility data from this date is copy. There must be data already stored for
 *   this date.
 * @param{Number} num_days - How many days to generate data for, after `date`.
 * @param{Number} min_count - Only copy records with at least this count.
 * @param{Array} jitter_range - How much to randomly modify data. Given a bounds of [x,y],
 *   a day N's counts may be from N-1_count * (1 + x) to N-1_count * (1 + y). For example, [-0.1,
 *   0.1] means that from day to day, a region's count can increase or decrease by 10%.
 * @param{bool} dry_run - Actually save or just print?
 * @return{Promise} Fulfilled when documents are saved.
 */
function add_fake_mobility_for_num_days(country_code, date, num_days, min_count, jitter_range,
                                        dry_run) {
  // Scales from random value to a value in `jitter_range`.
  var jitter_scale = d3.scale.linear().domain([0, 1]).range(jitter_range);
  var dates = _.range(num_days).map(function(num_next_days) {
    // + 1 to avoid re-saving original data.
    return util.add_days(date, num_next_days + 1);
  });

  console.log('Creating fake mobility data for', country_code, dates);
  return get_mobility_data(country_code, date, min_count).then(function(mobilities) {
    console.log('Got this many records for date', date, 'with count >', min_count, ':',
                _.size(mobilities));

    var result = Promise.resolve();
    dates.forEach(function(date) {
      result = result.then(function() {
        console.log('updating records for', date);
        // Every day, we mutate all mobility records.
        mobilities.forEach(function(mobility) {
          mobility.date = date;
          var next_count = Math.round(mobility.count * (1 + jitter_scale(Math.random())));
          // Don't let count drop below `min_count`.
          mobility.count = Math.max(min_count, next_count);
        });
        // Then we save it.
        if (dry_run) {
          return console.log('DRYRUN! example record:', mobilities[0]);
        }
        return new Promise(function(res, rej) {
          Mobility.insertMany(mobilities, function(err) {
            if (err) { return rej(err); }
            console.log('Saved records for', date);
            res();
          });
        });
      });
    });
    return result;
  });
}

// Same as add_fake_mobility_for_num_days, but only copies to a single `date_dest` date instead of a
// range.
var add_fake_mobility_to_date = function(country_code, date_src, date_dest, min_count, jitter_range,
                                         dry_run) {
  // Scales from random value to a value in `jitter_range`.
  var jitter_scale = d3.scale.linear().domain([0, 1]).range(jitter_range);

  console.log('Creating fake mobility data for', country_code, date_dest);
  return get_mobility_data(country_code, date_src, min_count)
    .then(function(mobilities) {
      console.log('Got this many records for date', date_src, 'with count >', min_count, ':',
                  _.size(mobilities));
      // Mutate all mobility records.
      mobilities.forEach(function(mobility) {
        mobility.date = date_dest;
        var next_count = Math.round(mobility.count * (1 + jitter_scale(Math.random())));
        // Don't let count drop below `min_count`.
        mobility.count = Math.max(min_count, next_count);
      });
      // Then we save a copy.
      if (dry_run) {
        return console.log('DRYRUN! example record:', mobilities[0]);
      }
      return new Promise(function(res, rej) {
        Mobility.insertMany(mobilities, function(err) {
          if (err) { return rej(err); }
          console.log('Saved records for', date_dest);
          res();
        });
      });
    });
};

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new argparse.ArgumentParser({
    addHelp: true,
    description: 'Copy mobility data for a given day to other days.'
  });
  parser.addArgument(
    ['-c', '--country_code'],
    {help: 'ISO 3166 alpha-2 two letter code for the country.'}
  );
  parser.addArgument(
    ['-d', '--date_src'],
    {help: 'Date to copy mobility data from.'}
  );
  parser.addArgument(
    ['-d2', '--date_dest'],
    {help: 'Date to copy mobility data to. Should only specify one of -n or -d2.'}
  );
  parser.addArgument(
    ['-n', '--num_days'],
    {help: 'Number of days after date to synthesize fake data for. Defaults to 1.'}
  );
  var args = parser.parseArgs();

  // TODO(jetpack): clean up, seriously, please.
  var date_src;
  if (!args.date_src || !Date.parse(args.date_src)) {
    console.error('Invalid date:', args.date_src);
    process.exit(1);
  }
  date_src = new Date(args.date_src);

  if (args.num_days && args.date_dest) {
    console.error('Specify only 1 of num_days or date_dest!');
    process.exit(1);
  }

  var num_days = 1;
  var date_dest;
  if (args.num_days) {
    num_days = parseInt(args.num_days, 10);
    if (!num_days) {
      console.error('Invalid number of days:', num_days);
      process.exit(1);
    }
  } else if (args.date_dest) {
    if (!Date.parse(args.date_dest)) {
      console.error('Invalid date:', args.date_src);
      process.exit(1);
    }
    date_dest = new Date(args.date_dest);
  } else {
    console.error('Specify exactly 1 of num_days or date_dest!');
    process.exit(1);
  }

  // Hardcoded for now.
  var min_count = 800;
  var jitter_range = [-0.05, 0.05];

  mongoose.connect(config.database, function(err) {
    if (err) { throw err; }
    var work =
        date_dest ?
        add_fake_mobility_to_date(args.country_code, date_src, date_dest, min_count, jitter_range) :
        add_fake_mobility_for_num_days(args.country_code, date_src, num_days, min_count,
                                       jitter_range);
    work
      .then(process.exit)
      .catch(function(err) { console.log('Error!', err); process.exit(1);});
  });
}

if (require.main === module) {
  main();
}
