<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

- Дискорд бот для транслирующий музыку с ютуб в дискорд канал.

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Postgres
```bash
$ yarn prisma db push
```

## Docker

```bash
docker-compose up --build
```

## ENVIROMENTS

```env
NODE_ENV=development

SERVER_PORT=4200

POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

DISCORD_TOKEN=
DISCORD_DEVELOPMENT_GUILD_ID=
```

## Prewiev
<img width="578" height="831" alt="1" src="https://github.com/user-attachments/assets/dace8a9a-1c71-471d-9235-ddae2cbdbe61" />
<img width="595" height="627" alt="2" src="https://github.com/user-attachments/assets/8c9ceb74-c33e-435f-bfc7-caabb34c6f87" />
<img width="503" height="168" alt="3" src="https://github.com/user-attachments/assets/1838286a-a6bd-4b2e-89ac-f3bacb1dfcdd" />
<img width="540" height="816" alt="4" src="https://github.com/user-attachments/assets/abd79a11-cd97-4c5c-9a16-5e62c00635fa" />

### Youtube Cookies
#### Для стабильной работы приложения необходимо 
- Cоздать файл cookies.txt в корневой директории
- Установить расширение [get-cookiestxt-locally](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- Зайти на Youtube и нажать кнопку «Copy» в расширении
- Вставить cookie в папку cookies.txt

### Discord tokens

 - Все токены можно получить на сайте [Discord Developers](https://discord.com/developers/applications)

#### License

- MIT licensed
