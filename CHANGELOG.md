# Changelog — zapo-manager

Registro cronológico reverso de implementações e alterações relevantes.

---

## [Unreleased] — 2026-06-20

### Suporte a Mensagens Interativas e Envio de Texto

**Frontend**
- `frontend/src/components/test-interactive-modal.tsx`: Adicionado suporte a aba "Texto" (que dispara `POST /message/sendText/:instanceName`), expandido a contagem de colunas do grid de abas para 6 e adicionada a classe `max-h-[90vh] overflow-y-auto` ao `<DialogContent>` para permitir rolagem de tela nos payloads longos.
- `frontend/src/translate/languages/*.json`: Adicionadas as traduções para a nova aba de texto ("Texto"/"Text"/"Texte") em português, inglês, espanhol e francês.

**Backend**
- `backend/src/routes/message.routes.ts`: Implementados os endpoints `POST /message/sendButtons/:instanceName`, `POST /message/sendList/:instanceName` e `POST /message/sendCarousel/:instanceName` para suportar testes de botões interativos, menus de lista e carrosséis mapeando os payloads recebidos para o formato `zapo-js`. Para evitar que o WhatsApp descarte silenciosamente os templates, as mensagens interativas foram empacotadas em contêineres `viewOnceMessage` e as listas foram convertidas para usar o botão de fluxo nativo `single_select`. Adicionado também o helper `resolveJid` para resolver automaticamente a incompatibilidade de 9 dígitos vs 8 dígitos para todos os envios de mensagens direcionados a números do Brasil.

### Correção de carregamento inicial e navegação do provider Zapo

**Frontend**
- `frontend/src/lib/queries/instance/fetchInstances.ts`: Altera verificação `provider === "api"` para `provider !== "go"`, habilitando a busca automática de instâncias no mount para o provider `"zapo"`.
- `frontend/src/lib/queries/instance/fetchInstance.ts`: Altera verificação `provider === "api"` para `provider !== "go"`, permitindo carregar os detalhes da instância selecionada para o provider `"zapo"`.
- `frontend/src/pages/Dashboard/index.tsx`: Atualiza `isApiProvider` para `provider !== "go"`, exibindo os botões de ação corretos (como Registro Primário) para o provider `"zapo"`.
- `frontend/src/components/footer.tsx`: Atualiza verificação de `enabled` no query do servidor para `provider !== "go"`.
- `frontend/src/components/sidebar.tsx`: Importa `useParams` e implementa fallback de `instanceId` no caminho base dos links da barra lateral, evitando que o link aponte para `/dashboard` (gerando erro 404 no React Router) enquanto o objeto da instância está sendo carregado.
- `frontend/src/components/instance-card.tsx`: Remove as classes de opacidade e hover na linha de botões de ação do card da instância, mantendo os botões visíveis de forma permanente para melhor clareza.
- `frontend/src/pages/instance/DashboardInstance/index.tsx`: Importa `DialogTitle` e corrige avisos do console do Radix UI adicionando título acessível e definindo `aria-describedby` adequadamente nos diálogos de QR Code e Código de Pareamento.

**Backend**
- `backend/src/manager.ts`: 
  - Verifica se o cliente está registrado (`client.getState().registered`) no manipulador de eventos `connection` com status `open` antes de definir o status da instância como `connected` no banco de dados. Isso impede que a tela de QR code seja fechada erroneamente ao abrir a conexão de rede sem o escaneamento do QR code.
  - No manipulador de eventos `connection` com status `close`, se for detectado um logout permanente (`isLogout: true` ou `reason === "stream_error_device_removed"`), executa a limpeza completa dos recursos chamando `disconnectClient()`. Isso remove o cliente do mapa `activeClients` e libera os locks no Redis, garantindo que o status no card do painel mude corretamente para desablitado em vez de ficar preso em "Conectado".
- `backend/src/routes/instance.routes.ts`:
  - No endpoint `GET /instance/fetchInstances`, adiciona suporte para filtragem de instâncias via parâmetros de query `instanceId` ou `instanceName`. Isso resolve a falha em que a navegação para qualquer instância no painel carregava apenas os dados da primeira instância cadastrada no banco de dados.

### Proxy — sticky session, auto-registro de IP, substituição

**Backend**
- `backend/src/routes/config.routes.ts`
  - `testProxyConnectivity`: aplica mesmo sufixo `username-country-session` que `buildProxy` (consistência entre teste e conexão real)
  - `POST /proxy/replace/:instanceName`: solicita substituição do IP do proxy via `PROXY_REPLACE_API_URL` + `PROXY_REPLACE_API_KEY`
  - `DEFAULT_PROXY`: adicionados campos `country` e `session`
  - `GET /proxy/status/:instanceName`: retorna `{enabled, connected, externalIp, latencyMs, proxyUrl, error}`

- `backend/src/manager.ts`
  - `buildProxy()`: compõe usuário com sufixos `-country-session` para roteamento geográfico e sessão fixa em pools backconnect
  - `connectClient`: auto-injeta `session = instanceName` quando `session` está vazio (evita rotação de IP mid-session)

- `backend/src/main.ts`
  - `autoRegisterServerIp()`: detecta IP público via `api.ipify.org` e registra no provedor de proxies via `PROXY_API_KEY` + `PROXY_IP_AUTH_URL` a cada startup

**Frontend**
- `frontend/src/pages/instance/Proxy/index.tsx`
  - Campos `country` (código ISO 2 letras) e `session` (ID de sessão fixa) no formulário
  - `ProxyStatusPanel`: botão "Substituir IP" chama `POST /proxy/replace/:instanceName`

- `frontend/src/types/evolution.types.ts`: `Proxy` type + `country?` e `session?`
- i18n: chaves `proxy.form.country`, `proxy.form.session`, `proxy.status.replace` em pt-BR, en-US, es-ES, fr-FR

**Env vars novas (opcionais)**
| Var | Uso |
|---|---|
| `PROXY_API_KEY` | Chave para auto-registro de IP |
| `PROXY_IP_AUTH_URL` | Endpoint de autorização de IP (POST `{ip_address}`) |
| `PROXY_REPLACE_API_URL` | Endpoint de substituição de proxy |
| `PROXY_REPLACE_API_KEY` | Chave para substituição |

**Commits:** `f6e50f8`, `c2dc0b7`, `d72c451`

---

### Proxy — status visual, badge no card, painel de status

- `GET /proxy/status/:instanceName` — testa conectividade real via `api.ipify.org`
- `frontend/src/lib/queries/proxy/fetchProxyStatus.ts` — hook `useFetchProxyStatus`
- `frontend/src/pages/instance/Proxy/index.tsx` — `ProxyStatusPanel`: IP externo, latência, URL, badge conectado/falhou, botão refresh
- `frontend/src/components/instance-card.tsx` — badge roxo "Proxy" quando `instance.proxyEnabled === true`
- `backend/src/routes/instance.routes.ts` — campo `proxyEnabled` no fetchInstances response
- i18n: chaves `proxy.status.*` e `proxy.badge.*` nos 4 idiomas

**Commit:** `b696bec`

---

### Proxy — suporte nativo via zapo-js

- `backend/src/manager.ts`: `buildProxy()` com `undici.ProxyAgent` (HTTP/HTTPS) + `require('socks-proxy-agent')` / `require('https-proxy-agent')` dinâmico (contorna `moduleResolution: node` incompatível com ESM exports)
- 4 legs: `ws`, `mediaUpload`, `mediaDownload`, `linkPreview`
- `backend/src/routes/config.routes.ts`: rotas `GET/POST /proxy/find|set/:instanceName`
- Schema Prisma: campo `proxyConfig Json?` na tabela `Instance`
- Migration idempotente: `ADD COLUMN IF NOT EXISTS "proxyConfig"`

**Commit:** `fad9994`

---

### zapo-js — correção de eventos e integração

- `backend/src/manager.ts`:
  - `buildStore()` extraído para eliminar duplicação
  - `sendWebhook`: lê `webhookConfig` do DB por instância com filtro de eventos (era env var global)
  - Handlers Baileys mortos removidos; substituídos por handlers zapo-js nativos
  - `client.on('receipt', ...)`: popula `messageStatus` com status de entrega/leitura
  - `settingsConfig` aplicado: `markOnlineOnConnect`, `history.enabled`, `readMessages` (auto-receipt), `groupsIgnore`
  - Eventos wired: `message_addon`, `receipt`, `presence`, `chatstate`, `call`, `group`

**Commit:** `948490d`

---

### Config routes, device envs, provider zapo

- Rotas REST: `GET/POST /settings/find|set`, `GET/POST /webhook/find|set`
- `backend/src/config/device.ts`: `DEFAULT_MOBILE_DEVICE` centralizado com `appVersion`
- `backend/src/config/fetchAndroidWaVersion.ts`: busca versão WA Business no Google Play no startup; fallback hardcoded se falhar
- Variáveis de ambiente: `SESSION_DEVICE_BROWSER`, `SESSION_DEVICE_OS` → `zapo-js` `deviceBrowser`/`deviceOsDisplayName`
- Provider `"zapo"` adicionado ao frontend; integrações incompatíveis marcadas como disabled

**Commit:** `60493f5`

---

### Branding e identidade

- Footer, integration-disabled: "Evolution API" → "zapo-manager-suite" / "Zapo"
- Logo Zapo Manager aplicado nos 6 componentes de UI relevantes

---

### Registro primário SMS/OTP (Fases 1 + 2)

- Frontend: `registrationApi.ts`, `PrimaryRegistrationDialog`, fluxo requestCode/confirmCode
- Backend: endpoints `/registration/request-code` e `/registration/confirm-code`
- Prisma: campo `registeredPhone` na tabela `Instance` (migration idempotente aplicada)
- ⚠️ **Pendente**: `npx prisma generate` no `backend/` (com dev server parado) para regenerar client e habilitar acesso direto ao campo `registeredPhone` sem `$queryRaw`

---

### Docker e infraestrutura

- Build multi-arch `amd64 + arm64` publicado em `lc1868/zapo-manager`
- `docker-stack-swarm.yaml`: rede isolada `zapo-internal` para DB/Redis, `GLOBAL_API_KEY` obrigatória com `:?`, postgres `18-alpine`
- `scripts/build-push.sh`: build + push com tag opcional
- `.env.example`: template com todos os env vars documentados
- Peer deps: `--legacy-peer-deps` necessário (`sharp@0.33.5` vs `baileys` que pede `^0.32.2`)
- Prisma em produção: DLL lock Windows resolvido parando server antes de `generate`

---

## Pendências ativas

| Item | Detalhe |
|---|---|
| `prisma generate` | Regenerar client após adição de `registeredPhone` — parar dev server antes |
| Push origin | 12 commits à frente de `origin/master` |
