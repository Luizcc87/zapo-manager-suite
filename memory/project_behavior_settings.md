# Configurações de Comportamento (Behavior Settings)
*Atualizado: 2026-06-22*

O Dashboard do Zapo-Manager possui uma tela de **Configurações > Comportamento** que permite configurar a reação automática da instância a vários eventos do WhatsApp.

## Tabela de Configurações e Mecanismo de Ação

| Chave DB (`settingsConfig`) | Nome no Dashboard | Tipo de Ação | Implementação |
| :--- | :--- | :--- | :--- |
| `groupsIgnore` | Ignorar todas as mensagens de grupos | Filtro local | Aborta o processamento no handler `message` se `event.key.isGroup` for verdadeiro. |
| `alwaysOnline` | Permanecer sempre online | Opção de inicialização | Passa `markOnlineOnConnect: true` nas opções de inicialização do cliente `WaClient`. |
| `readMessages` | Marcar todas as mensagens como lidas | Envio de Receipt | Envia um recibo de leitura (`read`) via `client.message.sendReceipt` para novas mensagens recebidas de terceiros. |
| `readStatus` | Marcar todos os status como visualizados | Envio de Receipt | Intercepta mensagens enviadas ao chat especial `status@broadcast` e envia recibo de leitura (`read`). |
| `rejectCall` | Rejeitar todas as chamadas | Envio de Stanza Customizada | Intercepta o evento `call` do tipo `offer`, constrói um nó BinaryNode do tipo `call` com conteúdo `reject` e envia via `client.lowlevel.sendNode`. |

---

## Detalhes de Rejeição de Chamadas (`rejectCall`)

Como o `zapo-js` não implementa nativamente um método de alto nível para rejeitar chamadas, a rejeição é feita construindo manualmente a stanza de sinalização que o WhatsApp Web envia ao rejeitar uma chamada de áudio ou vídeo:

```typescript
await client.lowlevel.sendNode({
  tag: 'call',
  attrs: { to: toJid, id: Date.now().toString(16) },
  content: [{
    tag: 'reject',
    attrs: {
      'call-id': event.callId ?? '',
      'call-creator': event.callCreatorJid ?? '',
      'count': '0',
    },
  }],
});
```

Se o usuário configurar uma mensagem de recusa (`msgCall`), o bot envia adicionalmente uma mensagem de texto ao chamador usando `client.message.send(toJid, settings.msgCall)`.

---

## Visualização Automática de Status (`readStatus`)

O WhatsApp envia novos status como mensagens de texto ou mídia para o JID fictício `status@broadcast`. O Zapo-Manager marca essas postagens como lidas enviando um recibo convencional para a mensagem:

```typescript
if (settings.readStatus && event.key.remoteJid === 'status@broadcast' && !event.key.fromMe) {
  await client.message.sendReceipt(event, { type: 'read' }).catch(() => {});
}
```
