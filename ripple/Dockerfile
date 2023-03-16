########################################
FROM node:16.15.1-alpine AS release

RUN apk add --update bash build-base curl wget

RUN npm install typescript@latest --global --quiet

RUN mkdir -p /home/app

WORKDIR /home/app
COPY ./src /home/app/src
COPY ./package.json /home/app

RUN npm install -g nodemon
RUN npm install
EXPOSE 3000

# CMD ["npx", "ts-node", "--transpile-only", "./src/index.ts"]
CMD ["nodemon", "./src/index.ts"]
