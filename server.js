/**
 * @file Main entrypoint for the majicbox server: defines the API endpoints and starts
 * the Express server.
 *
 * @author Unicef Innovation Office - UNICEF
 */

import bodyParser from 'body-parser'
import compression from 'compression'
import express from 'express'
import mongoose from 'mongoose'
import morgan from 'morgan'

import config from './config'
import protect from './middlewares/apps-consumers-auth'
import handlers from './app/handlers'

const app = express()

app.use(compression())  // gzip
app.use(morgan('dev'))  // request logging

// Parse incoming request bodies in a middleware before your handlers, available under the req.body property.
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

// All of our routes will be prefixed with '/api'.
app.use('/api', protect, handlers)

console.log('Connecting to DB', config.database)
mongoose.connect(config.database)

app.listen(config.port, function() {
  console.log('Magic happens on: ', config.port)
})
