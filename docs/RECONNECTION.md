# Diretrizes de Reconexão (docs/RECONNECTION.md)

Este documento reúne os padrões e as melhores práticas recomendadas pelo ecossistema Zapo para gerenciar o ciclo de vida e a reconexão das sessões do WhatsApp.

---

## 1. Comportamento Nativo

Por design de arquitetura, a classe `WaClient` **não reconecta automaticamente** no nível de ciclo de vida da sessão global. Uma vez disparado o evento `connection: close`, o cliente permanece desconectado. 

No entanto, o stack possui duas camadas internas de recuperação automática automática:
* **Transporte WebSocket:** Se a conexão cair *antes* da conclusão do noise handshake, o cliente tenta restabelecer o socket a cada 2 segundos até atingir o limite configurado (`maxReconnectAttempts`).
* **Transição de Pareamento:** Logo após um pareamento (por QR Code ou Pairing Code) bem-sucedido, o socket é reiniciado em modo autenticado sem disparar evento de desconexão externa.

---

## 2. Eventos de Conexão no Manager

O evento `connection` retorna um objeto que informa o novo estado da conexão. No Zapo-Manager, gerenciamos isso no `backend/src/manager.ts`:

```typescript
client.on('connection', async (event) => {
  if (event.status === 'open') {
    // Conexão bem-sucedida
    return;
  }

  // status === 'close'
  const isLogout = event.isLogout || event.reason === 'stream_error_device_removed';
  if (isLogout) {
    // Desconexão permanente por desvinculação (logout)
    // Ações: Limpar banco, credenciais e parar o cliente definitivamente.
  } else {
    // Queda temporária de rede ou reinicialização
    // Ações: Tentar reconectar a instância com política de backoff (se aplicável).
  }
});
```

---

## 3. Configurações Importantes para Estabilidade

### Auto-recovery de WA Web Version (`client_too_old`)
Para contornar o bloqueio de versão do WhatsApp Web (HTTP 405), habilitamos a flag de recuperação automática nas opções de inicialização do cliente:
```typescript
const clientOptions = {
  // ...
  recoverFromClientTooOld: true,
  // ...
};
```
Isso faz com que o cliente busque a última versão diretamente do site `web.whatsapp.com/sw.js` e se reconecte de forma transparente quando ocorrer erro de versão desatualizada.

### Desconexão Graciosa (Graceful Shutdown)
Para restarts de contêiner ou interrupções de processo sem corromper as credenciais do banco e mantendo a sessão do WhatsApp ativa no celular (sem desvincular), rodamos o método de desconexão limpa:
```typescript
await client.disconnect();
```
Isso desliga o socket e finaliza os processos de sincronização pendentes sem deletar a sessão.
