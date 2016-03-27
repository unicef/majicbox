# sets up the repository, using development data. this will generate fake data when
# there isn't access to the production versions.
.PHONY: setup-dev-data
setup-dev-data:
	rsync -av data-sample/ data/  # rsync doesn't make a `data/data-sample/` directory.
	for i in br co pa; do \
		node lib/import/admin.js -c $$i --verbose true; \
		node lib/import/fake_weather.js -c $$i -n 30; \
	done
	

.PHONY: lint
lint:
	./node_modules/eslint/bin/eslint.js .

# Runs unit tests in a Docker container. Probably not necessary for typical
# usage ... Docker is fast but maybe not as interactive as local. Maybe good
# to run on Jenkins or another deploy system, if we ever start using such.
.PHONY: utest-in-docker
utest-in-docker:
	docker-compose build unit-tests && docker-compose run --rm unit-tests
