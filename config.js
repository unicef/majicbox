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
  auth0: {
  	secret: 'jz1wGYIzQJwTRWRR9-tPttiqNZbX7VkcIxalY-4_HamlvvnjHLfjBa6Zy5YWVsKO',
  	audience: 'PavIFuMrRD8Fj188ImGfORCE9nHC1qhz',
  	domain: 'qusai.auth0.com'
  },
  mbSecret: {
    token: 'a153870047a88169fb2e3bd11a81c6a2c53b6502'
  },
  apps: [
      { self: 'magixbox', token: 'a153870047a88169fb2e3bd11a81c6a2c53b6502'},
    	{ name: 'dashboard', token: '1a3ff0c67aad5407b5ea60e1148dfab875d3cea7' }
  ]
};
