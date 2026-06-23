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

4.  **Triagem Formal de Releases:**
    Para evitar retrabalho ao consumir upstreams diferentes, use o workflow e o script `scripts/zapo-release-triage.mjs` como padrão de triagem antes de implementar qualquer mudança:
    - `--mode zapo` para releases de `vinikjkkj/zapo`
    - `--mode baileys` para releases de `WhiskeySockets/Baileys`
    - `--mode evolution` para sync do `evolution-foundation/evolution-manager-v2`
    - `--mode auto` quando a URL permitir inferência automática do upstream
    - `--evolution-api` quando for necessário validar o contrato da API local e o `docs/openapi.yaml`
    O relatório deve sair com triagem, checklist de implementação, checklist de testes, atualização sugerida do `CHANGELOG.md`, review por modo e próximos passos.

---

## 🔒 Concorrência e Segurança de Sessão (Swarm Safety)

O WhatsApp pune conexões simultâneas de uma mesma sessão com banimento do número. A arquitetura resolve isso com locks distribuídos no Redis implementados no [manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts):

*   **Bloqueio de Inicialização:** Antes de iniciar o `WaClient.connect()`, o backend tenta obter a posse do lock `lock:zapo:<instanceName>` com um TTL de 30 segundos.
*   **Loop de Renovação:** Uma vez obtido, um timer roda a cada 10 segundos para renovar a validade do lock.
*   **Perda do Lock:** Se a renovação falhar (por exemplo, devido a um gargalo de rede ou falha de container), o contêiner se desconecta imediatamente do WhatsApp e encerra os processos filhos.
*   **Regra de Implantação:** O deploy no Docker Compose ou Swarm deve ter sempre `replicas: 1` e política de update `stop-first` (parar réplica antiga para liberar o lock antes de iniciar a nova).

---

## 📦 Gestão de Versões do WhatsApp

O sistema lida com **dois espaços de versão independentes**. Confundi-los causa falhas silenciosas difíceis de diagnosticar.

### Versão WA Web (`2.3000.x`)

Usada nas conexões por QR code / browser emulation. O Zapo possui **auto-recovery nativo**:

- `recoverFromClientTooOld: true` está habilitado em `clientOptions` de `manager.ts`
- Ao receber `failure_client_too_old`, o `WaClient` chama `fetchLatestWaWebVersion()` que lê o `client_revision` de `web.whatsapp.com/sw.js` e reconecta automaticamente
- **Nenhuma ação manual necessária** para este espaço

### Versão WA Business Android (`2.24.x.x`)

Usada nas conexões mobile TCP (`mobileTransport`). Campo `deviceInfo.appVersion`. O Zapo **não tem auto-recovery** para este espaço — `recoverFromClientTooOld` só injeta versão Web, o que não funciona para mobile.

**Estratégia implementada:**

| Momento | Ação |
|---|---|
| Startup | `fetchLatestAndroidWaVersion()` busca a versão atual no Google Play Store |
| Sucesso | `setAppVersion(version)` atualiza o runtime antes de reconectar instâncias |
| Falha de rede / HTML mudou | Usa `DEFAULT_MOBILE_DEVICE.appVersion` como fallback hardcoded |
| `confirmCode` | `getMobileDevice()` usa sempre a versão runtime resolvida |
| Reconexão de instância existente | `instance.deviceInfo` (salvo no DB no momento do registro) tem precedência |

**Arquivos relevantes:**
- `backend/src/config/device.ts` — fonte única da config de device + `getMobileDevice()`
- `backend/src/config/fetchAndroidWaVersion.ts` — fetcher Play Store + documentação dos patterns

**Quando o fetcher quebrar** (Google muda o HTML do Play Store):
1. Inspecionar HTML de `https://play.google.com/store/apps/details?id=com.whatsapp.w4b&hl=en&gl=US`
2. Atualizar `VERSION_PATTERNS` em `fetchAndroidWaVersion.ts`
3. Atualizar o fallback `appVersion` em `device.ts`

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

### 5. Mensagens Interativas e Formatação de JID (WhatsApp Web)
*   **Empacotamento com `viewOnceMessage`**: Todas as mensagens interativas (`buttons`, `list`, `carousel`) enviadas via `interactiveMessage` devem ser envelopadas em uma estrutura `viewOnceMessage` (ex: `viewOnceMessage: { message: { interactiveMessage: ... } }`). Sem isso, o cliente de destino descartará silenciosamente a mensagem recebida.
*   **Listas com `single_select`**: Menus de listas interativas devem ser implementados usando botões de fluxo nativo `single_select` em vez do template antigo `listMessage` (depreciado pelo WhatsApp em contas pessoais/companion).
*   **JID sem o '9' extra**: No Brasil, contas antigas utilizam o formato JID sem o dígito `9` (ex: `555599703107@s.whatsapp.net`). Se as mensagens de texto ou interativas retornarem sucesso mas não forem entregues, valide se o JID correto na rede do WhatsApp não omite o `9` extra de celular.
*   **Cache de JID (`resolvedJidCache`)**: O helper `resolveJid` utiliza um cache em memória (`Map`) para evitar consultas repetidas à rede do WhatsApp. A primeira mensagem para um número inédito faz o lookup no WhatsApp e armazena o resultado; envios subsequentes lêem o JID resolvido instantaneamente do cache em `O(1)`.

---

## 🧪 Testes Automatizados (Playwright)

O projeto possui uma suíte de testes de integração implementada com **Playwright** que valida a criação de instâncias, o ciclo de vida da conexão, e as regras de segurança/autorização de API.

*   **Arquivo de Configuração:** [playwright.config.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/playwright.config.ts)
*   **Testes Integrados:** [tests/zapo.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo.spec.ts)
*   **Setup Global:** [tests/global-setup.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/global-setup.ts)

### Como rodar os testes localmente:
1. Certifique-se de que a instância Redis esteja rodando (geralmente via Docker `docker compose up -d redis`).
2. Execute o comando na raiz:
   ```bash
   npx playwright test
   ```

### 🧠 Ciclo de Vida e Aprendizados Resolvidos:
- **Limpeza de Redis Automatizada:** O `global-setup.ts` limpa automaticamente os locks ativos (`lock:zapo:*`) do Redis local antes do início dos testes usando o `ioredis` instalado. Isso evita que locks fantasmas travem a reconexão.
- **Gerenciamento de Processos (Anti-Zombies):** O Playwright está configurado para gerenciar o backend. Ele executa `npm run dev` na porta `8080` de forma segura. Se o servidor backend já estiver rodando, ele é reaproveitado. Se não, o Playwright inicia o servidor e garante o seu desligamento imediato e completo no fim do ciclo de testes.

---

## 🐳 Build & Publicação Docker Hub (Multi-arch)

Para garantir que a imagem oficial funcione tanto em ambientes Intel/AMD (`amd64`) quanto ARM (como servidores Oracle ARM, Raspberry Pi, Macs com Apple Silicon), sempre publique imagens usando build multi-arch.

> [!IMPORTANT]
> **REGRA OBRIGATÓRIA DE COMPILAÇÃO:** Toda compilação e publicação de imagens Docker do projeto (seja manual ou automatizada) deve obrigatoriamente gerar as duas arquiteturas: `linux/amd64` e `linux/arm64` em conjunto. Nunca publique imagens com apenas uma arquitetura para produção.

*   **Configuração de Buildx:** Requer a criação de um builder do tipo `docker-container` (ex: `evo-multiarch`).
*   **Script Automatizado:** [scripts/build-push.sh](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/scripts/build-push.sh)

### Como publicar uma nova versão:
1. Certifique-se de estar logado no Docker Hub (`docker login`).
2. Execute o script definindo a tag (ou use `latest` por padrão):
   ```bash
   # Compila para linux/amd64 e linux/arm64 e publica no Docker Hub
   bash scripts/build-push.sh v1.2.0
   ```
3. Consulte as instruções detalhadas em [docs/DOCKER.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/docs/DOCKER.md).

---

## 🛠️ Metodologia BMAD (BMAD Method v6.9.0)

O projeto utiliza a metodologia **BMAD (Build More, Architect Dreams)** para especificação, arquitetura, design e testes. 

### Diretrizes Operacionais (v6.9.0):
*   **Executor de Scripts (`uv run`):** A partir da v6.9.0, todos os scripts Python do BMAD e customizações devem ser executados usando `uv run <script>` em vez de `python3` diretamente. O suporte a `python3` direto será removido na v7.
*   **Espinha Dorsal da Arquitetura (`ARCHITECTURE-SPINE.md`):** É o ponto focal de design técnico e fonte única de verdade arquitetural. As especificações (`SPEC.md`) derivam diretamente dela.
*   **Memória Compartilhada (`_bmad/scripts/memlog.py`):** Centraliza o log de progresso cognitivo dos agentes de forma unificada.
*   **Novas Ferramentas:** Use `bmad-forge-idea` para validação socrática de conceitos iniciais, e `bmad-architecture` para o design arquitetural.

Para mais detalhes e o guia completo, consulte [docs/BMAD_METHOD.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/docs/BMAD_METHOD.md).

---

## 🧠 Memória Persistente (Claude Code)

A pasta `memory/` contém arquivos de memória do Claude Code que persistem contexto entre sessões.

**Ao iniciar qualquer sessão de desenvolvimento, ler:**

| Arquivo | O que contém |
|---|---|
| `memory/MEMORY.md` | Índice — carregado automaticamente pelo Claude |
| `memory/user_profile.md` | Perfil do dev: nível técnico, preferências de resposta |
| `memory/project_zapo_manager.md` | Contexto do projeto: stack, remotes, arquitetura |
| `memory/project_primary_registration.md` | Status do fluxo SMS/OTP e pendências |
| `memory/project_sync_workflows.md` | Regras de triagem de sync para `zapo-js`, `Baileys` e `evolution-manager-v2` |
| `memory/feedback_workflow.md` | Como o dev gosta de trabalhar (aprovar plano, revisar diff, master direto) |
| `memory/reference_key_files.md` | Mapa dos arquivos-chave do projeto |

**Regras:**
- Não modificar esses arquivos manualmente — são atualizados pelo Claude durante as conversas
- Não versionar no git público (adicionar `memory/` ao `.gitignore` se necessário)
- Complementam o `CHANGELOG.md` — memória guarda **quem/como**, changelog guarda **o quê/quando**

---

## 📋 CHANGELOG — Regra Obrigatória

**Todo commit relevante deve ter entrada correspondente em [CHANGELOG.md](CHANGELOG.md).**

### O que registrar

| Tipo | Registrar? |
|---|---|
| Nova feature / endpoint | ✅ Sim |
| Bugfix com impacto em comportamento | ✅ Sim |
| Mudança de schema / migration | ✅ Sim |
| Nova variável de ambiente | ✅ Sim |
| Refactor interno sem impacto externo | Opcional |
| Chore (lint, formatação, deps) | ❌ Não |

### Formato de entrada

```markdown
## [Unreleased] — YYYY-MM-DD

### Título curto da feature

**Backend** / **Frontend** / **Infra**
- `caminho/do/arquivo.ts`: o que mudou e por quê
- Variáveis de ambiente novas (tabela se houver múltiplas)

**Commits:** `hash1`, `hash2`
```

### Regras

- Usar `[Unreleased]` até o release ser tagueado
- Manter ordem cronológica reversa (mais novo no topo)
- Seção **Pendências ativas** no final — atualizar ao concluir cada item
- Ao iniciar nova sessão de desenvolvimento: ler `CHANGELOG.md` antes de implementar para evitar duplicações
