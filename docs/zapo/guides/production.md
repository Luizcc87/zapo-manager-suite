# Production & deployment
Source: https://zapo.to/en/guides/production

Run zapo reliably in production: durable persistence, graceful shutdown, scaling multiple sessions, reconnection strategy, and the knobs that matter.

`zapo` is built for long-lived, multi-session workloads. This page collects the operational decisions that matter once you move past a local prototype.

## Persist credentials (don't re-pair)

Production sessions **must** use a durable [store](/en/concepts/stores) for the `auth` and Signal domains, plus a **stable `sessionId`** across restarts. The in-memory store loses everything on exit, forcing a re-pair on every boot.

```ts theme={null}
const client = new WaClient({ store, sessionId: 'tenant-42' }, logger)
```

Changing `sessionId` orphans the previous credentials — treat it as the durable key for a device/account.

## Choose a store backend

| Backend                                            | Best for                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `@zapo-js/store-sqlite`                            | Single process / single host — the simplest, fastest local option. |
| `@zapo-js/store-postgres` · `@zapo-js/store-mysql` | Multiple hosts, relational ops, managed backups.                   |
| `@zapo-js/store-redis`                             | Low-latency cache + persistence.                                   |
| `@zapo-js/store-mongo`                             | Document-oriented deployments.                                     |

You can mix backends per domain (e.g. `auth`/`signal` in Postgres, caches in Redis). See [Installation](/en/installation#add-a-storage-backend) and the [stores reference](/en/reference/stores).

## Graceful shutdown

Call `disconnect()` (never `logout()`) on shutdown — it flushes pending [write-behind](/en/concepts/configuration#write-behind-persistence) data and closes the socket **without** unlinking the device, so the next boot resumes from the store.

```ts theme={null}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await client.disconnect()
    process.exit(0)
  })
}
```

<Warning>
  `logout()` unlinks the device server-side and clears stored state — it forces a full re-pair. Use it only to permanently disconnect, never as a shutdown hook.
</Warning>

## Run many sessions

A single store can hold many independent accounts, each keyed by `sessionId`. Create one `WaClient` per account:

```ts theme={null}
const clients = tenants.map((id) => new WaClient({ store, sessionId: id }, logger))
await Promise.all(clients.map((c) => c.connect()))
```

Each client pairs, reconnects, and emits events independently. Budget memory/CPU per session (each holds Signal state and in-memory caches), and shard across processes/hosts as you scale — one process per session is the simplest isolation model. See [Multi-session deployments](/en/guides/multi-session) for the full operational guide.

## Tune for throughput

* **Write-behind** batches incoming message/thread/contact writes off the hot path. Tune `writeBehind.maxPendingKeys` / `maxWriteConcurrency` / `flushTimeoutMs` to your database. ([config](/en/concepts/configuration#write-behind-persistence))
* **History sync** (`history.enabled`) is on by default and adds a large initial download. Set it to `false` if you don't persist mailbox/threads/contacts; set `requireFullSync` deliberately.
* **Bots that shouldn't appear online**: `markOnlineOnConnect` defaults to `false`, so bots are invisible on connect out of the box. Pass `true` only when you want a visible "online" presence.
* **Timeouts** (`iqTimeoutMs`, `keepAliveIntervalMs`, `deadSocketTimeoutMs`, …) ship with production defaults — override only with a reason. ([config](/en/concepts/configuration#timeouts))

## Reconnection & error policy

`zapo` does **not** auto-reconnect — own the policy. Wire a backoff loop ([Reconnection](/en/guides/reconnection)) and classify failures ([Errors & disconnects](/en/guides/errors)) so you stop on fatal reasons (`banned`, `not_authorized`, logout) instead of hammering the server.

## Logging

Use a structured logger in production:

```ts theme={null}
const logger = await createPinoLogger({ level: 'info', pretty: false })
```

`pretty: false` emits JSON lines suited to log aggregators. Drop to `debug` / `trace` only when investigating.

## Security & versioning

* **Credentials are secrets.** `WaAuthCredentials` holds the device keys — if you persist them outside the built-in store, encrypt at rest. ([Authentication](/en/concepts/authentication#credentials))
* **Never enable `dangerous.*`** in production — those flags disable security checks. ([config](/en/concepts/configuration#dangerous-options))
* **Versioning.** `zapo` is `1.0` and follows [semantic versioning](https://semver.org) — breaking changes only land in a new major. Use a version range or lockfile as usual, and review the changelog before major upgrades.

