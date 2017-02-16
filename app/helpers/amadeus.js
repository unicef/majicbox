var async = require('async');
var config = require('../../config');
var csv = require('fast-csv');
var Mobility = require('../models/mobility');
var moment = require('moment');
var request = require('superagent');
var azure = require('../../lib/azure_storage');
var bluebird = require('bluebird');

// For magicbox-dashboard
exports.summary_amadeus = function() {
  return new Promise(function(resolve) {
    var url = config.amadeus_url + 'api/collections';
    request.get(url).then(response => {
      console.log(response);
      resolve(JSON.parse(response.text));
    });
  });
}

/**
 * For magicbox-dashboard, container: 'raw', 'aggregated'
 *
 * @param{string} container - Country.
 * @return{Promise} Nested mapping from date to admin code to population value.
 */
exports.summary_azure = function(container) {
  return new Promise(function(resolve) {
    azure.get_collection_names(container).then(function(list) {
      bluebird.reduce(list, function(h, col) {
        return azure.get_blob_names(container, col)
        .then(function(names) {
          h[col] = names.filter(e => {
            switch (col) {
              case 'midt':
              case 'schedule':
                return e.match(/(\d{4}-\d{2}-\d{2})(_to_)(\d{4}-\d{2}-\d{2})/);
              case 'traffic':
                return e.match(/(\d{4}_\d{2})/);
              default:
                return null;
            }
          });
          return h;
        });
      }, {}).then(function(h) {
        resolve(h);
      });
    });
  });
};

// For magicbox-dashboard Timechart AND for amadeus import
exports.get_amadeus_file_names_already_in_mongo = function() {
  return new Promise(function(resolve, reject) {
    Mobility.aggregate([
      {$group: {
        _id: {
          kind: "$kind",
          source_file: "$source_file"
        },
        total: {$sum: 1}
      }
    },

    {$group: {
      _id: "$_id.kind",
      files: {
        $push: "$_id.source_file"
      }
    }
    }
    ]).exec(function(err, source_files) {
      if (err) {return reject(err); }
      resolve(
        source_files.reduce(function(h, obj) {
          h[obj._id] = obj.files;
          return h;
        }, {})
      );
    });
  });
}

exports.save_queue = async.queue(function(task, callback) {
  task.catch(console.log).then(callback);
}, 1);
