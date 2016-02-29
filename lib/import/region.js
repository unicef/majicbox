'use strict';

var ArgumentParser = require('argparse').ArgumentParser;
var geojsonArea = require('geojson-area');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var q = require('q');
var config = require('../../config');
var Region = require('../../app/models/region');

/**
 * Read geojson file
 *
 * @param{string} path - path to geojson file
 * @return{Promise} Fulfilled when geojson is returned.
 */
function read_jsonfile(path) {
  return new Promise(function(resolve) {
    jsonfile.readFile(path, function(err, feature_collection) {
      if (err) { return err;}
      resolve(feature_collection);
    });
  });
}

/**
 * Iterate through features, assign values to attributes, and save
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{array} features - Feature collection
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_features(country_code, features) {
  var def = q.defer();
  var all_done = [];
  var count = 1;
  features.forEach(function(feature) {
    var coords = feature.geometry.coordinates;
    feature.geoFeature = {
      geometry: {
        type: feature.geometry.type,
        coordinates: coords
      }
    };

    feature.country_code = country_code;
    feature.name = feature.properties.DIST_NAME || feature.properties.NAME_1;
    feature.region_code = feature.properties.CHIE_NAME ||
                          feature.properties.NAME_2;

    var region = new Region(feature);

    region.geo_area_sqkm = geojsonArea.geometry(feature.geoFeature.geometry);
    var promise = new Promise(function(resolve) {
      region.save(function(err) {
        if (err) {
          return err;
        } else {
          console.log(count++, feature.region_code, ' Region saved!');
        }
        resolve();
      });
    });
    all_done.push(promise);
    if (all_done.length === features.length) {
      Promise.all(all_done).then(function() {
        def.resolve();
      });
    }
  });
  return def.promise;
}

/**
 * Import admin regions from a geojson file and save as Division documents.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} path - path of geojson file.
 * @return{Promise} Fulfilled when documents are saved.
 */
function import_regions(country_code, path) {
  return read_jsonfile(path)
  .then(function(feature_collection) {
    return save_features(country_code, feature_collection.features);
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
  var args = parser.parseArgs();

  var mongodb = config.database;
  mongoose.connect(mongodb, function(err) {
    if (err) {
      throw err;
    }
    var path = './data/geojson/' + args.country_code +
    '/' + args.file + '.json';
    import_regions(args.country_code, path)
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
