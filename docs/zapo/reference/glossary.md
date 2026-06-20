# Glossary
Source: https://zapo.to/en/reference/glossary

Definitions of the WhatsApp protocol and zapo terms used across the docs: JID, LID, stanza, prekey, sender key, app-state, coordinator, fanout, Noise.

Short definitions for the terms used across these docs. Most link to the page that covers them in depth.

<h2>
  addon
</h2>

An encrypted follow-up attached to a message — a reaction, poll vote, or comment. Surfaced as the `message_addon` event. See [Receiving messages](/en/guides/receiving-messages#addons).

<h2>
  app-state
</h2>

The channel that syncs per-account settings (mute, pin, archive, read, labels, contacts) across all your devices — separate from messages. Driven via [`client.chat`](/en/reference/chat-mutations).

<h2>
  BinaryNode
</h2>

zapo's representation of a protocol [stanza](#stanza): `{ tag, attrs, content }`. The unit you work with in the [low-level API](/en/reference/low-level#binary-nodes).

<h2>
  broadcast list
</h2>

A business-only list that sends one message to many contacts at once — each receives it as a private 1:1 chat. Distinct from a [newsletter/channel](/en/guides/newsletters). See [Broadcast lists](/en/guides/broadcast-lists).

<h2>
  companion device
</h2>

A linked-device connection (like WhatsApp Web/Desktop) — the default mode. Contrast with [mobile connections](/en/concepts/mobile). See [Authentication](/en/concepts/authentication).

<h2>
  coordinator
</h2>

A focused feature module reached through a getter on the client (`client.message`, `client.group`, …). See [Architecture](/en/concepts/architecture#coordinators).

<h2>
  fanout
</h2>

Encrypting a single message once **per recipient device** and bundling the results into one stanza. See [Architecture in depth](/en/concepts/internals#outgoing-message-pipeline).

<h2>
  IQ
</h2>

A request/response stanza (`<iq type="get|set">` → `result`/`error`), correlated by id. Issue one via [`client.lowlevel.query`](/en/reference/low-level#issuing-an-iq).

<h2>
  JID
</h2>

A WhatsApp address for a user, group, or channel — e.g. `5511999999999@s.whatsapp.net` (user), `...@g.us` (group), `...@newsletter` (channel). See [JID helpers](/en/reference/jid-helpers).

<h2>
  LID
</h2>

A privacy-preserving identifier (`...@lid`) that represents a user **without** exposing their phone number. Prefer it when sending. See [Identities](/en/concepts/identities).

<h2>
  MEX
</h2>

WhatsApp's GraphQL-over-IQ layer, used by newsletter and parts of business. The optional [`argo-codec`](/en/installation#optional-peer-dependencies) peer decodes some MEX responses.

<h2>
  Noise
</h2>

The Noise-protocol handshake that authenticates the server and encrypts every frame after connect. See [The WhatsApp protocol](/en/concepts/protocol#transport--the-noise-handshake).

<h2>
  PN
</h2>

"Phone number" — a phone-number JID (`...@s.whatsapp.net`), as opposed to a [LID](#lid). See [Identities](/en/concepts/identities).

<h2>
  prekey
</h2>

A Signal one-time key used to bootstrap an encrypted session with a new peer. Fetched as part of session setup; an envelope that bootstraps a session is a `pkmsg`.

<h2>
  ratchet
</h2>

The Signal Double Ratchet that encrypts 1:1 messages with forward secrecy. On the wire the envelope is `msg` (established) or `pkmsg` (session-initiating).

<h2>
  sender key
</h2>

The group-encryption scheme (`skmsg`): each member distributes a sender key once, then encrypts group messages symmetrically under it. See [The WhatsApp protocol](/en/concepts/protocol#end-to-end-encryption-signal).

<h2>
  session
</h2>

The Signal protocol state for an encrypted conversation with a peer device, persisted in the [store](#store). Refresh one with `client.message.syncSignalSession`.

<h2>
  stanza
</h2>

A unit of the WhatsApp protocol — a compact binary form of an XMPP-like element. In zapo it's a [`BinaryNode`](#binarynode).

<h2>
  store
</h2>

The pluggable persistence layer that holds auth, Signal state, app-state, and optionally messages/threads/contacts. Built with `createStore`. See [Stores](/en/concepts/stores).

<h2>
  view-once
</h2>

Media that the recipient can open only once. Send it with the `viewOnce` option. See [Media](/en/guides/media#view-once).

<h2>
  write-behind
</h2>

Batched, asynchronous persistence of incoming messages/threads/contacts so the hot path isn't blocked on the database. Tuned via the [`writeBehind`](/en/concepts/configuration#write-behind-persistence) option.

