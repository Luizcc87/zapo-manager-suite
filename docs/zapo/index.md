# Zapo Documentation Index

This directory contains the split local copy of the official [zapo.to](https://zapo.to) documentation.

## General

- **[Dev tools (MCP & fake server)](./dev-tools.md)** - Optional dev-only packages: an MCP server to drive a live WaClient from an AI agent, and an in-process fake WhatsApp server for offline integration tests.
- **[Installation](./installation.md)** - Install zapo-js with npm, pnpm, or yarn, choose a storage backend for credentials, and add the optional peer dependencies your features depend on.
- **[Introduction](./introduction.md)** - zapo is a high-performance TypeScript implementation of the WhatsApp Web protocol, built for high-scale, multi-session bot and automation workloads.
- **[Quickstart](./quickstart.md)** - Connect a WhatsApp session, scan the QR code or use a pairing code, and reply to your first incoming message in under five minutes with zapo.
- **[Troubleshooting & FAQ](./troubleshooting.md)** - Answers to the most common questions and pitfalls when running zapo: pairing failures, disconnects, missing events, history sync, and store corruption.
- **[Use the docs from your AI assistant](./use-with-ai.md)** - Pull these docs into Claude Code, Cursor, ChatGPT, or any MCP-capable agent — three integration paths, no setup on our side.

## Concepts

- **[Architecture](./concepts/architecture.md)** - How the WaClient, coordinators, stores, transport, and event flow fit together inside zapo, and how data moves from WhatsApp into your code.
- **[Authentication](./concepts/authentication.md)** - Pair a device with a QR code or 8-character pairing code, persist Noise credentials across restarts, and cleanly log out of a WhatsApp session.
- **[Configuration](./concepts/configuration.md)** - Configure WaClient: sessions, timeouts, history sync, presence on connect, addons, proxy, logging, logout cleanup, and production knobs.
- **[Events](./concepts/events.md)** - Reference for every WaClient event you can subscribe to: messages, receipts, groups, history sync, app-state mutations, and failures.
- **[Identities: phone numbers & LID](./concepts/identities.md)** - How WhatsApp's phone-number JIDs (PN) and privacy LIDs differ, why both exist in multi-device, and how zapo maps and resolves between them.
- **[Architecture in depth](./concepts/internals.md)** - How zapo handles Noise handshakes, Signal sessions, prekey rotation, sender keys, app-state mutations, and the write-behind store internally.
- **[Mobile connections](./concepts/mobile.md)** - Connect zapo as a primary mobile (Android) WhatsApp client over the TCP transport instead of a companion device, including the limitations involved.
- **[The WhatsApp protocol](./concepts/protocol.md)** - A tour of the WhatsApp multi-device protocol — Noise transport, XML stanzas, Signal encryption, and how zapo implements each layer in TypeScript.
- **[Stores](./concepts/stores.md)** - Persist authentication state, Signal sessions, and per-domain protocol data through zapo's pluggable store interface and bundled backend packages.

## Guides

- **[Bots](./guides/bots.md)** - Discover WhatsApp bots, send prompts, and receive streamed responses with zapo. Works with any WhatsApp bot, including Meta AI and third-party agents.
- **[Broadcast lists](./guides/broadcast-lists.md)** - Define a WhatsApp broadcast list with zapo and send a single message to many recipients at once without creating a group or revealing the list.
- **[Managing chats](./guides/chats.md)** - Mute, pin, archive, mark as read, lock, star, clear, and delete WhatsApp chats with the typed client.chat coordinator backed by app-state mutations.
- **[Errors & disconnects](./guides/errors.md)** - Read DisconnectReason codes, handle stream failures and error stanzas from WhatsApp, and decide when to reconnect versus stop the session for good.
- **[Groups & communities](./guides/groups.md)** - Create groups, manage participants and admins, handle invites, configure community sub-groups, and react to group events with zapo.
- **[Polls, reactions & edits](./guides/interactive-messages.md)** - Send polls and votes, react to messages, pin and edit content, revoke sent messages, and handle the events for each — through the typed content union.
- **[Media](./guides/media.md)** - Send images, video, audio voice notes, documents, and stickers — and stream or download incoming WhatsApp media attachments with zapo's media helpers.
- **[Migrating from Baileys](./guides/migrating-from-baileys.md)** - Coming from Baileys? Here's how the connection lifecycle, store layout, message API, and event names map onto zapo's coordinator-based client.
- **[Multi-session deployments](./guides/multi-session.md)** - Run many WhatsApp accounts in one process with a shared store — what's per-session vs shared, the single-writer rule, memory budget, sharding, and graceful shutdown.
- **[Newsletters (channels)](./guides/newsletters.md)** - Create, discover, follow, post to, react on, and administer WhatsApp channels (newsletters) using the client.newsletter coordinator in zapo.
- **[Presence & status](./guides/presence-status.md)** - Broadcast online presence, send typing and recording indicators, subscribe to contact presence, and post WhatsApp status updates with text and media.
- **[Production & deployment](./guides/production.md)** - Run zapo reliably in production: durable persistence, graceful shutdown, scaling multiple sessions, reconnection strategy, and the knobs that matter.
- **[Profile, privacy & business](./guides/profile-privacy.md)** - Manage your WhatsApp profile, change privacy settings, edit the blocklist, and read business profiles and hours with the profile coordinator.
- **[Receiving messages](./guides/receiving-messages.md)** - Handle incoming message events: extract text and media, send delivery and read receipts, decrypt addons, and request older history.
- **[Recipes](./guides/recipes.md)** - Copy-paste patterns for the most common things you'll build with zapo — command bots, media handling, threaded replies, and group moderation tasks.
- **[Reconnection](./guides/reconnection.md)** - zapo does not auto-reconnect by design — follow this pattern to detect dropped sessions, rebuild the client, and resume without duplicate connections.
- **[Sending messages](./guides/sending-messages.md)** - Send WhatsApp text, threaded replies, mentions, and rich link previews with client.message.send, the typed entry point for all outgoing content.

## Reference

- **[Chat mutations (app-state)](./reference/chat-mutations.md)** - Every client.chat operation — the typed convenience helpers and the generic set and remove calls over the full app-state schema surface in zapo.
- **[WaClient & coordinators](./reference/client.md)** - Complete method reference for WaClient and every coordinator: auth, message, presence, chat, group, newsletter, profile, and more.
- **[Glossary](./reference/glossary.md)** - Definitions of the WhatsApp protocol and zapo terms used across the docs: JID, LID, stanza, prekey, sender key, app-state, coordinator, fanout, Noise.
- **[JIDs, helpers & constants](./reference/jid-helpers.md)** - Build, parse, and inspect WhatsApp JIDs, plus every WA_* protocol constant exported from the zapo-js package root for use in your own code.
- **[Low-level API](./reference/low-level.md)** - The raw escape hatch — send protocol nodes, issue IQs to WhatsApp, and register custom incoming-node handlers and filters when the high-level API is not enough.
- **[Message types](./reference/message-types.md)** - Every send content variant in zapo — the typed builders discriminated by `type`, and the raw Proto.IMessage fields the library recognizes on receive.
- **[Stores reference](./reference/stores.md)** - Configuration reference for the SQLite, PostgreSQL, MySQL, Redis, and MongoDB store backend packages, including fields, defaults, and examples.
