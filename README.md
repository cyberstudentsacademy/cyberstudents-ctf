<h1 align="center">CyberStudents CTF</h1>

<p align="center">A Discord bot to manage CTF challenges in the CyberStudents Discord server</p>

<p align="center">
  <a href="https://discord.gg/nZjGNvqjXp">
    <img src="https://img.shields.io/discord/916144903686336513?color=5865F2&logo=discord&logoColor=white" alt="Discord Server" />
  </a>
  <a href="https://github.com/cyberstudentsacademy/cyberstudents-ctf/actions">
    <img src="https://github.com/cyberstudentsacademy/cyberstudents-ctf/actions/workflows/tests.yml/badge.svg" alt="CI Tests Status" />
  </a>
  <a href="https://github.com/sponsors/GodderE2D">
    <img src="https://img.shields.io/badge/sponsor-GodderE2D-ea4aaa?logo=github&logoColor=white" alt="GitHub Sponsors" />
  </a>
</p>

---

To see the bot in action, join the [CyberStudents Discord server](https://discord.gg/nZjGNvqjXp) and use the `/help`
command to get started.

# Features

- [x] Uses Discord interactions and components (e.g. slash commands, buttons, modals)
- [x] Hint request system with points
- [x] Overall leaderboard and challenge-specific leaderboards
- [x] Optional anonymous mode
- [x] Manage challenges and users
- [x] Flag publishing protection

# Installing

To locally install the bot yourself (e.g. if you want to contribute or self-host), follow these steps:

## Prerequisites

- Node.js 16.11.0 or later
- Yarn berry (4.1.0)
- A Discord application and bot
- A PostgreSQL database (to run one locally, see [here](https://www.postgresql.org/docs/current/tutorial-install.html))

## Setup

Once you've cloned the repository from GitHub, install the required Node dependencies.

```sh
yarn
```

Copy the `.env.example` file to a new `.env` file and the `config.example.json` file to a new `config.json` file. Then,
fill out the environment variables and configuration values listed inside.

```sh
cp .env.example .env
cp config.example.json config.json
```

Push the Prisma schema to your Postgres database.

```sh
yarn push

# If you don't have a database yet, you can still generate typings
yarn generate
```

Compile the bot with tsc. Leave this terminal tab open while developing the bot. In production, you can use `yarn build`
instead.

```sh
# Development (watch mode)
yarn build:dev

# Production
yarn build
```

Finally, you can run the bot using nodemon in development or pm2 in production.

```sh
# Development
yarn dev # nodemon
# or
yarn start # node

# Production
pm2 start dist/src/index.js
```

# Contributing & Support

If you need support with the bot, feel free to [contact me by joining my server](https://discord.gg/R2FDvcPXTK).

If you'd like to contribute to the bot, please review our [code of conduct](CODE_OF_CONDUCT.md) first. If you have a bug
report, feature request, please [open an issue](https://github.com/cyberstudentsacademy/cyberstudents-ctf/issues). If
you're interested in fixing a bug or adding a new feature, please
[open a pull request](https://github.com/cyberstudentsacademy/cyberstudents-ctf/pulls).

If you'd like to report a security vulnerability or otherwise want to contact me, please email me at
[goddere2d@bsr.gg](mailto:goddere2d@bsr.gg) or [godderseesyou@gmail.com](mailto:godderseesyou@gmail.com).

## PR Guidelines

- Please follow the [conventional commits specification](https://www.conventionalcommits.org/en/v1.0.0/) where possible
  (you may also use `docs`, `chore` or other headers).
- Please use `yarn test` to ensure TypeScript, ESLint, and Prettier checks pass.
- Please do not include out-of-scope changes in a PR, instead open a separate PR for those changes.
- Please do not use translators to edit language files.

# License

CyberStudents CTF is licensed under the
[Apache License 2.0](https://github.com/cyberstudentsacademy/cyberstudents-ctf/blob/main/LICENSE).
