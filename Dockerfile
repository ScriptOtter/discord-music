# Используем базовый образ Node.js
FROM node:24.5.0 AS base

RUN apt-get update && apt-get install -y libopus0 libopus-dev opus-tools ffmpeg libssl-dev libc6-dev ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

CMD ["yarn", "run", "start:dev"]
