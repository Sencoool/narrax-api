# Narrax API

Backend for **Narrax**, an AI-assisted novel writing platform. Writers draft serialized novels
episode by episode; this service owns the data, the ownership rules, and the AI pipeline behind the
editor's streaming assistant.

- **Stack** — NestJS 11, Prisma 7, PostgreSQL with the `pgvector` extension, TypeScript.
- **Clients** — [narrax-ui](https://github.com/Sencoool/narrax-ui) is the only known consumer.

A separate app (the UI) renders everything; this repository has no HTML.

---

## Architecture

Four layers, one directory each:

| Layer | Path | Holds |
| --- | --- | --- |
| Domain | `src/domain` | entities, repository ports (interfaces), domain errors |
| Application | `src/application/use-cases` | one class per operation; takes `userId` explicitly |
| Infrastructure | `src/infrastructure` | Prisma repositories, mappers, AI providers, filters |
| Presentation | `src/<feature>/*.controller.ts` | HTTP routes, DTOs (zod), guards, decorators |

The ports-and-adapters split is real, not decorative: controllers never touch Prisma, and every
mutating use case takes the caller's `userId` as an argument rather than reading it from a request
object. That is what makes the ownership rules testable without a database.

---

## Requirements

- Node.js 22 or newer (CI runs 24).
- PostgreSQL **with `pgvector`** — the schema declares `extensions = [vector]` and embeddings are
  stored as `vector(768)` (Gemini `text-embedding-004` dimensions, matching the local
  `nomic-embed-text` default).
- Ollama, only if you use local models or the local embedding model. Everything else works without it.
- Docker is **not** required: `docker-compose.yml` only wires up pgvector for convenience.

---

## Getting started

```bash
git clone https://github.com/Sencoool/narrax-api.git
cd narrax-api
npm ci                                  # runs `prisma generate` via postinstall

cp .env.example .env                    # then edit it — see Environment below
```

Set `JWT_SECRET` before starting the app. `MODEL_ENCRYPTION_KEY` is recommended for saved provider
keys; if omitted, key encryption falls back to `JWT_SECRET`. Keep whichever value encrypts keys
stable, or users will have to re-enter their provider keys.

```bash
# start the pgvector database (or point DATABASE_URL at an existing one)
docker compose up -d
createdb plotweaver                     # if you are not using compose

npx prisma migrate deploy               # apply migrations
npm run start:dev                       # http://localhost:3000
```

Verify it is alive:

```bash
curl http://localhost:3000/health        # {"status":"ok","db":"ok"} when DB is reachable
# Open http://localhost:3000/docs in a browser for Swagger UI
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Swagger at `/docs` is the
quickest way to inspect the current route methods and request bodies.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run start:dev` | watch mode |
| `npm run build` | compile to `dist/` (`nest build`) |
| `npm run start:prod` | run the compiled server (`node dist/main`) |
| `npm run lint` | eslint, read-only |
| `npm run lint:fix` | eslint with `--fix` |
| `npm run test` | jest unit tests |
| `npm run test:e2e` | jest e2e suite (`test/app.e2e-spec.ts`); needs a database |
| `npm run test:cov` | unit tests with coverage |
| `npm run format` | prettier over `src` and `test` |
| `npx prisma migrate deploy` | apply committed migrations |

`lint` no longer rewrites files — the `--fix` behaviour moved to `lint:fix`, so a check in CI cannot
silently modify the working tree.

---

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/plotweaver` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | for compose | must match `DATABASE_URL` |
| `JWT_SECRET` | **yes** | no fallback; the app refuses to start without it |
| `JWT_EXPIRES_IN` | no | default `7d` |
| `MODEL_ENCRYPTION_KEY` | recommended | AES-256-GCM key for stored provider API keys; falls back to `JWT_SECRET` if absent. Changing the effective key makes stored keys unreadable |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` / `OLLAMA_EMBEDDING_MODEL` | no | defaults `http://localhost:11434`, `qwen2.5`, `nomic-embed-text` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | for Google sign-in | callback must match the Google console exactly |
| `FRONTEND_URL` | no | where the Google callback redirects; default `http://localhost:5173` |
| `CORS_ORIGIN` | no | comma-separated origins; falls back to `FRONTEND_URL`. Never `*` |
| `ADMIN_EMAILS` | no | comma-separated allowlist for the `/users` endpoints. Empty = nobody is admin |
| `PORT` | no | default `3000` |

---

## Data model

```
User ──< Novel ──< Episode ──< EpisodeChunk        (RAG: vector(768) embeddings)
                     │
                     ├──< ConversationMessage      (AI chat history, newest 50 returned)
                     └──< EpisodeRevision          (snapshot before text is overwritten, keep 5)

Novel ─── NovelContext                            (lore, cast, pinned context)
User  ──< UserModelConfig                         (bring-your-own model + encrypted key)
```

**EpisodeRevision.** Autosave PATCHes an episode on a ~2.5s debounce, so an accidental overwrite or
select-all-delete used to be unrecoverable. `UpdateEpisodeUseCase` now writes a snapshot of the
previous title/content/order/cast whenever an update would actually replace text, and prunes to the
newest 5 per episode. Metadata-only saves (publish, reorder, cast, summary) deliberately skip it.

**Reserved but not wired.** `Profile`, `Role`, `UserRole`, `Comment`, `Review`, `Follow`, `Bookmark`,
`MediaAsset` and the `CommentTargetType` / `MediaType` / `RoleName` enums have zero references in
`src/`. They are kept on purpose as the shape of planned features — see the comment in
`prisma/schema.prisma`. Admin access is decided by `ADMIN_EMAILS`, not by `Role`/`UserRole`.

---

## HTTP API

Published novel and episode read routes also accept anonymous requests. Authors with a bearer token
can read their own drafts; a stranger requesting unpublished content gets 404. Mutations, private
context, conversations, revisions, model settings and generation require
`Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | liveness |
| POST | `/auth/register` | create an account, returns `{ access_token, user }` |
| POST | `/auth/login` | email + password login, same shape |
| GET | `/auth/google` → `/auth/google/callback` | OAuth; redirects to `FRONTEND_URL/auth/callback?token=…` |
| GET | `/auth/me` | the current user |
| POST | `/auth/logout-all` | revokes every token issued before now |
| POST | `/novels` | create a novel |
| GET | `/novels` | list (paginated, `limit` ≤ 100, default 20) |
| GET / PATCH / DELETE | `/novels/:id` | read / update / delete |
| GET / PUT | `/novels/:novelId/context` | read / replace lore, cast and pinned context |
| POST | `/novels/:novelId/episodes` | create an episode |
| POST | `/novels/:novelId/episodes/upload-content` | import text into an episode |
| GET | `/novels/:novelId/episodes` | episode list (summaries, no heavy content) |
| GET / PATCH / DELETE | `/episodes/:id` | read / update / delete |
| GET / POST | `/episodes/:id/revisions`, `/episodes/:id/revisions/:revisionId/restore` | list recent content snapshots / restore one |
| POST | `/episodes/:id/generate-summary` | regenerate the episode summary |
| GET / POST / DELETE | `/episodes/:id/conversation` | AI chat history for the episode |
| POST | `/story-generations/stream` | **SSE** — stream a generated continuation |
| GET / POST / PATCH / DELETE | `/user-models`, `/user-models/:id`, `/user-models/:id/set-default`, `/user-models/test` | bring-your-own-model config and key test |
| GET / PATCH / DELETE | `/users`, `/users/:id` | **admin only** (`ADMIN_EMAILS`) |

### Authorization

Two rules, both enforced server-side:

1. **Ownership.** Every episode and novel-context route resolves the caller's access through the
   parent novel (`EnsureEpisodeOwnershipUseCase`, `Novel.isOwnedBy`): a missing row is **404**, a row
   belonging to someone else is **403**. This was a real hole — the JWT was checked but ownership was
   not.
2. **Admin.** `AdminGuard` (`src/auth/guards/admin.guard.ts`) allowlists `ADMIN_EMAILS` and guards the
   whole `users` controller. It must run after `JwtAuthGuard`.

Admins do **not** bypass ownership checks: an admin hitting another writer's episode gets the same
403. That is intentional — say so before "fixing" it.

### Sessions and revocation

`register`/`login` return a JWT signed with `{ sub, email }` and `iat`, valid for `JWT_EXPIRES_IN`
(7 days by default). Because the token lives in the client's `localStorage`, logout there is only
cosmetic — so `POST /auth/logout-all` stamps `User.tokensValidFrom` with "now", and `JwtStrategy`
rejects any token whose `iat` predates it. The caller's own token dies too, which is the point.

`iat` has one-second resolution, so a token minted in the same second as the revocation still passes;
a token with no `iat` is rejected once a user has ever revoked.

---

## The AI pipeline

**Providers.** `MultiProviderStreamService` speaks to Ollama (local), OpenAI, Anthropic, Gemini,
Mistral, and OpenAI-compatible endpoints behind one interface. Keys are per user, stored encrypted
with AES-256-GCM using `MODEL_ENCRYPTION_KEY` (or `JWT_SECRET` when unset), and never returned by an
endpoint.

**Streaming contract.** `POST /story-generations/stream` returns `text/event-stream` with
newline-delimited `data: <json>`. Events: `chunk` (`{ text }`), `segment_start` (`{ segment, total }`),
`segment_done` (`{ segment, chars }`), `done` (`{ requestId, totalChars }`), `error` (`{ message }`).
Requests carry the user message, the editor's current HTML as "story so far", and prior turns. The DTO
caps history at **20 turns** with a per-turn character limit — the client loads 50 messages and sends
the newest 20, which is deliberate (see the UI README).

**Failure behaviour.** Provider calls are time-boxed and every stream parser flushes its trailing
buffer, so a stall surfaces as an `error` event instead of a hang.

**RAG.** Episode chunks are embedded locally via Ollama and retrieved as context for generation.
Embeddings are a *local* dependency, so a cloud-model user without Ollama used to fail every
generation; the pipeline now degrades to context-only prompting instead.

---

## Migrations

```bash
npx prisma migrate dev --name describe_the_change    # needs a reachable database
npx prisma migrate deploy                            # apply in CI/production
```

When no database is reachable, generate the SQL offline instead — this is how the last two migrations
were produced:

```bash
git show HEAD:prisma/schema.prisma > /tmp/before.prisma
npx prisma migrate diff --from-schema /tmp/before.prisma --to-schema prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_describe_the_change/migration.sql
```

Review the generated SQL before committing it; a diff sees the schema, not your intent.

---

## Testing

```bash
npm run test        # unit: use cases and rules, with mocked repositories
npm run test:e2e    # e2e: boots the app against a real database
```

Unit tests mock the repository ports, so they run without Postgres — that is the payoff of use cases
taking `userId` explicitly. Coverage is concentrated on the rules that have bitten: ownership,
conversation windows, token revocation, episode snapshots.

CI (`.github/workflows/ci.yml`) provisions Postgres 16 and runs, in order: `npm ci` →
`prisma generate` → `lint` → `test` → `build` → `test:e2e`.

**Known limitation.** Nest's DI graph is not restorable inside jest, so tests instantiate use cases
directly with hand-built fakes rather than via a testing module. Integration-shaped assertions belong
in `test/`, which needs a database.

---

## Logging and rate limiting

- `NarraxLogger` (`src/logger/narrax-logger.ts`) writes to stdout and to a daily file,
  `logs/narrax-YYYY-MM-DD.log`. Prompt and response bodies are never logged at `verbose` level.
- Throttling is global at **120 requests / 60s** per client, with a tighter **10 / 60s** on
  `/story-generations/stream`. The editor autosaves every ~2.5s after a pause (≈24 req/min), so raise
  the global limit before removing the guard if you add more polling.

---

## Known gaps

- No `Dockerfile`; deployment is currently whatever image you build around `npm run build` +
  `npm run start:prod`.
- The database is named `plotweaver` in `.env` / `.env.example` — a leftover from before the rename.
  Changing it needs a dump and restore, so it was left alone deliberately.
- The reserved models in the schema have no endpoints (see Data model).
