# Setup for developers

## The Database

This application uses Mongodb for its database. You will need to have it installed to use it. Check out the Mongodb installation information at:

    http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/

## Installation
- git clone git@github.com:mikefab/majicbox.git
- cd majicbox
- npm install
- cp -r config-sample.js config.js
- NODE_ENV=development nodemon server.js 8000
- browse to localhost:8000/api


## Workflow and guidelines

* Non-trivial tasks should be tracked in **Github issues**.
* Non-trivial development should happen on **Git feature branches** and get code
  review before being merged into the main *zika* branch.
  * Commits that add new functionality should include
  [tests](https://mochajs.org).
* Functions should have [JSDoc](http://usejsdoc.org/about-getting-started.html)
  comments.
* Follow the
  [Google style guide](https://google.github.io/styleguide/javascriptguide.xml)
  for the most part (notable exception: we allow non-camelcase names). Code
  should mostly pass `eslint` (see Linting section below).

Before submitting any code, one should run:

* `mocha` to ensure all tests pass.
* `eslint <changed_js_files>` for style guide and other checks.

## Linting

Code should ideally pass `eslint`. We use the Google style guide as a base
configuration, with some slight modifications. The `.eslintrc` is committed to
the repo, so whenever you run `eslint`, the config should take effect.

```sh
# Included as dev dependencies in package.json, so "npm install" should have
# installed these already.
npm install jshint eslint eslint-config-google
```

## nodemon

`nodemon` is like `node`, but automatically reloads code when the code is
updated.

```sh
npm install -g nodemon
NODE_ENV=development nodemon server.js 8002
```

```sh
# Issue a query to the server (from another shell)
curl -s http://localhost:8002/api/matrix/cell/br/br393  | wc
>       0       1 2796691
```