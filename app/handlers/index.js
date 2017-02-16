/**
 * @file API route handlers aggregated in one route
 */

import express from 'express'
import weather from './weather'
import mobility from './mobility'
import admins from './admins'
import summeries from './summeries'

export default express.Router()
  .use(weather)
  .use(mobility)
  .use(admins)
  .use(summeries)
