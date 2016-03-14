var ArgumentParser = require('argparse').ArgumentParser;
var csv = require('fast-csv');
var fs = require('fs');
var geojsonArea = require('geojson-area');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var topojson = require('topojson');
var _ = require('lodash');

var Admin = require('../../app/models/admin');
var config = require('../../config');

/**
 * Read geojson file
 *
 * @param{string} file - geojson file with path
 * @param{bool} verbose - Option to display debug
 * @return{Promise} Fulfilled when geojson is returned.
 */
function read_jsonfile(file, verbose) {
  return new Promise(function(resolve, reject) {
    jsonfile.readFile(file, function(err, feature_collection) {
      if (err) { return reject(err);}
      if (verbose) {console.log('file read');}
      resolve(feature_collection);
    });
  });
}

/**
 * Iterate through features, assign values to attributes
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{array} feature_collection - Feature collection
 * @param{hash} admin_pop - Admin to population hash
 * @param{bool} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function enrich_features(country_code, feature_collection, admin_pop, verbose) {
  return new Promise(function(resolve) {
    feature_collection.features.forEach(function(feat) {
      feat.geo_feature = {
        geometry: {
          type: feat.geometry.type,
          coordinates: feat.geometry.coordinates
        }
      };

      feat.properties.country_code = country_code;
      // CarrotJuice has been used with Sierra Leone and Brazil
      // Sierra Leone: DIST_NAME and CHIE-CODE
      // Brazil: NAME_2, ID_2
      feat.properties.name =
        feat.properties.DIST_NAME || feat.properties.NAME_2;
      feat.properties.admin_code = country_code + '-' +
        (feat.properties.CHIE_CODE || feat.properties.ID_2);

      // Assign population to admin
      feat.properties.population = admin_pop[feat.properties.admin_code];

      // geojson-area returns sq. meters.
      feat.properties.geo_area_sqkm =
        geojsonArea.geometry(feat.geo_feature.geometry) / Math.pow(1000, 2);
    });
    if (verbose) {console.log('features enriched');}
    resolve(feature_collection);
  });
}

/**
 * Convert geojson to topojson. Create dir and store. NOTE: this mutates
 * `feature_collection` (removes some redundant fields). TODO(jetpack): this is
 * silly: we add fields in `enrich_features`, copy them it `save_features`, then
 * remove them again here. Fix me.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} feature_collection - geojson.
 * @param{string} file - path and name of geojson file.
 * @param{bool} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_topojson(country_code, feature_collection, file, verbose) {
  var my_fc = JSON.parse(JSON.stringify(feature_collection));
  my_fc.features.forEach(function(f) {
    delete f.country_code;
    delete f.name;
    delete f.admin_code;
    delete f.geo_area_sqkm;
    delete f.geo_feature;
    delete f.population;
  });
  return new Promise(function(resolve, reject) {
    // root is directory where topojson will be stored.
    var root = file.split('/').find(function(e) {
      return e.match(/[a-z]/);
    });
    var storage_dir = './' + root + '/static-assets/';
    var path = storage_dir + country_code + '_topo.json';
    var c = topojson.topology(
      {collection: my_fc},
      {'property-transform': function(object) {
        return _.pick(
          object.properties,
          ['country_code', 'name', 'admin_code', 'geo_area_sqkm', 'population']
        );
      }});
    topojson.simplify(c, {
      'coordinate-system': 'spherical',
      'retain-proportion': 0.4
    });

    // Create dir to store topo.
    fs.mkdir(storage_dir, function() {
      // Write topo to file
      if (verbose) { console.log('Saving topojson to', path, '...'); }
      fs.writeFile(path, JSON.stringify(c), function(err) {
        if (err) {return reject(err);}
        resolve(feature_collection);
      });
    });
  });
}

/**
 * Iterate through features, assign values to attributes, and save. NOTE: this
 * mutates `feature_collection`.
 *
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_features(feature_collection) {
  var admins = [];

  feature_collection.features.forEach(function(feat) {
    feat.country_code = feat.properties.country_code;
    feat.name = feat.properties.name;
    feat.admin_code = feat.properties.admin_code;
    feat.geo_area_sqkm = feat.properties.geo_area_sqkm;
    feat.population = feat.properties.population;
    var admin = new Admin(feat);
    admins.push(admin);
  });

  return new Promise(function(resolve, reject) {
    Admin.insertMany(admins, function(err) {
      if (err) {return reject(err);}
      resolve(feature_collection);
    });
  });
}

/**
 * Get hash of admin to population
 * mutates `feature_collection`.
 *
 * @param{string} country_code - Country Code
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when csv is read.
 */
function world_pop(country_code, feature_collection) {
  var path = './data/population/';
  var file = 'worldpop_' + country_code + '.csv';
  var stream = fs.createReadStream(path + file);
  var admin_pop = {};
  return new Promise(function(resolve) {
    stream.on('error', function(err) {
      console.log('No population file. Moving along.', err);
      resolve([{}, feature_collection]);
    });

    var csvStream = csv()
    .on('data', function(data) {
      admin_pop[data[0]] = parseFloat(data[1]);
    })
    .on('end', function() {
      resolve([admin_pop, feature_collection]);
    });
    stream.pipe(csvStream);
  });
}

/**
 * Import admins from a geojson file and save as Admin documents.
 *
 * @param{string} file - name of geojson file.
 * @param{string} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function import_admins(file, verbose) {
  var country_code = file.split('/')[file.split('/').length - 2];
  return read_jsonfile(file, verbose)
  .then(function(feature_collection) {
    return world_pop(country_code, feature_collection);
  })
  .then(function(pop_feat_collection) {
    var pop_admin = pop_feat_collection[0];
    var feature_collection = pop_feat_collection[1];
    return enrich_features(
      country_code,
      feature_collection,
      pop_admin,
      verbose
    );
  })
  .then(function(feature_collection) {
    return save_features(feature_collection);
  })
  .then(function(feature_collection) {
    return save_topojson(country_code, feature_collection, file, verbose);
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
    ['-f', '--file'],
    {help: 'Name of file to be imported'}
  );

  parser.addArgument(
    ['--verbose'],
    {help: 'Print debug'}
  );

  var args = parser.parseArgs();

  var mongodb = config.database;
  mongoose.connect(mongodb, function(err) {
    if (err) { throw err; }

    import_admins(args.file, args.verbose)
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
