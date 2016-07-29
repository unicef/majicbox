var ArgumentParser = require('argparse').ArgumentParser;
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var _ = require('lodash');

var Airport = require('../../app/models/airport.js');
var config = require('../../config');

/**
 * Read geojson file
 *
 * @param{string} geojson - geojson file with path
 * @param{bool} verbose - Option to display debug
 * @return{Promise} Fulfilled when geojson is returned.
 */
function read_jsonfile(geojson, verbose) {
  return new Promise(function(resolve, reject) {
    jsonfile.readFile(geojson, function(err, feature_collection) {
      if (err) {
        return reject(err);
      }
      if (verbose) {
        console.log('file read');
      }
      resolve(feature_collection);
    });
  });
}

/**
 * Saves a collection of airports (within given region)
 *
 * @param{String} country_code - ISO country code, e.g. 'br'
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_airports(country_code, feature_collection) {
  var airports = [];
  country_code = country_code.toLowerCase();
  // For duplicate checking
  var seen = {};
  _.map(feature_collection.features, function(feat) {
    feat.properties.country_code = feat.properties.country_code.toLowerCase();
    if (country_code && feat.properties.country_code !== country_code) {
      // if a country code is specified, filter airports
      return;
    }

    var airport = {
      country_code: feat.properties.country_code,
      admin_code: feat.properties.adm2_code,
      name: feat.properties.name,
      fcode: feat.properties.fcode,
      airport_code: feat.properties.iata_code.toLowerCase(),
      geo: feat.geometry.coordinates
    };

    // Add or increase value of airport for later duplicate catching
    seen[
      JSON.stringify(airport)
    ] = seen[JSON.stringify(airport)] ? seen[JSON.stringify(airport)] + 1 : 1;

    if (seen[JSON.stringify(airport)] === 1) {
      // Add airport to array if not seen yet
      airports.push(new Airport(airport));
    }
  });

  return new Promise(function(resolve, reject) {
    // Clear out old airports
    Airport.find({country_code: country_code}).remove(function(err) {
      if (err) {
        return reject(err);
      }

      Airport.insertMany(airports, function(err) {
        if (err) {
          return reject(err);
        }
        resolve(feature_collection);
      });
    });
  });
}

/**
 * Import airports from a geojson file and save as Airport documents.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} geojson - name of airport file.
 * @param{string} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function import_airports(country_code, geojson, verbose) {
  return Promise.all([
    read_jsonfile(geojson, verbose)
  ])
  .then(function(responses) {
    var gjdata = responses[0];
    return Promise.all([
      save_airports(country_code, gjdata)
    ]);
  });
}

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Import airport points into database from a geojson file.'
  });

  parser.addArgument(
    ['-c', '--country_code'],
    {help: 'ISO 3166 alpha-2 two letter code for the country.'}
  );

  parser.addArgument(
    ['-g', '--geojson'],
    {help: 'Name of airport geojson file to be imported'}
  );

  parser.addArgument(
    ['--verbose'],
    {help: 'Print debug'}
  );

  var args = parser.parseArgs();

  var geojson = args.geojson ||
    'data/geojson/airports.geojson';

  mongoose.connect(config.database, function(err) {
    if (err) {
      throw err;
    }
    import_airports(args.country_code, geojson, args.verbose)
    .then(function() {
      return process.exit();
    }).catch(function(err) {
      console.log(err);
      process.exit();
    });
  });
}

if (require.main === module) {
  main();
} else {
  exports.import_airports = import_airports;
}
