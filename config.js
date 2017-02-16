// Note: this file is in .gitignore.

var _ = require('lodash');

var process_env_or = function(names, default_value) {
  if (names instanceof Array) {
    var env_var = _.find(names, function(name) { return process.env[name]; });
    return process.env[env_var] || default_value;
  }
  return process.env[names] || default_value;
};

module.exports = {
  port: process_env_or('PORT', 8000),
  database: process_env_or(['PROD_DB', 'MONGOHQ_URL'],
                           'mongodb://localhost/majicbox'),
  testdb: process_env_or('TEST_DB', 'mongodb://localhost/test'),
}
