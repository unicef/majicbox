/**
 * Connects to Azure blob
 */

var Q = require('q');
var lodash = require('lodash');
var azure = require('azure-storage');
var fs = require('fs');
var path = require('path');

var files_list = require('./files-list.js');

var blobSvc = azure.createBlobService();

var make_parent_directories = function (filename, cb) {
  fs.stat(filename, function (err, stats) {
    if (err || !stats.isDirectory()) {
      make_parent_directories(path.dirname(filename), function () {
        // ignore errors (irrelevant parallelism races)
        fs.mkdir(filename, cb);
      });
    } else {
      cb();
    }
  });
};

var download_from_azure = function (azure_name, filename) {
  var deferred = Q.defer();
  make_parent_directories(path.dirname(filename), function () {
    blobSvc.getBlobToLocalFile(
      'majicbox-data',
      azure_name,
      filename,
      function (error, result) {
        return error ? deferred.reject(error) : deferred.resolve(result);
      }
    );
  });
  return deferred.promise;
};

Q.all(lodash.map(files_list, function (item) {
  return download_from_azure(item.remote, item.local);
})).then(function () {
  console.log("succeeded");
}).catch(function (error) {
  console.error("One or more failed", error);
});
