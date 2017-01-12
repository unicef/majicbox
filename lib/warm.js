var http = require('http');
var config = require('../config');
var _ = require('lodash');

// run some warming
var warm = function(d) {
  return http.get(_.assign({
    hostname: 'localhost',
    port: config.port
  }, d))
};

_.forEach(['br'], function(country_code) {
  warm({ path: '/api/admin_polygons_topojson/' + country_code });
  warm({ path: '/api/country_weather/' + country_code });
});
