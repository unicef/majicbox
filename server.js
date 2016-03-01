// Main entrypoint for the majicbox server: defines the API endpoints and starts
// the Express server.

var apicache = require('apicache').options({debug: true}).middleware;
var bodyParser = require('body-parser');
var compression = require('compression');
var express = require('express');
var mongoose = require('mongoose');
var morgan = require('morgan');

var config = require('./config');
var util = require('./util');

var app = express();

app.use(compression());  // gzip.
app.use(morgan('dev'));  // request logging.

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

/* eslint new-cap: [2, {"capIsNewExceptions": ["express.Router"]}] */
var router = express.Router(); // get an instance of the express Router

router.route('/regions/:country_code')
  .get(apicache('1 day'), function(req, res, next) {
    util.get_regions(req.params.country_code)
      .then(res.json.bind(res))
      .catch(next);
  });

router.route('/mobility/:country_code/:region_code/:start_time?/:end_time?')
  .get(apicache('1 day'), function(req, res, next) {
    util.get_egress_mobility(req.params.country_code, req.params.region_code,
                             req.params.start_time, req.params.end_time)
      .then(res.json.bind(res))
      .catch(next);
  });

// TODO(jetpack): It's inefficient to have a cache here for the time-based
// /mobility_populations/ and /mobility/ routes, as we'll be saving the same
// data multiple times (e.g. queries for the ranges [2016-01-01, 2016-12-31] and
// [2016-01-01, 2017-01-01] will return nearly identical data, but be stored
// separately. We should instead use a cache directly in the underlying
// functions.

router.route('/mobility_populations/:country_code/:start_time?/:end_time?')
  .get(apicache('1 day'), function(req, res, next) {
    util.get_mobility_populations(req.params.country_code,
                                  req.params.start_time, req.params.end_time)
      .then(res.json.bind(res))
      .catch(next);
  });

// All of our routes will be prefixed with '/api'.
app.use('/api', router);

mongoose.connect(config.database);
app.listen(config.port);
console.log('Connecting to DB', config.database);
console.log('Magic happens on', config.port);
