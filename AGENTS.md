# Guia para Desenvolvedores e Agentes de IA (AGENTS.md)

Este documento descreve as diretrizes arquiteturais, os padrões de código e a estratégia de sincronização com o upstream para o projeto **Zapo-Manager**.

**Repositório:** `git@github.com:Luizcc87/zapo-manager-suite.git`
Clone simples — **sem** `--recurse-submodules`:
```powershell
git clone https://github.com/Luizcc87/zapo-manager-suite.git
```

---

## 🎯 Filosofia de Integração e Upstream Sync

O frontend (`frontend/`) e o backend (`backend/`) são mantidos dentro do mesmo repositório (monorepo), mas devem permanecer **arquiteturalmente isolados**.

1.  **Modificação Mínima no Frontend:**
    Para que possamos realizar atualizações frequentes a partir do repositório oficial do mantenedor original (`evolution-foundation/evolution-manager-v2`), **não modifique o código React/Vite** a menos que seja estritamente necessário.
2.  **Resolução de Incompatibilidades no Backend:**
    Qualquer nova funcionalidade exibida na UI do Evolution Manager v2 deve ser tratada no backend emulando os payloads esperados pela Evolution API v2. Se o Manager v2 solicitar um endpoint inexistente ou um formato específico, intercepte-o e molde o retorno em `backend/src/routes`.
3.  **Atualização de Upstream do Frontend:**
    Como o frontend é gerenciado via `git subtree`, para sincronizar o painel com as novas releases do mantenedor original, execute na raiz do monorepo:
    ```powershell
    # Configurar remote uma única vez (caso não exista)
    git remote add upstream-frontend https://github.com/evolution-foundation/evolution-manager-v2.git

    git fetch upstream-frontend
    git subtree pull --prefix=frontend upstream-frontend main --squash
    ```
    Ver fluxo completo (branch de teste, resolução de conflitos) em `docs/SYNC-UPSTREAM.md`.

---

## 🔒 Concorrência e Segurança de Sessão (Swarm Safety)

O WhatsApp pune conexões simultâneas de uma mesma sessão com banimento do número. A arquitetura resolve isso com locks distribuídos no Redis implementados no [manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts):

*   **Bloqueio de Inicialização:** Antes de iniciar o `WaClient.connect()`, o backend tenta obter a posse do lock `lock:zapo:<instanceName>` com um TTL de 30 segundos.
*   **Loop de Renovação:** Uma vez obtido, um timer roda a cada 10 segundos para renovar a validade do lock.
*   **Perda do Lock:** Se a renovação falhar (por exemplo, devido a um gargalo de rede ou falha de container), o contêiner se desconecta imediatamente do WhatsApp e encerra os processos filhos.
*   **Regra de Implantação:** O deploy no Docker Compose ou Swarm deve ter sempre `replicas: 1` e política de update `stop-first` (parar réplica antiga para liberar o lock antes de iniciar a nova).

---

## ⚠️ Regras Técnicas de Desenvolvimento (TypeScript & Zapo)

Ao realizar modificações no backend, siga estritamente estas diretrizes de tipagem e API da biblioteca Zapo:

### 1. Eventos de Conexão
*   O evento `connection` emitido por `WaClient` retorna um objeto do tipo `WaConnectionEvent`.
*   **Nunca** compare o objeto de evento diretamente com uma string (ex: `event === 'open'`). Em vez disso, avalie `event.status === 'open'` ou `event.status === 'close'`.
*   O status de conexão imediata de um cliente ativo pode ser consultado via `active.client.getState().connected` (retorna boolean).

### 2. Mapeamento de Eventos de Mensagem
*   O evento `message` emitido pelo Zapo usa o campo `timestampSeconds` para o horário Unix da mensagem. Evite o uso de `messageTimestamp`.

### 3. Envio de Mensagens de Mídia
*   O método `active.client.message.send(jid, content)` exige estruturas bem definidas.
*   Para documentos, o nome de arquivo em disco ou exibição no chat deve ser definido na propriedade `fileName` (com o "N" maiúsculo) e não `filename`.
*   Para stickers, utilize a propriedade nativa `type: 'sticker'` com o mimetype `image/webp`.

### 4. Prisma ORM
*   As informações e chaves das instâncias persistidas localmente ou em nuvem estão mapeadas em `zapo-manager/backend/prisma/schema.prisma`.
*   Sempre que realizar mudanças no schema, execute:
    ```bash
    npx prisma generate
    ```
    Isso assegura que o autocomplete e as checagens do compilador TypeScript reflitam as alterações no código de rotas do Express.
