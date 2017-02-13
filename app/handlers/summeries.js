import express from 'express'
import apicache from 'apicache'
import util from '../../util'

const cacheIt = apicache.options({ debug: false }).middleware
const router = express.Router()

router.route('/summary_azure/:container')
  .get(cacheIt('1 day'), function(req, res, next) {
    helper.summary_azure(req.params.container).then(res.json.bind(res)).catch(next);
  });

// List amadeus mobility in magicbox
router.route('/summary_magicbox')
  .get(cacheIt('1 day'), function(req, res, next) {
    util.get_amadeus_file_names_already_in_mongo().then(res.json.bind(res)).catch(next);
  });

// List of what's on amadeus sftp
router.route('/summary_amadeus')
  .get(cacheIt('1 hour'), function(req, res, next) {
    util.summary_amadeus().then(res.json.bind(res)).catch(next);
  });

// Summary of mobility in pax per date
// Used in magicbox dashboard calendar chart
router.route('/summary_mobility')
  .get(cacheIt('1 day'), function(req, res, next) {
    util.summary_mobility().then(res.json.bind(res)).catch(next);
  });

export default router
