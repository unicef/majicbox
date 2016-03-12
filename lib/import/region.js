var ArgumentParser = require('argparse').ArgumentParser;
var geojsonArea = require('geojson-area');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var fs = require('fs');
var topojson = require('topojson');

var config = require('../../config');
var Region = require('../../app/models/region');

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
 * @param{bool} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function enrich_features(country_code, feature_collection, verbose) {
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
      feat.properties.name = feat.properties.DIST_NAME ||
                             feat.properties.NAME_2;
      feat.properties.region_code = feat.properties.CHIE_CODE ||
                            feat.properties.ID_2;

      feat.properties.geo_area_sqkm = geojsonArea.geometry(
                                        feat.geo_feature.geometry
                                    ) / Math.pow(1000, 2);
    });
    if (verbose) {console.log('features enriched');}
    resolve(feature_collection);
  });
}

/**
 * Convert geojson to topojson. Create dir and store.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} feature_collection - geojson.
 * @param{string} file - path and name of geojson file.
 * @param{bool} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_topojson(country_code, feature_collection, file) {
  feature_collection.features.forEach(function(e) {
    delete e.geo_feature;
  });
  return new Promise(function(resolve, reject) {
    // root is directory where topojson will be stored.
    var root = file.split('/').find(function(e) {
      return e.match(/[a-z]/);
    });
    var storage_dir = './' + root + '/static-assets/';
    var path = storage_dir + country_code + '_topo.json';
    var f_c = JSON.parse(JSON.stringify(feature_collection));
    var c = topojson.topology({collection: f_c},
            {'property-transform': function(object) {
              return object.properties;
            }});
    // Create dir to store topo.
    fs.mkdir(storage_dir, function() {
      // Write topo to file
      fs.writeFile(path, JSON.stringify(c), function(err) {
        if (err) {return reject(err);}
        resolve(feature_collection);
      });
    });
  });
}

/**
 * Iterate through features, assign values to attributes, and save
 *
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_features(feature_collection) {
  var regions = [];

  feature_collection.features.forEach(function(feat) {
    feat.country_code = feat.properties.country_code;
    // CarrotJuice has been used with Sierra Leone and Brazil
    // Sierra Leone: DIST_NAME and CHIE-CODE
    // Brazil: NAME_2, ID_2
    feat.name = feat.properties.name;
    feat.region_code = feat.properties.region_code;
    feat.geo_area_sqkm = feat.properties.geo_area_sqkm;
    var region = new Region(feat);
    regions.push(region);
  });

  // return Promise.all(all_done);
  return new Promise(function(resolve) {
    Region.insertMany(regions, function() {
      resolve(feature_collection);
    });
  });
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
  return read_jsonfile(file, verbose)
  .then(function(feature_collection) {
    return enrich_features(country_code, feature_collection, verbose);
  })
  .then(function(feature_collection) {
    return save_features(feature_collection);
  })
  .then(function(feature_collection) {
    return save_topojson(
      country_code,
      feature_collection,
      file,
      verbose
    );
  });
}

/** Main function for when this module is called directly as a script. */
function main() {
  var parser = new ArgumentParser({
    version: '0.0.1',
    addHelp: true,
    description: 'Import admin region docus into database from a geojson file.'
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
    }).catch(function(err) { console.log(err); process.exit();});
  });
}

if (require.main === module) {
  main();
} else {
  exports.import_regions = import_regions;
}