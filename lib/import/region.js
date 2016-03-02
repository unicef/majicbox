var ArgumentParser = require('argparse').ArgumentParser;
var geojsonArea = require('geojson-area');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var config = require('../../config');
var Region = require('../../app/models/region');

/**
 * Read geojson file
 *
 * @param{string} file - geojson file with path
 * @return{Promise} Fulfilled when geojson is returned.
 */
function read_jsonfile(file) {
  return new Promise(function(resolve, reject) {
    jsonfile.readFile(file, function(err, feature_collection) {
      if (err) { return reject(err);}
      resolve(feature_collection);
    });
  });
}

/**
 * Iterate through features, assign values to attributes, and save
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{array} features - Feature collection
 * @param{string} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_features(country_code, features, verbose) {
  var all_done = [];
  var count = 1;

  features.forEach(function(feature) {
    var coords = feature.geometry.coordinates;
    feature.geo_feature = {
      geometry: {
        type: feature.geometry.type,
        coordinates: coords
      }
    };

    feature.country_code = country_code;
    // CarrotJuice has been used with Sierra Leone and Brazil
    // Sierra Leone: DIST_NAME and CHIE-CODE
    // Brazil: NAME_2, ID_2
    feature.name = feature.properties.DIST_NAME || feature.properties.NAME_2;
    feature.region_code = feature.properties.CHIE_CODE ||
                          feature.properties.ID_2;
    var region = new Region(feature);

    region.geo_area_sqkm = geojsonArea.geometry(feature.geo_feature.geometry);
    var promise = new Promise(function(resolve, reject) {
      region.save(function(err) {
        if (err) {return reject(err);}
        if (verbose) {console.log(count++, feature.name, ' Region saved!!');}
        resolve();
      });
    });
    all_done.push(promise);
  });
  return Promise.all(all_done);
}
/**
 * Import admin regions from a geojson file and save as Division documents.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} file - name of geojson file.
 * @param{string} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function import_regions(country_code, file, verbose) {
  return read_jsonfile(file)
  .then(function(feature_collection) {
    return save_features(country_code, feature_collection.features, verbose)
    .catch(function(err) {throw err;});
  });
}

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Parses arguments necessary to importing admins.'
  });
  parser.addArgument(
    ['-c', '--country_code'],
    {
      help: 'ISO 3166 alpha-2 two letter code for the country.'
    }
  );
  parser.addArgument(
    ['-f', '--file'],
    {
      help: 'Name of file to be imported'
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

    import_regions(args.country_code, args.file, args.verbose)
    .then(function() {
      return process.exit();
    });
  });
}

if (require.main === module) {
  main();
} else {
  exports.import_regions = import_regions;
}
