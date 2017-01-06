var azure = require('../azure_storage');
var config = require('../../config');
var async = require('async');
var bluebird = require('bluebird');
var util = require('../../util');
var Mobility = require('../../app/models/mobility');
var moment = require('moment');
var csv = require('fast-csv');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/majicbox');
var db = mongoose.connection;

var save_queue = async.queue(function(task, callback) {
  task.catch(console.log).then(callback);
}, 1);

function form_mobility(collection, obj) {
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
  mobility.origin_country_code = obj.origin_iso;
  mobility.destination_country_code = obj.dest_iso;
  mobility.origin_admin_code = obj.origin_id;
  mobility.destination_admin_code = obj.dest_id;
  mobility.count = obj.pax;

  return new Mobility(mobility);
}

function mongo_import_group(group) {
  return new Promise(function(resolve, reject) {
    Mobility.insertMany(group)
    .catch(reject)
    .then(resolve);
    resolve();
  });
}

var queue = async.queue(function(obj, callback) {
  var blob_name = obj.blob_name;
  var collection = obj.collection;

  async.waterfall([
    function(callback) {
      azure.dl_blob(collection, blob_name).then(callback);
    },

    function(callback1) {
      var csv_file = config.amadeus_dir + blob_name;
      var group = [];
      var count = 0;

      csv.fromPath(csv_file, {headers: true})
      .on('data', function(data) {
        count++;
        group.push(form_mobility(collection, data));
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
          util.remove_file(config.amadeus_dir, blob_name)
          .catch(console.log)
          .then(callback1);
        }
      });
    }

  ], function() {
    callback();
  });
}, 1);

function main() {
  async.waterfall([
    function(callback) {
      // Retrieves list of blobs in a collection: 'booking', 'search', 'schedule'..etc.
      azure.get_collection_names()
      .catch(console.log)
      .then(function(collections) {
        collections = collections.filter(function(e) { return e.match(/midt/);});
        callback(null, collections);
      });
    },

    function(collections, callback) {
      bluebird.map(collections, function(collection) {
        return import_collection(collection);
      }, {concurrency: 1})
      .catch(console.log)
      .then(function() {
        console.log('All collections done!');
        callback();
      });
    }
  ], function(err) {
    if (err) {
      console.log(err);
    }
    console.log('Exiting!');
    process.exit();
  });
}
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  main();
});

function import_collection(collection) {
  return new Promise(function(resolve) {
    if (!collection.match(/(traffic|midt)/)) {
      console.log('Avoiding', collection);
      resolve();
    }
    azure.get_blob_names('aggregated', collection)
    .catch(console.log)
    .then(function(list) {
      // Just get traffic for now
      list.slice(1).forEach(function(blob) {
        console.log('Adding to queue', blob);
        queue.push({
          collection: collection,
          blob_name: blob
        }, function() {
          console.log('Done with', blob);
        });
      });

      queue.drain = function() {
        console.log('Nothing left');
        resolve();
      };
    });
  });
}
