FROM node:7.3.0

MAINTAINER Unicef Innovation Office

WORKDIR /code

COPY npm-shrinkwrap.json .

RUN npm install

COPY . .

EXPOSE 8000

CMD ["npm", "start"]
