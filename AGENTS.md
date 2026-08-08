# AGENTS.md — cloud-surveillance-camera

NestJS 11 backend for Sanaw's cloud surveillance platform. Uses CQRS (`@nestjs/cqrs`), MongoDB (Mongoose), TDengine (time-series via `@tdengine/websocket`), Redis (BullMQ + caching), MQTT, WebSocket (socket.io), Keycloak auth. README is the stock NestJS starter — ignore it; this file is authoritative.

## Commands

- `npm install` — install (runs husky via `prepare`).
- `npm run start:dev` — dev watch mode. **Runs `sudo kill -9` on any running nest process first**; use `npm start` if that's undesirable.
- `npm run test` — unit tests (`*.spec.ts` under `src/`, jest `rootDir: src`). Currently almost no unit tests exist.
- `npm run test:e2e` — uses `test/jest-e2e.json` (separate config, `rootDir: test`, `*.e2e-spec.ts`).
- Single test: `npm run test -- path/to/file.spec.ts`.
- `npm run lint` — eslint **with `--fix`** (mutates files). ESLint flat config is NOT used — config is legacy `.eslintrc.js`.
- No separate typecheck script; typecheck via `npm run build` (`nest build`, output `dist/`).
- Commits: conventional commits enforced by husky `commit-msg` + commitlint (see git log, e.g. `feat(videoDevices): ...`). Branch: `develop` (default working branch), `master` for releases.
- Pre-commit hook (`husky` + lint-staged in `.lintstagedrc.json`): eslint --fix + prettier on staged `*.{ts,js}`.

## Environment & runtime prerequisites

- Config is **env-driven and strict**: `configs/app.config.ts` uses `env-var` with `.required()` on everything — the app crashes on boot if any var is missing.
- Env file is selected by `NODE_ENV`: `.env.${NODE_ENV}` (files: `.env.development`, `.env.production`, `.env.test`). All entrypoint scripts set `NODE_ENV` via `cross-env`.
- **Note:** `.env.test` sets `NODE_ENV=production` inside the file — don't rely on it reflecting real test values; keys listed there exist but many values are blank.
- External services expected when running the full app: MongoDB (:27017), Redis (:6379), EMQX/MQTT broker (:1883 + REST API :18083), TDengine, Keycloak. There is **no docker-compose in this repo** — infra must be provided externally. Tests must not implicitly require these unless they already do.
- `AppModule` connects to TDengine at boot via a top-level provider factory — providers/mocks for `TDENGINE_CLIENT` / `TDENGINE_RESTFULL_OPTIONS`/`TimeseriesRepository` are needed to boot the app in tests.

## Architecture

DDD/hexagonal per module — not default flat NestJS layout. New features must follow the `src/modules/<name>/` shape (see `workstations` or `videoDevices` for the pattern):

```
src/modules/<name>/
  applicationService/   # commands/, queries/, services/  (CQRS handlers)
  contracts/            # request/response DTOs (validate with class-validator)
  domain/               # entities, aggregates, events/, exceptions/
  infra/                # mongoose schemas, repositories, mappers
  <name>.module.ts
```

- `src/dddLib/` — shared base classes (`aggregateRoot.base`, `repository.base`, `mapper.base`, `command.base`, `query.base`, `*response.base` DTOs). Reuse these; don't reinvent.
- `src/modules/shared/timeseriesRepository` — shared TDengine access layer.
- `src/extensions/` — cross-cutting global modules wired in `AppModule`: `mqtt`, `scheduler`, `caching`, `logger` (nestjs-pino), `websocket` (socket.io), `translation`, `serviceProvider`, `userInfo`, `serialization`, `sanawApi`, `queue`, `messanger` (sic — directory is misspelled).
- Film the wiring in `src/app.module.ts`: global `ConfigModule` (loads `AppConfig`), `CqrsModule`, `EventEmitterModule`, `RequestContextModule`, global `ContextInterceptor` + `GlobalExceptionFilter`, and per-module Mongoose via root `MongooseModule.forRoot(AppConfig().mongodb.url)`.
- `src/main.ts`: global ValidationPipe with `whitelist + forbidNonWhitelisted + forbidUnknownValues` (strict DTOs), Swagger enabled only outside production, 5GB body limits.

## Quirks / gotchas

- tsconfig has **`noImplicitAny: false`** and `strictNullChecks: true` — don't enable stricter flags repo-wide; follow existing style.
- `typeRoots: ["./types"]` — custom global type declarations live in `types/`.
- Absolute-ish imports from project root work via `baseUrl: "./"` (e.g. `configs/app.config`).
- Known typos preserved as real paths/names: `src/extensions/messanger`, `cacheing.module.ts`, `workstaions.module.ts` — match imports to the actual filenames, don't "fix" them casually.
- Dates use `jalali-moment` (Persian calendar); timezone `TZ=Asia/Tehran` in env files.
