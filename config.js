// Note: this file is in .gitignore.

var process_env_or = function(name, default_value) {
  var process_env = process.env[name];
  return Boolean(process_env) ? process_env : default_value;
};

module.exports = {
  'database':'mongodb://localhost/majicbox',
  'testdb': process_env_or('TEST_DB', 'mongodb://localhost/test')
};
