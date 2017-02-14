// node lib/import/admin.js -c bra -a 2 -s gadm2-8
// node lib/import/admin.js -c pan -a 2 -s gadm2-8
// node lib/import/admin.js -c arg -a 2 -s gadm2-8
// node lib/import/admin.js -c col -a 2 -s santiblanko
var ArgumentParser = require('argparse').ArgumentParser;
var geojsonArea = require('geojson-area');
var jsonfile = require('jsonfile');
var mongoose = require('mongoose');
var topojson = require('topojson');
var _ = require('lodash');

var Admin = require('../../app/models/admin');
var AdminTopojson = require('../../app/models/admin-topojson.js');
var db = require('../../database');

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

function create_admin_id(props, shapefile_source) {
  var iso = props.ISO;
  // These are admin codes.
  var id_0 = props.ID_0;
  var id_1 = props.ID_1;
  var id_2 = props.ID_2;

  if (shapefile_source.match('santiblanko')) {
    iso = 'col';
    id_0 = '0';
    id_1 = props.DPTO;
    id_2 = props.WCOLGEN02_;
  }

  var admin_id = iso.toLowerCase();
  [id_0, id_1, id_2].forEach(function(e) {
    if (e) {
      admin_id = admin_id + '_' + e;
    }
  });
  admin_id = admin_id + '_' + shapefile_source;
  return admin_id;
}

/**
 * Iterate through features, calculating derived properites. Mutates
 * `feature_collection`.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} shapefile_source - gadm2-8, for instance
 * @param{array} feature_collection - Feature collection
 */
function enrich_features(country_code, shapefile_source, feature_collection) {
  feature_collection.features.forEach(function(feat) {
    feat.properties.country_code = country_code;
    // CarrotJuice has been used with Sierra Leone and Brazil
    // Sierra Leone: DIST_NAME and CHIE-CODE
    // Brazil: NAME_2, ID_2

    feat.properties.name =
    feat.properties.DIST_NAME || feat.properties.NAME_2 || feat.properties.NOMBRE_MPI;
    feat.properties.admin_code = create_admin_id(feat.properties, shapefile_source);
    feat.properties.pub_src = shapefile_source;
    // geojson-area returns sq. meters.
    feat.properties.geo_area_sqkm =
      geojsonArea.geometry(feat.geometry) / Math.pow(1000, 2);
  });
}

/**
 * Convert geojson to topojson, saving results in Mongo.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{string} shapefile_source - gadm2-8, for instance
 * @param{string} feature_collection - geojson.
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_topojson(country_code, shapefile_source, feature_collection) {
  return new Promise(function(resolve, reject) {
    // root is directory where topojson will be stored.
    var c = topojson.topology(
      {collection: feature_collection},
      {
        'property-transform': function(object) {
          return _.pick(
            object.properties,
            ['country_code', 'name', 'admin_code', 'geo_area_sqkm', 'pub_src']
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
 * @param{string} shapefile_source - gadm2-8, for instance
 * @param{array} feature_collection - Feature collection
 * @return{Promise} Fulfilled when documents are saved.
 */
function save_admins(country_code, shapefile_source, feature_collection) {
  var admins = _.map(feature_collection.features, function(feat) {
    return new Admin({
      country_code: feat.properties.country_code,
      admin_code: feat.properties.admin_code,
      name: feat.properties.name,
      pub_src: shapefile_source,
      geo_area_sqkm: feat.properties.geo_area_sqkm
    });
  });

  return new Promise(function(resolve, reject) {
    // Clear out old admins
    Admin.find({country_code: country_code}).remove(function(err) {
      if (err) {
        return reject(err);
      }
      Admin.insertMany(admins, function(err) {
        if (err) {return reject(err);}
        resolve(feature_collection);
      });
    });
  });
}

/**
 * Import admins from a geojson file and save as Admin documents.
 *
 * @param{string} country_code - 3166-1 alpha-2 country code.
 * @param{json} geojson - polygon
 * @param{string} shapefile_source - gadm2-8, for instance
 * @param{string} verbose - Option to display debug
 * @return{Promise} Fulfilled when documents are saved.
 */
function import_admins(country_code, geojson, shapefile_source, verbose) {
  return read_jsonfile(geojson, verbose)
  .then(function(feature_collection) {
    enrich_features(country_code, shapefile_source, feature_collection);
    return Promise.all([
      save_admins(country_code, shapefile_source, feature_collection),
      save_topojson(country_code, shapefile_source, feature_collection)
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
    ['-a', '--admin_level'],
    {help: 'Admin level 0 through 2'}
  );

  parser.addArgument(
    ['-s', '--source'],
    {help: 'Shapefile source: gadm2-8 or santiblanko'}
  );

  parser.addArgument(
    ['-c', '--country_code'],
    {help: 'ISO 3166 alpha-2 two letter code for the country.'}
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
    'data/geojson/' +
    args.source +
    '/' + args.country_code +
    '/' + args.country_code.toUpperCase() +
    '_' + args.admin_level + '.json';
  mongoose.connect(db.database, function(err) {
    if (err) { throw err; }
    import_admins(args.country_code, geojson, args.source)
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
