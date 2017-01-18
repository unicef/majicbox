// Main entrypoint for the majicbox server: defines the API endpoints and starts
// the Express server.

var _ = require('lodash');
var apicache = require('apicache').options({debug: false}).middleware;
var bodyParser = require('body-parser');
var compression = require('compression');
var express = require('express');
var mongoose = require('mongoose');
var morgan = require('morgan');

var AdminTopojson = require('./app/models/admin-topojson.js');
var config = require('./config');
var util = require('./util');
var http = require('http');

var app = express();

app.use(compression());  // gzip.
app.use(morgan('dev'));  // request logging.

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

/* eslint new-cap: [2, {"capIsNewExceptions": ["express.Router"]}] */
var router = express.Router(); // get an instance of the express Router

/**
 * Convert date string into either a valid Date or null.
 *
 * @param{string} date_string - Input string.
 * @return{Date} Returns date if input string is parseable as a Date. Otherwise,
 *   returns null.
 */
function date_param(date_string) {
  var unix_secs = Date.parse(date_string);
  return unix_secs ? new Date(unix_secs) : null;
}

// TODO(jetpack): It's inefficient to have a cache here for the time-based
// routes, as we'll be saving the same data multiple times (e.g. queries for the
// ranges [2016-01-01, 2016-12-31] and [2016-01-01, 2017-01-01] will return
// nearly identical data, but be stored separately. We should instead use a
// cache directly in the underlying functions.

router.route('/country_weather/:country_code/:time?')
  .get(apicache('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_country_weather(p.country_code, date_param(p.time))
      .then(res.json.bind(res))
      .catch(next);
  });

router.route(
  '/admin_weather/:admin_code/:start_time?/:end_time?')
  .get(apicache('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_admin_weather(p.admin_code, date_param(p.start_time),
                           date_param(p.end_time))
      .then(res.json.bind(res))
      .catch(next);
  });

router.route(
  '/admin_polygons_topojson/:country_code')
  .get(apicache('1 day'), function(req, res, next) {
    AdminTopojson.findOne({
      country_code: req.params.country_code,
      simplification: 0.4
    }).lean(true).exec(function(err, topojson_result) {
      return err ? next(err) : res.json(topojson_result.topojson);
    });
  });

router.route('/egress_mobility/:admin_code/:start_time?/:end_time?')
  .get(apicache('1 day'), function(req, res, next) {
    var p = req.params;
    // console.log(p.end_time, '!!!!!')
    // p.end_time = '2017-05-20'
    util.get_egress_mobility(p.admin_code, date_param(p.start_time),
                             date_param(p.end_time))
      .then(res.json.bind(res))
      .catch(next);
  });

router.route('/mobility_populations/:country_code/:start_time?/:end_time?')
  .get(apicache('1 day'), function(req, res, next) {
    var p = req.params;
    util.get_mobility_populations(p.country_code, date_param(p.start_time),
                                  date_param(p.end_time))
      .then(res.json.bind(res))
      .catch(next);
  });

// Magicbox Dashboard routes
  router.route('/travel_from_country_activity/:country_iso/:start_date/:end_date')
    .get(apicache('1 day'), function(req, res, next) {
      var p = req.params;
      util.travel_from_country_activity(
        p.country_iso,
        p.start_date,
        p.end_date
      ).then(res.json.bind(res)).catch(next);
    });

router.route('/summary_azure/:container')
  .get(apicache('1 day'), function(req, res, next) {
    util.summary_azure(req.params.container).then(res.json.bind(res)).catch(next);
  });

// List amadeus mobility in magicbox
router.route('/summary_magicbox')
  .get(apicache('1 day'), function(req, res, next) {
    util.get_amadeus_file_names_already_in_mongo().then(res.json.bind(res)).catch(next);
  });

// List of what's on amadeus sftp
router.route('/summary_amadeus')
  .get(apicache('1 hour'), function(req, res, next) {
    util.summary_amadeus().then(res.json.bind(res)).catch(next);
  });

// Summary of mobility in pax per date
// Used in magicbox dashboard calendar chart
router.route('/summary_mobility')
  .get(apicache('1 day'), function(req, res, next) {
    util.summary_mobility().then(res.json.bind(res)).catch(next);
  });

// All of our routes will be prefixed with '/api'.
app.use('/api', router);

console.log('Connecting to DB', config.database);
mongoose.connect(config.database);
app.listen(config.port, function() {
  console.log('Magic happens on', config.port);

  // run some warming
  var warm = function(d) {
    return http.get(_.assign({hostname: 'localhost', port: config.port}, d));
  };
  // _.forEach(['arg', 'usa', 'deu', 'pse', 'bra', 'col', 'pan'], function(country_code) {
  _.forEach(['col'], function(country_code) {
    warm({path: '/api/admin_polygons_topojson/' + country_code});
    warm({path: '/api/country_weather/' + country_code});
  });
});
