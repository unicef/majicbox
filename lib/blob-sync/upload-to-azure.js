/**
 * Connects to Azure blob
 */

var _ = require('lodash');
var Q = require('q');
var azure = require('azure-storage');
var blobSvc = azure.createBlobService();
var files_list = require('./files-list.js');

var upload_to_azure = function (azure_name, filename) {
    var deferred = Q.defer();
    blobSvc.createBlockBlobFromLocalFile(
        'majicbox-data', azure_name, filename, function (error, result, response) {
            return error ? deferred.reject(error) : deferred.resolve(result);
    });
    return deferred.promise;
};

Q.all(_.map(files_list, function(item) {
    return upload_to_azure(item.remote, item.local);
})).then(function() {
    console.log("succeeded");
}).catch(function (error) {
    console.error("One or more failed", error);
});
