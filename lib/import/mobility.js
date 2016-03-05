var ArgumentParser = require('argparse').ArgumentParser;
var mongoose = require('mongoose');
var csv = require('fast-csv');
var fs = require('fs');

var config = require('../../config');
var Mobility = require('../../app/models/mobility');

/**
 * Convert date from EST to ISO format
 *
 * @param{string} date - asdf
 * @return{date}.
 */
function prep_isodate(date) {
  date = new Date(date);
  date.setHours(date.getHours());
  return date.toISOString();
}

/**
 * Import mobility from CSV to Mongo.
 *
 * @param{array} file - file in directory to read and import
 * @param{string} country_code - lowercase ISO 3166-1 alpha-2 country code
 *   https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2 * @param{bool} verbose - whether to log messages while importing.
 * @param{bool} verbose - whether to log messages while importing.
 * @return{promise} Fulfilled once all records are saved.
 */
function import_file(file, country_code, verbose) {
  var stream = fs.createReadStream(file);
  var count = 0;
  var mobility_objects = [];
  // TODO(mikefab): consider reject here
  return new Promise(function(resolve) {
    var csvStream = csv()
        .on('data', function(data) {
          if (verbose && count % 1000 === 0) {console.log(count);}
          // Skip first line (column names) in each mobility file
          if ((count > 0) && (data.length > 3)) {
            var o = {};
            o.date = prep_isodate(data[0].replace(/(\d{4})(\d{2})(\d{2})/,
                                                  '$1-$2-$3'));
            o.origin_region_code = data[1];
            o.destination_region_code = data[2];
            o.count = data[3];
            o.country_code = country_code;
            mobility_objects.push(new Mobility(o));
          }
          ++count;
        })
        .on('end', function() {
          bulk_save(mobility_objects, verbose)
          .then(function() {
            resolve();
          });
        });
    stream.pipe(csvStream);
  });
}

/**
 * Import mobility collection into mongo.
 *
 * @param{array} ary - array of mobility objects
 * @param{bool} verbose - whether to log messages while importing.
 * @return{promise} Fulfilled once all records are saved.
 */
function bulk_save(ary, verbose) {
  var debug_msg = 'Have left to save';
  return new Promise(function(resolve, reject) {
  /**
   * Save a splice of array of mobility records.
   * @param{array} ary - array of mobility objects
   */
    function save(ary) {
      if (ary.length > 0) {
        if (verbose) { console.log(debug_msg, ary.length);}
        Mobility.insertMany(ary.splice(0, 1000))
        .then(function() {
          save(ary);
        })
        .catch(function(err) {
          if (err) {return reject(err);}
        });
      } else {
        resolve();
      }
    }
    if (verbose) { console.log(debug_msg, ary.length);}
    save(ary);
  });
}

/**
 * Return list of mobility files in directory.
 *
 * @param{string} dir - directory where mobility files are stored
 * @return{promise} Fulfilled once all files are in list
 */
function get_mobility_files(dir) {
  return new Promise(function(resolve, reject) {
    fs.readdir(dir, function(err, list) {
      if (err) { console.log(err); return reject(err);}
      list = list.filter(function(e) {
        return e.match(/.csv/);
      });
      resolve(list);
    });
  });
}

/**
 * Import mobility from CSV to Mongo.
 *
 * @param{string} dir - directory where mobility csv files exist.
 * @param{string} country_code - lowercase ISO 3166-1 alpha-2 country code
 *   https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
 * @param{bool} verbose - whether to log messages while importing.
 * @return{promise} Fulfilled once all records are saved.
 *
 * Needs to be connected to mongo before calling.
 */
function import_mobility(dir, country_code, verbose) {
  var all_done = [];
  return get_mobility_files(dir)
  .then(function(list) {
    list.forEach(function(csv_file) {
      var promise = new Promise(function(resolve) {
        import_file(dir + '/' + csv_file, country_code, verbose)
        .then(function() {
          resolve();
        });
      });
      all_done.push(promise);
    });
    return Promise.all(all_done);
  });
}

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Import mobility docs into db from a directory of csv files.'
  });
  parser.addArgument(
    ['-c', '--country_code'],
    {
      help: 'ISO 3166 alpha-2 two letter code for the country.'
    }
  );
  parser.addArgument(
    ['-d', '--dir'],
    {
      help: 'Name of directory'
    }
  );

  parser.addArgument(
    ['--verbose'],
    {
      help: 'Print debug'
    }
  );

  var args = parser.parseArgs();

  var mongodb = config.database;
  mongoose.connect(mongodb, function(err) {
    if (err) {
      throw err;
    }

    import_mobility(args.dir, args.country_code, args.verbose)
    .then(function() {
      return process.exit();
    }).catch(function(err) { console.log(err); process.exit();});
  });
}

if (require.main === module) {
  main();
} else {
  exports.import_mobility = import_mobility;
}
