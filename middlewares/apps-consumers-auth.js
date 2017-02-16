import secrets from '../secrets'

export default function protect(req, res, next) {
  var token = req.query.token || null
  var apps = secrets.apps

  var app = apps.find(app => app.token === token)

  if (!app) {
    res.status(401).send({
      msg: 'A valid API token must be provided. Contact Unicef Innovation Office'
    })
  } else {
    req.clientApp = app
    next()
  }
}
