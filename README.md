# Setup for developers

## The Database

This application uses Mongodb for its database. You will need to have it
installed to use it. Check out the Mongodb installation information at:

    http://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/


## Installation

- `git clone git@github.com:mikefab/majicbox.git`
- `cd majicbox`
- `npm install`
- **Get Azure credentials**. You should end up with a line like `export AZURE_STORAGE_ACCOUNT=zika1093 AZURE_STORAGE_ACCESS_KEY=....`. For security reasons, we don't distribute keys with the repository; ask around.
- `node lib/blob-sync/download-from-azure.js`
- `for i in br co pa; do node lib/import/admin.js -c $i --verbose true; node lib/import/fake_weather.js -c $i -n 30; done`
- `node lib/import/fake_weather.js -c 'br' -n 60`
- `node lib/import/mobility.js -c 'br'`
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

## Importing a new country
### Get shapefile
- Browse to http://gadm.org/country
- select country
- select shapefile
- click download

### Convert shapefile to geojson
This process requires the [GDAL - Geospatial Data Abstraction Library](http://www.gdal.org/)

(On Mac OSX: brew install gdal)

- Unzip file, and change into directory.
- Run the following command where country-code is an [ISO 3166-1 alpha-3 code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3):
 `ogr2ogr -f GeoJSON admin2.json country-code_adm2.shp`
- Create directory for country in data/geojson using its ISO [3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) code.
Example for Colombia: `mkdir ./data/geojson/co`
- Move admin2.json to data/geojson/country code.
- From project root run the following command where -c is country code:

`node lib/import/admin.js -f './data/geojson/br/admin2.json' -c 'co' --verbose true`
