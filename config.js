// Note: this file is in .gitignore.

var process_env_or = function(name, default_value) {
  return process.env[name] || default_value;
};

module.exports = {
  db_dev: process_env_or('TEST_DB', 'mongodb://localhost/majicbox'),
  db_test: process_env_or('TEST_DB', 'mongodb://localhost/test')
};
