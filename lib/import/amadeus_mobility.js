var azure = require('../azure_storage');
var config = require('../../config');
var async = require('async');
var bluebird = require('bluebird');
var util = require('../../util');
var Mobility = require('../../app/models/mobility');
var moment = require('moment');
var csv = require('fast-csv');
var collections_to_import = config.collections_to_import;
var mongoose = require('mongoose');
var path_test_data = './test/data/amadeus_mobility/';
mongoose.connect('mongodb://localhost/majicbox');
var db = mongoose.connection;

var save_queue = async.queue(function(task, callback) {
  task.catch(console.log).then(callback);
}, 1);

/**
 * Create a mobility object
 * @param{string} collection: -midt, traffic, search, or schedule
 * @param{object} obj:  An object about to be made into an instance of a mobility
 * @param{string} blob_name: unicef_WB_2014-07-24_to_2014-07-30.csv, for instance
 * @return{Mobility}.
 */
function form_mobility(collection, obj, blob_name) {
  var mobility = {};
  if (obj.year) {
    // obj.year is simply a year: 2016
    var year_date = moment(obj.year + '-01-01');
    mobility.date = new Date(
      moment(year_date).add(obj.week, 'weeks').format("YYYY-MM-DD")
    ).toISOString();
    mobility.date_to = new Date(
      moment(mobility.date).add(7, 'days').format("YYYY-MM-DD")
    ).toISOString();
  } else {
    mobility.date = new Date(obj.date).toISOString();
    mobility.date_to = moment(new Date(obj.date).toISOString()).add(7, 'days').format("YYYY-MM-DD");
  }

  mobility.kind = collection;
  mobility.provider = 'amadeus';
  mobility.duration = 7;
  mobility.source_file = blob_name;
  mobility.origin_country_code = obj.origin_iso;
  mobility.destination_country_code = obj.dest_iso;
  mobility.origin_admin_code = obj.origin_id;
  mobility.destination_admin_code = obj.dest_id;
  mobility.count = obj.pax;

  return new Mobility(mobility);
}

/**
 * Import a group of Mobility objects
 * @param{array} group: an array of mobility objects
 * @return{Promise}.
 */
function mongo_import_group(group) {
  return new Promise(function(resolve, reject) {
    Mobility.insertMany(group).then(function(response) {
      return resolve();
    }).catch(function(err) {
      return reject(err);
    })
  });
}

var queue = async.queue(function(obj, callback1) {
  var blob_name = obj.blob_name;
  var collection = obj.collection;
  var testing = obj.test;
  console.log(blob_name, 'now in queue');
  async.waterfall([
    function(callback) {
      console.log('About to download', blob_name);
      azure.dl_blob(collection, blob_name, testing)
      .catch(console.log)
      .then(function() {
        console.log('Back from downloading');
        callback(null);
      });
    },

    function(callback) {
      var data_dir = testing ? path_test_data + collection + '/' : config.amadeus_dir;
      var csv_file = data_dir + blob_name;
      var group = [];
      var count = 0;
      csv.fromPath(csv_file, {headers: true})
      .on('data', function(data) {
        count++;
        group.push(form_mobility(collection, data, blob_name));
        if (group.length === 10000) {
          console.log(count);
          save_queue.push(
            mongo_import_group(group)
          );
          group = [];
        }
      }).on('end', function() {
        if (group.length > 0) {
          console.log(count, 'last!');
          save_queue.push(
            mongo_import_group(group)
          );
          group = [];
          // TODO Edit test to create file in alternate dir
          // so later can test removal of file
          if (!obj.test) {
            util.remove_file(config.amadeus_dir, blob_name)
            .catch(console.log)
            .then(callback);
          } else {
            callback();
          }
        }
      });
    }

  ], function() {
    console.log('Queue drained');
    callback1();
  });
}, 1);

/**
 * import_collection
 * @param{string} collection: -midt, traffic, search, or schedule
 * @param{array} source_files:  Array of amadeus that have already been imported to mongo
 * @param{number} testing:  Indicates this is run as a test
 * @return{Promise}.
 */
function import_collection(collection, source_files, testing) {
  console.log('Import', collection, 'now');
  return new Promise(function(resolve) {
    if (!collection.match(/(traffic|midt)/)) {
      console.log('Avoiding', collection);
      resolve();
    }

    azure.get_blob_names('aggregated', collection, testing)
    .catch(console.log)
    .then(function(list) {
      // Original files are the csv's provided by amadeus
      var original_files = source_files[collection] ? source_files[collection] : [];
      var needed_files = list.filter(function(file) {
        return original_files.indexOf(file) === -1;
      });

      console.log('Needed files in collection', collection, needed_files);
      // Just get traffic for now
      needed_files.forEach(function(blob) {
        console.log('Adding to queue', blob);
        queue.push({
          collection: collection,
          blob_name: blob,
          test: testing
        }, function() {
          console.log('Done with', blob);
        });
      });

      if (needed_files.length === 0) {
        console.log('Nothing to fetch in', collection);
        resolve();
      }
      queue.drain = function() {
        console.log('Nothing left');
        resolve();
      };
    });
  });
}

/**
 * Main
 * Iterate through blobs of aggregated mobility on azure
 * Import any new files to mongo
 * @return{Mobility}.
 */
function import_amadeus(testing) {
  return new Promise(function(resolve, reject) {
    console.log('import_amadeus');
    return async.waterfall([
      function(callback) {
        console.log('Download list of collections');
        // Download list of blobs from storage account in azure where aggregated mobility exists
        // Containers in storage account include: 'midt', 'traffic', 'search', 'schedule'..etc.
        azure.get_collection_names('aggregated', testing)
        .catch(console.log)
        .then(function(collections) {
          console.log('Collection names fetched');
          // Only process collections specified in config
          collections = collections.filter(function(e) {
            return collections_to_import.indexOf(e) !== -1;
          });
          callback(null, collections);
        });
      },

      function(collections, callback) {
        console.log('Get list of amadeus files already in Mongo');
        // Get list of amadeus files already in Mongo so you don't import again.
        util.get_amadeus_file_names_already_in_mongo()
        .catch(console.log).then(function(source_files) {
          console.log('Original file names in mongo fetched.');
          callback(null, collections, source_files);
        });
      },

      function(collections, source_files, callback) {
        console.log('Prepare to process collections of blobs one by one');
        // Process collections of blobs one by one
        bluebird.map(collections, function(collection) {
          console.log('About to import', collection);
          return import_collection(collection, source_files, testing);
        }, {concurrency: 1})
        .catch(console.log)
        .then(function() {
          console.log('All collections done!');
          callback();
        });
      }
    ], function(err) {
      if (err) {
        return reject(err);
      }
      return resolve();
    });
  });
}

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  if (require.main === module) {
    import_amadeus()
    .then(function() {
      process.exit();
    })
    .catch(console.log);
  } else {
    exports.import_amadeus = import_amadeus;
  }
});
