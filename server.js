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

/** Wrapper for get_region_populations.
 * @param{object} req - Express request object.
 * @param{object} res - Express ressponse object.
 * @param{object} next - Express next callback.
 * @return{Promise} Fulfilled when done.
 */
function handle_region_populations(req, res, next) {
  return util.get_region_populations(req.params.country_code,
                                     req.params.start_time, req.params.end_time)
    .then(res.json.bind(res))
    .catch(next);
}

// TODO(jetpack): Rename endpoint to just `populations`?
//
// TODO(jetpack): This can be a single route w/ optional params:
// http://expressjs.com/en/api.html
//
// TODO(jetpack): It's redundant to have a cache for each of these (especially
// the time-based endpoints). We should instead wrap util.get_region_populations
// directly.
router.route('/region_populations/:country_code')
  .get(apicache('1 day'), handle_region_populations);
router.route('/region_populations/:country_code/:start_time')
  .get(apicache('1 day'), handle_region_populations);
router.route('/region_populations/:country_code/:start_time/:end_time')
  .get(apicache('1 day'), handle_region_populations);

// All of our routes will be prefixed with '/api'.
app.use('/api', router);

mongoose.connect(config.database);
app.listen(config.port);
console.log('Connecting to DB', config.database);
console.log('Magic happens on', config.port);
