# Setup for developers

## The Database

This application uses Mongodb for its database. You will need to have it
installed to use it. Check out the Mongodb installation information at:

    http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/


## Installation

- `git clone git@github.com:mikefab/majicbox.git`
- `cd majicbox`
- `npm install`
- `cp -r data-sample data`
- `node lib/import/region.js -f './data/geojson/br/admin2.json' -c 'br' --verbose true`
- `NODE_ENV=development nodemon server.js 8000`
- browse to http://localhost:8000/api


## Workflow and guidelines

* Non-trivial tasks should be tracked in **Github issues**.
* Non-trivial development should happen on **Git feature branches** and get code
  review before being merged into the main *zika* branch.
* Commits that add new functionality should have [tests](https://mochajs.org).
* Functions should have [JSDoc](http://usejsdoc.org/about-getting-started.html)
  comments.
* Follow the
  [Google style guide](https://google.github.io/styleguide/javascriptguide.xml)
  for the most part (see `.eslintrc` for our deviations). Code should completely
  pass `eslint` (see **Linting** section below).

Before submitting any code, one should run:

* `mocha` to ensure all tests pass.
* `make lint` for style guide and other checks.

## Linting

Code should ideally pass `eslint`. We use the Google style guide as a base
configuration with some slight modifications. The `.eslintrc` is committed to
the repo, so whenever you run `make lint`, the config should take effect.

## nodemon

`nodemon` is like `node`, but automatically reloads code when the code is
updated.

```sh
npm install -g nodemon
NODE_ENV=development nodemon server.js 8002
```
