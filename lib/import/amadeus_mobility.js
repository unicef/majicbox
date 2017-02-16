// This downloads aggregated amadeus mobility from cloud and imports to mongo.
var azure = require('../azure_storage');

var async = require('async');
var bluebird = require('bluebird');
var util = require('../../util');
var helper = require('../../app/helpers/amadeus');
var cvsHelper = require('../../app/helpers/csv-helper');

var amadeus_dir = require('./storage').amadeus_dir;
var collections_to_import = require('../../storage').collections_to_import;
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/majicbox');

import_amadeus()
.then(function() {
  process.exit();
});
/**
 * Main
 * Iterate through blobs of aggregated mobility on azure
 * Import any new files to mongo
 * @return{Promise}.
 */
function import_amadeus() {
  return new Promise(function(resolve, reject) {
    console.log('import_amadeus');
    return async.waterfall([
      function(callback) {
        console.log('Download list of collections');
        // Download list of blobs from storage account in azure where aggregated mobility exists
        // Containers in storage account include: 'midt', 'traffic', 'search', 'schedule'..etc.
        azure.get_collection_names('aggregated')
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

      // Get list of amadeus files already in Mongo so you don't import again.
      function(collections, callback) {
        console.log('Get list of amadeus files already in Mongo');
        util.get_amadeus_file_names_already_in_mongo()
        .catch(console.log).then(function(files_in_mongo) {
          console.log('Original file names in mongo fetched.');
          callback(null, collections, files_in_mongo);
        });
      },

      function(collections, files_in_mongo, callback) {
        console.log('Prepare to process collections of blobs one by one');
        // Process collections of blobs one by one
        bluebird.map(collections, function(collection) {
          console.log('About to import', collection);
          return import_collection(collection, files_in_mongo);
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

var queue = async.queue(function(obj, callback1) {
  var blob_name = obj.blob_name;
  var collection = obj.collection;
  console.log(blob_name, 'now in queue');
  async.waterfall([
    function(callback) {
      console.log('About to download', blob_name);
      azure.dl_blob(collection, blob_name)
      .catch(console.log)
      .then(function() {
        console.log('Back from downloading');
        callback(null);
      });
    },

    function(callback) {
      var data_dir = amadeus_dir;
      var csv_path = data_dir;

      cvsHelper.import_csv_mongo(helper.save_queue, csv_path, collection, blob_name)
      .then(callback)
      .catch(console.log);
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
 * @return{Promise}.
 */
function import_collection(collection, source_files) {
  console.log('Import', collection, 'now');
  return new Promise(function(resolve) {
    if (!collection.match(/(traffic|midt)/)) {
      console.log('Avoiding', collection);
      resolve();
    }

    azure.get_blob_names('aggregated', collection)
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
          blob_name: blob
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
