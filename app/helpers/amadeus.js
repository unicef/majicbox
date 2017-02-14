var async = require('async');
var config = require('../config');
var csv = require('fast-csv');
var Mobility = require('../models/mobility');
var moment = require('moment');
var request = require('superagent');

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

exports.import_csv_mongo = function(save_queue, csv_path, collection, blob_name) {
  var count = 0;
  var group = [];
  var csv_file = csv_path + blob_name;
  return new Promise(resolve => {
    csv.fromPath(csv_file, {headers: true})
    .on('data', function(data) {
      count++;
      group.push(
        form_mobility(collection, data, blob_name)
      );
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
        resolve();
      }
    });
  });
};

/**
 * Import a group of Mobility objects
 * @param{array} group: an array of mobility objects
 * @return{Promise}.
 */
function mongo_import_group(group) {
  return new Promise(function(resolve, reject) {
    Mobility.insertMany(group).then(function() {
      return resolve();
    }).catch(function(err) {
      return reject(err);
    });
  });
}

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
