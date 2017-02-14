var ArgumentParser = require('argparse').ArgumentParser;
var mongoose = require('mongoose');
var csv = require('fast-csv');
var fs = require('fs');
var _ = require('lodash');

var db = require('../../database');
var Mobility = require('../../app/models/mobility');

/**
 * Return date as UTC in simplified extended ISO format
 * Example: 2015-02-01 -> 2015-02-01T00:00:00.000Z
 *
 * @param{string} yyyymmdd - mobility date
 * @return{date}.
 */
function yyyymmdd_to_iso(yyyymmdd) {
  var match = yyyymmdd.match(/(\d{4})(\d{2})(\d{2})/);
  var date = new Date(match[1], match[2], match[3]);
  return date.toISOString();
}

/**
 * Return whether row is valid
 *
 * @param{obj} row - row from mobility file
 * @return{bool}.
 */
function check_row_is_valid(row) {
  if (_.every(_.values(row), function(val) { return val !== ''; })) {
    return true;
  } else {
    console.error('row missing some fields:', row);
    return false;
  }
}

/**
 * Import mobility from CSV to Mongo.
 *
 * @param{array} file - file in directory to read and import
 * @param{string} country_code - lowercase ISO 3166-1 alpha-2 country code
 * https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
 * @param{bool}verbose - whether to log messages while importing.
 * @return{promise} Fulfilled with array of non-critical data errors once all records are saved.
 */
function import_file(file, country_code, verbose) {
  var stream = fs.createReadStream(file);
  var count = 0;
  var mobility_objects = [];
  // TODO(mikefab): consider reject here
  return new Promise(function(resolve, reject) {
    var data_errors = [];
    csv
    .fromStream(stream, {headers: true})
    .on('data', function(data) {
      // Check that all fields have values
      if (check_row_is_valid(data)) {
        var o = {};
        o.date = yyyymmdd_to_iso(data.DATE);
        o.origin_country_code = country_code;
        o.destination_country_code = country_code;
        o.origin_admin_code = country_code + '-' + data.ORIGIN;
        o.destination_admin_code = country_code + '-' + data.DESTINATION;
        o.count = data.COUNT;
        mobility_objects.push(new Mobility(o));
      } else {
        data_errors.push('invalid row: ' + JSON.stringify(data));
      }
      if (verbose && count % 25000 === 0) { console.log(count++); }
    })
    .on('end', function() {
      bulk_save(mobility_objects, verbose)
      .then(function(err) {
        if (err) {return reject(err);}
        resolve(data_errors);
      });
    });
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
          return reject(err);
        });
      } else {
        resolve();
      }
    }
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
 * @return{promise} Fulfilled once data from all files are saved with map from file name
 *   to list of non-critical data errors, if any.
*/
function import_mobility(dir, country_code, verbose) {
  return get_mobility_files(dir).then(function(files) {
    var errors_by_file_prom = Promise.resolve({});
    files.forEach(function(file) {
      errors_by_file_prom = errors_by_file_prom.then(function(errors_by_file) {
        return import_file(dir + '/' + file, country_code, verbose).then(function(errors) {
          if (!_.isEmpty(errors)) {
            errors_by_file[file] = errors;
          }
          return errors_by_file;
        });
      });
    });
    return errors_by_file_prom;
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

  var mobility_dir = args.dir ||
      'data/mobility/' + args.country_code;

  var mongodb = db.database;
  mongoose.connect(mongodb, function(err) {
    if (err) {
      throw err;
    }

    import_mobility(mobility_dir, args.country_code, args.verbose)
    .then(function(errors_by_file) {
      if (_.isEmpty(errors_by_file)) {
        return process.exit(0);
      } else {
        console.error('Encountered some data issues while processing files:', errors_by_file);
        return process.exit(1);
      }
    }).catch(function(err) {
      console.log(err);
      process.exit(1);
    });
  });
}

if (require.main === module) {
  main();
} else {
  exports.import_mobility = import_mobility;
}
