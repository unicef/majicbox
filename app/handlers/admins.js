import express from 'express'
import apicache from 'apicache'
import AdminTopojson from '../models/admin-topojson.js'

const cacheIt = apicache.options({ debug: false }).middleware
const router = express.Router()

router.route('/admin_polygons_topojson/:country_code')
  .get(cacheIt('1 day'), function(req, res, next) {
    AdminTopojson.findOne({
      country_code: req.params.country_code,
      simplification: 0.4
    }).lean(true).exec(function(err, topojson_result) {
      return err ? next(err) : res.json(topojson_result.topojson);
    });
  });

export default router
