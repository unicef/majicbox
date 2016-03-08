FROM node:4.3.1

# NOTE(zora): we copy package.json into /code first, so we don't have
# to re-download node modules if package.json doesn't change.
WORKDIR /code
COPY ./package.json /code/package.json
RUN npm install

COPY . /code
EXPOSE 8000
CMD ./scripts/entrypoint.sh
