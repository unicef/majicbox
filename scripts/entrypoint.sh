#!/bin/bash
#
# TODO: Make setup a separate task

cp -r data-sample data
node lib/import/region.js -f './data/geojson/br/admin2.json' -c 'br' --verbose true
node lib/import/fake.js -c 'br'
node server.js
