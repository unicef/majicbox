var azure = require('azure-storage');
var config = require('../config');
var storage_account = config.azure.aggregated.account;
var azure_key = config.azure.aggregated.key;
var blobSvc = azure.createBlobService(storage_account, azure_key);
var fs = require('fs');

/**
 * Retrieves list of blobs in a collection:
 * 'booking', 'search', 'schedule'..etc.
 * @return{Promise} Fulfilled with array of blob names
 */

exports.get_collection_names = function(storage, test) {
  return new Promise(function(resolve, reject) {
    // In case called by mocha testing, return fixed array.
    if (test) {
      return resolve(['traffic']);
    }

    var storage_account = config.azure[storage].account;
    var azure_key = config.azure[storage].key;
    var blobSvc = azure.createBlobService(storage_account, azure_key);
    blobSvc.listContainersSegmented(null, function(err, result) {
      console.log(err, result);
      if (!err) {
        resolve(result.entries.map(entry => entry.name));
      } else {
        return reject(err);
      }
    });
  });
};

exports.dl_blob = function(collection, blob_name, testing) {
  return new Promise(function(resolve, reject) {
    if (testing) {
      console.log('Just testing, do not download');
      return resolve(blob_name);
    }
    blobSvc.getBlobToStream(
      collection, blob_name,
      fs.createWriteStream(config.amadeus_dir + blob_name),
      function(error, result) {
        if (error) {
          return reject(error);
        }
        resolve(result);
        // blob retrieved
      });
  });
};

exports.get_blob_names = function(container, col, testing) {
  return new Promise(function(resolve, reject) {
    if (testing) {
      // This is a temporary file with 9 lines of fake data used for running a mocha test
      // (There was no plane travel in September, 1284)
      return resolve(['traffic_W_1284_09.csv']);
    }

    var storage_account = config.azure[container].account;
    var azure_key = config.azure[container].key;
    var blobSvc = azure.createBlobService(storage_account, azure_key);
    // Fetch names in pre-aggregated container
    blobSvc.listBlobsSegmented(col, null, function(err, result) {
      if (err) {
        return reject(err);
      } else {
        // Fetch names in aggregated container
        var names = result.entries.map(entry => entry.name);
        // blobSvcTo.listBlobsSegmented(col, null, function(err, result, response) {
        //   if (err) {
        //     return reject(err);
        //   } else {
        //     var names_to = result.entries.map(entry => entry.name);
        //     var new_blobs = names.filter(function(e) {
        //       return names_to.indexOf(e.replace(/.gz$/, '')) === -1;
        //     });
        //     resolve(new_blobs);
        //   }
        // });
        resolve(names);
      }
    });
  });
};
