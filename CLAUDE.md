# CLAUDE.md — cloud-surveillance-camera

NestJS 11 backend for Sanaw's cloud surveillance platform (NVRs/cameras, fog-edge telemetry over MQTT, TDengine time-series, MongoDB, WebSocket, multi-tenant).

**The full picture — commands, environment setup, the module map, the extensions, the `src/dddLib` DDD framework, how modules talk to each other, and the multi-tenancy isolation strategy — lives in [`AGENTS.md`](./AGENTS.md).** Read it before any non-trivial change; it's the single source of truth shared with other coding agents (Codex, etc.) so keep updates there, not duplicated here.

## Before you touch anything

- Config is env-driven and **fails to boot** if any var is missing (`configs/app.config.ts`, strict `env-var` `.required()`). Check `.env.${NODE_ENV}` before assuming a var doesn't exist.
- `npm run start:dev` runs `sudo kill -9` on any running Nest process first — don't run it if another instance might matter; use `npm start` instead.
- New modules must follow `src/modules/<name>/{applicationService,contracts,domain,infra}/` and reuse `src/dddLib/` base classes. Several existing modules (`fogCommunicationManager`, `systemMonitor`, `trash`, `actorLogs`, `systemLogs`, `shared`) deliberately deviate from that shape — see AGENTS.md's "Module map" for why before copying them as a template.
- Cross-module calls go through a producer's `*ApiFor<Consumer>Service` facade, never another module's repository/schema directly.
- Tests are never colocated with production code: a unit test goes in the `tests/` dir of its own unit — a module (`src/modules/<module>/tests/…`), an individual extension (`src/extensions/<extension>/tests/…`), or `src/dddLib/tests/` / `src/utilities/tests/` — at a path mirroring its source. So `applicationService/commands/nvr/updateNvr.command.ts` → `tests/applicationService/commands/nvr/updateNvr.command.spec.ts`, and `src/extensions/caching/cache.service.ts` → `src/extensions/caching/tests/cache.service.spec.ts`. See AGENTS.md's "Test layout".
- Multi-tenancy is enforced entirely in application code (shared Mongo/Redis/BullMQ/MQTT/TDengine, no per-tenant infra) — any change touching persistence, MQTT, queues, or WebSocket must preserve tenant scoping (`RequestContextService.requireTenantId()`, tenant-tagged job ids/topics/rooms). See AGENTS.md's "Multi-tenancy isolation strategy".
- `src/extensions/messanger` (sic) is a stub — its SMS/voice/email/Telegram methods just `console.log`. Don't assume a notification path actually sends anything without checking further.
- Domain events (`AggregateRoot.publishEvents`) are published on every write but have no cross-module `@OnEvent` subscribers today — don't assume publishing one will trigger behavior elsewhere.
