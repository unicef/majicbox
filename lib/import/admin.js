var ArgumentParser = require('argparse').ArgumentParser;
var csv = require('fast-csv');
var fs = require('fs');
var geojsonArea = require('geojson-area');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var topojson = require('topojson');
var _ = require('lodash');

var Admin = require('../../app/models/admin');
var AdminTopojson = require('../../app/models/admin-topojson.js');
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
 * Iterate through features, calculating derived properites. Mutates
 * `feature_collection`.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{array} feature_collection - Feature collection
 * @param{hash} admin_pop - Admin to population hash
 */
function enrich_features(country_code, feature_collection, admin_pop) {
  feature_collection.features.forEach(function(feat) {
    feat.properties.country_code = country_code;
    // CarrotJuice has been used with Sierra Leone and Brazil
    // Sierra Leone: DIST_NAME and CHIE-CODE
    // Brazil: NAME_2, ID_2
    feat.properties.name =
      feat.properties.DIST_NAME || feat.properties.NAME_2;
    feat.properties.admin_code = country_code + '-' +
      (feat.properties.CHIE_CODE || feat.properties.ID_2);

    // Assign population to admin if pop value exists
    if (admin_pop[feat.properties.admin_code]) {
      feat.properties.population = admin_pop[feat.properties.admin_code];
    }

    // geojson-area returns sq. meters.
    feat.properties.geo_area_sqkm =
      geojsonArea.geometry(feat.geometry) / Math.pow(1000, 2);
  });
}

/**
 * Convert geojson to topojson, saving results in Mongo.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} feature_collection - geojson.
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_topojson(country_code, feature_collection) {
  return new Promise(function(resolve, reject) {
    // root is directory where topojson will be stored.
    var c = topojson.topology(
      {collection: feature_collection},
      {
        'property-transform': function(object) {
          return _.pick(
            object.properties,
            ['country_code', 'name', 'admin_code', 'geo_area_sqkm', 'population']
          );
        }
      });
    var unsimplified = JSON.parse(JSON.stringify(c));  // copy data
    topojson.simplify(c, {
      'coordinate-system': 'spherical',
      'retain-proportion': 0.4
    });

    // store TopoJSON in Mongo
    AdminTopojson.find({country_code: country_code}).remove(function(err) {
      if (err) {
        return reject(err);
      }
      AdminTopojson.insertMany([{
        country_code: country_code,
        simplification: 1.0,
        topojson: unsimplified
      }, {
        country_code: country_code,
        simplification: 0.4,
        topojson: c
      }], function(err) {
        return err ? reject(err) : resolve(feature_collection);
      });
    });
  });
}

/**
 * Saves a collection representing administrative regions.
 *
 * @param{String} country_code - ISO country code, e.g. 'br'
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_admins(country_code, feature_collection) {
  var admins = _.map(feature_collection.features, function(feat) {
    return new Admin({
      country_code: feat.properties.country_code,
      admin_code: feat.properties.admin_code,
      name: feat.properties.name,
      population: feat.properties.population,
      geo_area_sqkm: feat.properties.geo_area_sqkm
    });
  });

  return new Promise(function(resolve, reject) {
    // Clear out old admins
    Admin.find({country_code: country_code}).remove(function(err) {
      if (err) { return reject(err); }
      Admin.insertMany(admins, function(err) {
        if (err) {return reject(err);}
        resolve(feature_collection);
      });
    });
  });
}

/**
 * Get hash of admin to population
 * mutates `feature_collection`.
 * @param{string} file - world population file for country.
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when csv is read.
 */
function world_pop(file) {
  var stream = fs.createReadStream(file);
  var admin_pop = {};
  return new Promise(function(resolve) {
    stream.on('error', function(err) {
      console.log('No population file. Moving along.', err);
      resolve({});
    });

    csv
      .fromStream(stream)
      .on('data', function(data) {
        admin_pop[data[0]] = parseFloat(data[1]);
      })
      .on('end', function() {
        resolve(admin_pop);
      });
  });
}

/**
 * Import admins from a geojson file and save as Admin documents.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} geojson - name of population file.
 * @param{string} population - name of geojson file.
 * @param{string} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function import_admins(country_code, geojson, population, verbose) {
  return Promise.all([
    read_jsonfile(geojson, verbose),
    world_pop(population)
  ])
  .then(function(feat_collection_and_admin_pop) {
    var feature_collection = feat_collection_and_admin_pop[0];
    var pop_admin = feat_collection_and_admin_pop[1];
    enrich_features(country_code, feature_collection, pop_admin);
    return Promise.all([
      save_admins(country_code, feature_collection),
      save_topojson(country_code, feature_collection)
    ]);
  });
}

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Import admin docs into database from a geojson file.'
  });

  parser.addArgument(
    ['-c', '--country_code'],
    {help: 'ISO 3166 alpha-2 two letter code for the country.'}
  );

  parser.addArgument(
    ['-p', '--population'],
    {help: 'Name of population file to be imported'}
  );

  parser.addArgument(
    ['-g', '--geojson'],
    {help: 'Name of admin geojson file to be imported'}
  );

  parser.addArgument(
    ['--verbose'],
    {help: 'Print debug'}
  );

  var args = parser.parseArgs();

  var geojson = args.geojson ||
    'data/geojson/' + args.country_code + '/admin2.json';
  var population = args.population ||
    'data/population/worldpop_' + args.country_code + '.csv';

  mongoose.connect(config.database, function(err) {
    if (err) { throw err; }
    import_admins(args.country_code, geojson, population, args.verbose)
    .then(function() {
      return process.exit();
    }).catch(function(err) { console.log(err); process.exit();});
  });
}

if (require.main === module) {
  main();
} else {
  exports.import_admins = import_admins;
}
