# Broadcast lists
Source: https://zapo.to/en/guides/broadcast-lists

Define a WhatsApp broadcast list with zapo and send a single message to many recipients at once without creating a group or revealing the list.

A **broadcast list** sends a single message to many contacts at once — each recipient receives it as a normal 1:1 chat and can't see who else is on the list. Broadcast lists live on `client.broadcastList` ([`WaBroadcastListCoordinator`](/en/reference/client#broadcastlist)).

<Badge icon="briefcase">Business-only</Badge>

<Warning>
  **Business-only.** Broadcast lists are backed by the `BusinessBroadcastList` app-state schema and only work on **WhatsApp Business** accounts. On a regular account the server rejects the underlying mutations.
</Warning>

## Defining a list

`setList` creates or updates a list definition — it then appears under **Broadcast lists** on the phone, synced through [app-state](/en/concepts/stores). Participants are identified by their [LID](/en/concepts/identities) (`lidJid`), optionally paired with the phone-number JID (`pnJid`):

```ts theme={null}
await client.broadcastList.setList({
  id: 'list-1',
  listName: 'Friends',
  participants: [
    { lidJid: 'a@lid', pnJid: 'a@s.whatsapp.net' },
    { lidJid: 'b@lid' }
  ],
  labelIds: ['L1'] // optional — attach business labels
})
```

Remove a list by its `id`:

```ts theme={null}
await client.broadcastList.removeList('list-1')
```

## Sending to a list

`send` takes the same [content union](/en/guides/sending-messages#the-content-union) as `client.message.send` — text, media, polls, and so on — plus the broadcast `listJid` (the list `id` with an `@broadcast` suffix) and the explicit `recipients` to fan out to:

```ts theme={null}
const result = await client.broadcastList.send({
  listJid: 'list-1@broadcast',
  content: 'Weekend sale starts now! 🎉',
  recipients: ['a@lid', 'b@lid']
  // options: { ... }  // same shape as client.message.send options
})

console.log(result.id) // the published message id
```

Each recipient is encrypted for individually (a fanout), so a single `send` call is effectively N direct sends behind one request. Pass the usual [send options](/en/guides/sending-messages#send-options-reference) through `options`.

<Note>
  Broadcast lists are not [newsletters/channels](/en/guides/newsletters): a broadcast reaches your existing contacts as private 1:1 messages, while a channel is a public, follower-based feed.
</Note>

## Related

<CardGroup>
  <Card title="Client reference" icon="code" href="/en/reference/client#broadcastlist">
    Full `client.broadcastList` method signatures.
  </Card>

  <Card title="Identities (PN vs LID)" icon="id-card" href="/en/concepts/identities">
    Why participants are keyed by LID.
  </Card>
</CardGroup>

