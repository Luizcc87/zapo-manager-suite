# Changelog — zapo-manager

Registro cronológico reverso de implementações e alterações relevantes.

---

## [Unreleased] — 2026-07-20

## [1.6.6] — 2026-07-20

### Fix: Unificação do Modal de Conexão no Dashboard

**Frontend**
- `frontend/src/pages/instance/DashboardInstance/index.tsx`: Removido os diálogos redundantes (antigo QR e antigo pareamento do Radix UI/Shadcn) que eram exibidos quando `isGo` era falso. Agora o dashboard sempre utiliza o `GoQrCodeModal` robusto unificado. Isso ativa os logs verbosos e o fluxo fixado de CSS/pareamento também para instâncias locais/não-Go.

## [1.6.5] — 2026-07-20

### Fix: Scrollbar e Overflow no DialogContent

**Frontend**
- `frontend/src/pages/instance/DashboardInstance/GoQrCodeModal.tsx`: Movido o comportamento de `overflowY: "auto"` e limites de altura para o container pai `DialogContent` do Radix UI, prevenindo o overflow vertical e o bug de clipping da tela fora da viewport do navegador.

## [1.6.4] — 2026-07-20

### Fix: CSS Inline no Modal do QR e Logs Verbosos

**Frontend**
- `frontend/src/pages/instance/DashboardInstance/GoQrCodeModal.tsx`: Substituídos os seletores de classe do Tailwind (`!flex`, `!flex-col`) por CSS inline nativo (`display: "flex"`, `flexDirection: "column"`, `maxHeight: "85vh"`, `overflow: "hidden"`) no wrapper principal do Radix UI. Isso força o navegador a respeitar a altura máxima mesmo em frameworks css restritivos.
- Adicionados logs verbosos detalhados no console do navegador (`[GoQrCodeModal]`) para rastrear o fluxo exato de ações de montagem do modal, polling de status e geração do código de pareamento.

## [1.6.3] — 2026-07-20

### Fix: Bypass de Mutation no Pareamento e Grid do Dialog

**Frontend**
- `frontend/src/pages/instance/DashboardInstance/GoQrCodeModal.tsx`: Bypass da mutation do React Query ao requisitar o código de pareamento, usando Axios diretamente para evitar conflito com a mutation ativa do QR code.
- Correção de overflow do Dialog ajustando a ordem dos elementos flex-shrink e flex-1.

## [1.6.2] — 2026-07-20

### Fix: Código de Pareamento infinito e Overflow do Modal QR

**Backend**
- `backend/src/routes/instance.routes.ts`: Corrigido fluxo de geração de código de pareamento. Quando a instância já estava ativa em modo QR aguardando escaneamento, a chamada `requestPairingCode` não retornava código (a janela `auth_pairing_required` já havia passado). Agora a rota desconecta e reconecta a instância com `phoneNumber`, forçando o SDK a emitir `auth_pairing_required` novamente e gerar o código. Janela de polling ampliada de 10s para 12s.



### Conexão via Código de Pareamento (Phone Number Link) e Fix de Logout

**Backend**
- `backend/src/manager.ts`: Limpeza de `ownerJid`, `profileName` e `profilePicUrl` no banco quando ocorre uma desconexão por logout (`isLogout: true`), permitindo que instâncias desemparelhadas voltem para o fluxo de QR code em vez de entrarem em loop de reconexão. Exposto método `logoutClient` e o helper `clearSessionStore` que realizam a limpeza e removem os tokens/credentials de autenticação persistidos no banco de dados e Redis.
- `backend/src/manager.ts`: Adicionado suporte a `phoneNumber` no método `connectClient` e escuta ao evento `auth_pairing_required` para requisitar o código de pareamento de 8 dígitos através do SDK.
- `backend/src/routes/instance.routes.ts`: Rota de `/logout` atualizada para invocar `ZapoManager.logoutClient` a fim de garantir a limpeza dos campos de autenticação no banco e no Redis.
- `backend/src/routes/instance.routes.ts`: Rota `GET /connect/:instanceName` estendida para suportar o parâmetro query `number` e retornar `{ pairingCode }`. Incluída lógica de espera de até 10 segundos para retorno do código.
- `backend/src/routes/instance.routes.ts`: Retorna o número de telefone da instância (`number`) incondicionalmente no endpoint `/fetchInstances` (mesmo com a instância desconectada), extraído do `registeredPhone`, `ownerJid` ou dos dígitos do próprio nome da instância (como `DC-555596773757`), permitindo que a interface do frontend renderize o botão de "Conectar com código de pareamento" para instâncias mobile/desconectadas.

### Upgrade Zapo-JS para v1.6.0

**Backend**
- `backend/package.json`: Atualizado `zapo-js` para `^1.6.0` (expondo as novas capacidades `client.message.upload()` e `WaMediaCrypto`).

**Infra**
- `docker-compose.yml`: Rebaixada a imagem PostgreSQL local de `postgres:18-alpine` para `postgres:16-alpine` para manter compatibilidade simples de inicialização de volumes locais de desenvolvimento sem problemas de formato de diretório.

## [Unreleased] — 2026-07-12

### Link preview com thumbnail no envio de texto

**Backend**
- `backend/src/routes/message.routes.ts`: normaliza `linkPreview.thumbnail.bytes` recebido por JSON para `Uint8Array`/base64 antes de chamar `zapo-js`, preservando o caminho oficial de `thumbnail-link`.
- `backend/src/routes/message.routes.ts`: aceita `textMessage.text` no formato Evolution API v2 e `preview`/`linkPreviewHighQuality` no estilo WAHA para preview customizado com `image.url` ou `image.data`.
- `backend/src/routes/message.routes.ts`: mantém compatibilidade com payload legado `text.linkPreview.image` e não aborta o envio se a imagem externa do preview falhar.
- `backend/src/routes/message.routes.ts`: usa `og:image`/`twitter:image` da URL do preview como fallback quando a imagem informada falha ou não é enviada.
- `backend/src/routes/message.routes.ts`: transforma `text` simples com URL e `linkPreview: true` em preview manual com metadados Open Graph para também enviar thumbnail.
- `frontend/src/components/test-interactive-modal.tsx`: remove dependência de `httpbin.org` no exemplo de link preview, usando a própria URL do produto para resolver a imagem.
- `backend/src/manager.ts`: habilita explicitamente `linkPreview.enabled` e `uploadHqThumbnail` nas opções do `WaClient`.
- `docs/openapi.yaml`: documentado o contrato compatível com Evolution/Uazapi e a extensão WAHA-like de custom preview.

**Infra**
- `scripts/build-push.sh`: passa a publicar por padrão a tag `zapo-js-<versao-resolvida>` junto com `latest`, preservando multi-arch `linux/amd64` e `linux/arm64`.
- `docs/DOCKER.md`: documentado o versionamento da imagem Docker por versão resolvida do `zapo-js`.

### Suite Playwright de UI real com backend em janela própria

**Testes**
- `tests/zapo-manager-ui-real.spec.ts`: nova suite Playwright cobrindo login, dashboard, criacao de instancia, navegacao entre abas, troca de idioma e persistencia de settings/webhook contra backend real sem mock de rede.
- `tests/playwright/manager-ui-real.config.ts`: nova configuracao Playwright para a suite de UI real.
- `scripts/start-backend-window.ps1`: helper que abre o backend em janela propria e aguarda a porta 8080 ficar disponivel.
- `.agents/skills/zapo-manager-test-runner/SKILL.md`: adicionado o modo `ui-real`.
- `.agents/skills/zapo-manager-test-runner/scripts/run-manager-tests.ps1`: adicionado o modo `ui-real`.

**Infra**
- `package.json`: adicionado `test:manager:ui:real`.

**Documentacao**
- `docs/zapo/manager-local-tests.md`: documentada a quarta camada de testes e o requisito de backend visivel.

### Renderização segura de stickers no chat

**Frontend**
- `frontend/src/pages/instance/Chat/messages.tsx`: stickers passam a renderizar apenas `mediaUrl` ou `base64` de mídia já decriptada, evitando usar diretamente a URL `.enc` criptografada do CDN do WhatsApp.

### Estrutura local de testes do Manager

**Testes**
- `tests/helpers/manager-fixtures.ts`: adicionadas fixtures compartilhadas para instancias temporarias, payloads interativos e mocks da API usada pelo frontend.
- `tests/zapo-manager-endpoints.spec.ts`: criada suite offline-safe para validar endpoints Express, auth, configuracoes, webhook, proxy, chat, contato, companion/e-mail e payloads interativos sem exigir WhatsApp conectado.
- `tests/zapo-manager-ui.spec.ts`: criada suite de UI com API mockada para validar botoes e funcoes principais do frontend Manager.
- `tests/playwright/manager-ui.config.ts`: configuracao dedicada para subir apenas o Vite frontend nos testes de UI.
- `.agents/skills/zapo-manager-test-runner`: criada skill local BMAD/Codex para executar os gates `test:manager:*` e reportar evidencias.

**Documentacao**
- `docs/zapo/manager-local-tests.md`: documentado o uso das camadas API offline, UI mockada e smoke real opt-in.
- `docs/BMAD_METHOD.md` e `AGENTS.md`: atualizados para refletir BMAD Method v6.10.0, `bmad-loop` e a skill local de testes.

**Infra**
- `package.json`: adicionados scripts `test:manager:api`, `test:manager:ui` e `test:manager`.

### Suporte a Recursos Avançados do zapo-js (Companions, Email e Alertas)

**Backend**
- [backend/prisma/schema.prisma](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/prisma/schema.prisma): Adicionadas tabelas `WaCompanionHostEpoch` e `WaCompanionDevice` para persistência atômica do estado de época e metadados de companions hospedados.
- [backend/src/companions/companionHostPersistence.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/companions/companionHostPersistence.ts): Criado adaptador de persistência transacional (`prisma.$transaction`) integrado nas opções do `WaClient` mobile.
- [backend/src/routes/companion.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/companion.routes.ts): Criados 10 novos endpoints HTTP mapeados 1-para-1 com os recursos avançados de companions e e-mail do `zapo-js`.
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): Adicionado listeners para os 5 novos eventos de segurança e ciclo de companions (`mobile_registration_code`, `mobile_account_takeover_notice`, `companion_host_linked`, `companion_host_revoked`, `companion_host_error`) repassando-os ao Socket.io.
- [backend/src/main.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/main.ts): Registrado o novo roteador de companions.

**Frontend**
- [frontend/src/pages/instance/DashboardInstance/CompanionsPanel.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/instance/DashboardInstance/CompanionsPanel.tsx): Novo painel de gerência, reconciliação e pareamento de companions para instâncias móveis.
- [frontend/src/pages/instance/Settings/EmailSecurityPanel.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/instance/Settings/EmailSecurityPanel.tsx): Novo painel guiado de 5 etapas para fluxo de e-mail de segurança.
- [frontend/src/pages/instance/DashboardInstance/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/instance/DashboardInstance/index.tsx): Integrados os dois painéis no final da tela e banners de alerta em tempo real baseados em eventos do Socket.io.
- [frontend/src/translate/languages/](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/translate/languages/): Injetadas chaves sob o namespace `zapoMobile` com suporte completo a i18n em pt-BR, en-US, es-ES e fr-FR.

### Upgrade Zapo-JS para v1.5.0

**Backend**
- [backend/package.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/package.json): Atualizado `zapo-js` para `^1.5.0` (suporte a mobile-primary companion, analytics WAM, wa-mobile version fetcher, recuperação automática de erro 405 e ciclo de reinicialização de plugins pós-reconexão).

**Documentação**
- [docs/zapo_connection_modes.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/docs/zapo_connection_modes.md): Adicionado detalhamento sobre o funcionamento e limitações do protocolo Shortcake/Passkeys (vinculação por chave de acesso).

## [Unreleased] — 2026-07-03

### Exibição da versão do Zapo no Sidebar

**Backend**
- [backend/src/main.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/main.ts): Adicionado helper `getZapoLibVersion` e exposta a propriedade `zapoVersion` na rota `GET /`.

**Frontend**
- [frontend/src/components/sidebar.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/components/sidebar.tsx): Consome a propriedade `zapoVersion` do `serverInfo` e a exibe no sidebar do manager.

### Upgrade Zapo-JS para v1.4.0

**Backend**
- [backend/package.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/package.json): Atualizado `zapo-js` para `^1.4.0` (Shortcake passkey companion-linking protocol e correção de retentativas de pkmsg sem device-identity).

**Commits:** pendente

## [Unreleased] — 2026-06-30

### Upgrade Zapo-JS para v1.3.0

**Backend**
- [backend/package.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/package.json): Atualizado `zapo-js` para `^1.3.0` (suporte a VoIP e expiração no Redis). Mantidos os adaptadores de store em `^1.0.2` por estarem na última versão estável disponível no npm.

**Commits:** `b2bc349`

## [Unreleased] — 2026-06-29

### Upgrade de Dependências e Desativação de OTP/SMS

**Backend**
- [backend/package.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/package.json): Atualizado `@whiskeysockets/baileys` para `7.0.0-rc13` (ESM) e `zapo-js` para `1.2.1` (com os adaptadores de store correspondentes atualizados para `1.0.2`).
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): Comentados os imports legados do Baileys v6 removidos no v7. Refatoradas as rotas `/instance/register/requestCode` e `/instance/register/confirmCode` para validar os parâmetros obrigatórios e retornar `400 Bad Request` informando que o registro via OTP foi desativado na versão atual da biblioteca Baileys, exigindo importação direta de credenciais.

**Documentação**
- [docs/superpowers/plans/2026-06-19-primary-registration-sms-otp.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/docs/superpowers/plans/2026-06-19-primary-registration-sms-otp.md): Adicionada nota de atualização informando sobre a desativação do fluxo no Baileys v7.
- [memory/project_primary_registration.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/memory/project_primary_registration.md): Atualizado o estado da Fase 2 para registrar o upgrade de versão e a inatividade das rotas SMS/OTP.

**Commits:** `ab42343`

## [Unreleased] — 2026-06-23

### Fix: botão e toast do OTP refletem SMS ou ligação

**Frontend**
- [frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx): O botão de solicitação e o toast de sucesso agora exibem texto específico para SMS ou ligação conforme o método selecionado, evitando indicar "Enviar código SMS" quando o payload está usando `method: "voice"`.
- [frontend/src/translate/languages/pt-BR.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/translate/languages/pt-BR.json), [frontend/src/translate/languages/en-US.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/translate/languages/en-US.json), [frontend/src/translate/languages/es-ES.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/translate/languages/es-ES.json), [frontend/src/translate/languages/fr-FR.json](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/translate/languages/fr-FR.json): Adicionadas chaves separadas para textos de SMS e ligação.

### Fix: classificação correta de erro OTP quando WhatsApp retorna objeto

**Backend**
- [backend/src/config/otpErrors.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/config/otpErrors.ts): `classifyOtpRegistrationError` agora serializa objetos de rejeição do WhatsApp corretamente e detecta `reason: "blocked"` mesmo quando o erro chega como objeto puro, evitando resposta genérica `500` com `"[object Object]"`.

**Testes**
- [backend/src/tests/otp-errors.test.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/tests/otp-errors.test.ts): Adicionado caso cobrindo retorno OTP bloqueado como objeto.

### Debug: `_socketEmitter` do OTP loga `requestId`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): Os emits de socket gerados pelo `connectClient` do fluxo OTP agora passam por um wrapper que loga `requestId` explicitamente no terminal antes de emitir `connection.update`, `messages.upsert`, `messages.update` e `history.sync`.

### Debug: `sendWebhook` interno loga `requestId`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): `sendWebhook` agora extrai `requestId` do payload OTP, inclui o identificador no log do terminal e também no log de retries/falha definitiva.

### Debug: eventos de webhook/socket do OTP carregam `requestId`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): Os eventos emitidos pelo `connectClient` acionado no fluxo OTP agora incluem `requestId` em `connection.update`, `messages.upsert`, `messages.update`, `presence.update`, `chats.update`, `call`, `groups.update` e `history.sync`, além dos logs do caminho de conexão.

### Debug: `requestId` também em `connectClient`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): `connectClient` recebeu `requestId` opcional e agora registra lock, proxy, QR, pareamento, fechamento e eventos de mensagem com o mesmo identificador.
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): O `requestId` do fluxo OTP agora é repassado ao `connectClient` final após o `confirmCode`.

### Debug: `requestId` também em `saveCredentials` e `disconnectClient`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): `saveCredentials` e `disconnectClient` receberam `requestId` opcional e passaram a registrar início/fim/limpeza com o mesmo identificador.
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): O fluxo OTP agora encaminha o `requestId` para a persistência de credenciais e para a desconexão do cliente anterior.

### Debug: `requestId` alcança `ZapoManager.createClient`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): `createClient` recebeu `requestId` opcional e agora registra início, reaproveitamento de instância e fim da criação com o mesmo identificador.
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): `POST /create` passou a encaminhar `requestId` para `ZapoManager.createClient`.

### Debug: `requestId` também nas transições finais do `confirmCode`

**Backend**
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): O fluxo de `confirmCode` agora loga `requestId` ao salvar credenciais no store, desconectar o cliente anterior, atualizar `ownerJid`/status no banco e despachar o `connectClient` em background.

### Debug: `requestId` de OTP também em create e persistência de `registeredPhone`

**Backend**
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): `POST /create` agora aceita `requestId` opcional e o replica nos logs da criação e do proxy. O `requestCode` também loga a persistência de `registeredPhone` com o mesmo `requestId`.

**Frontend**
- [frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx): O `requestId` gerado na tentativa OTP agora também é enviado no payload de criação da instância.

### Debug: `requestId` único para correlacionar tentativas de OTP

**Backend**
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): `requestCode` e `confirmCode` agora aceitam e propagam `requestId`, gerando um UUID quando o cliente não envia um valor. Os logs do container passaram a prefixar todas as linhas com o mesmo `requestId` e as respostas da API também o retornam.

**Frontend**
- [frontend/src/lib/queries/instance/registrationApi.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/lib/queries/instance/registrationApi.ts): O payload e a resposta das chamadas OTP agora carregam `requestId`.
- [frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx): A tentativa de OTP ganha um `requestId` único ao iniciar o `requestCode` e reutiliza o mesmo valor no `confirmCode`.

### Debug: Logs verbosos no cadastro SMS OTP

**Backend**
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): Adicionados logs detalhados do payload bruto, configuração de proxy, payload do `requestRegistrationCode`, classificação de erro e stack nos fluxos `requestCode` e `confirmCode`.

**Frontend**
- [frontend/src/lib/queries/instance/registrationApi.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/lib/queries/instance/registrationApi.ts): Logs no console do navegador para payload e resposta das chamadas de solicitação/validação de OTP.
- [frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx): Logs de fluxo no diálogo de registro primário, incluindo dados do formulário, proxy derivado, normalização do telefone e erros capturados.

### Fix: OTP bloqueado retorna resposta estruturada na API

**Backend**
- [backend/src/config/otpErrors.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/config/otpErrors.ts): Novo helper puro para classificar erros do fluxo de registro OTP, detectando o retorno `reason=blocked` do WhatsApp.
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): `POST /register/requestCode` agora responde `423` com `code: "otp_blocked"` e mensagem estável quando o WhatsApp bloqueia o login; demais falhas continuam retornando erro genérico estruturado.

**Testes**
- [backend/src/tests/otp-errors.test.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/tests/otp-errors.test.ts): Cobertura unitária para bloqueio explícito e falha genérica do OTP.

### Fix: Mensagens persistidas sem corrida de unique constraint em `wa_messages`

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): Persistência de mensagens trocada de `upsert` para `createMany({ skipDuplicates: true })` no caminho `storeMessage()`, reduzindo corrida entre o envio local e os eventos do cliente que antes podiam estourar `Unique constraint failed on the fields: (instanceName,messageId)`.

**Testes**
- `npx tsc -p backend/tsconfig.json --noEmit`: validação de compilação passou após a alteração.

### Upgrade: Zapo backend package to v1.2.0

**Backend**
- `backend/package.json`: `zapo-js` updated to `^1.2.0` to pick up the upstream release with `message_unavailable`, `persistAllSecrets`, and LID/PN fixes.
- `backend/package-lock.json`: regenerated to lock the resolved `zapo-js` version and keep the install reproducible.
- `backend/src/manager.ts`, `backend/src/routes/message.routes.ts`: preserved existing behavior while upgrading the dependency; targeted verification required for message and JID paths.

**Commits:** pending

### Feat: Logs verbosos de mensagens e recibos

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): Adicionados logs detalhados nos listeners de eventos do `WaClient` para diferenciar a direção das mensagens (`[MESSAGE EVENT] [INBOUND/RECEIVED]` vs `[MESSAGE EVENT] [OUTBOUND/SENT]`).
- Adicionados logs em tempo real para recebimento de reações e edições de mensagens (`[MESSAGE ADDON EVENT]`) e confirmações de recebimento/leitura (`[MESSAGE STATUS/RECEIPT]`).
- Adicionado suporte à variável de ambiente `AUTO_RECONNECT_PAIRED=true` no método `loadAll` para forçar a auto-conexão imediata na inicialização do servidor de qualquer instância que já tenha sido pareada no passado (com credenciais salvas identificadas via `ownerJid` preenchido).
- Corrigida falha de persistência no PostgreSQL/Prisma sanitizando o payload de mensagens recebidas (`JSON.parse(JSON.stringify(unwrapped))`) para remover funções e protótipos incompatíveis que causavam o erro de serialização `toInt`.
- Corrigido mapeamento de envio de mensagens de texto na forma de objeto (linkPreview) para o tipo correto 'extendedTextMessage' na gravação do banco de dados.
- Preservado o campo `mediaUrl` nos metadados de envio de figurinhas (`sendSticker`) para correta renderização.

**Dev Tools**
- [scripts/dev.mjs](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/scripts/dev.mjs): Corrigido script de inicialização local para excluir o PID do processo pai (`process.ppid`) da rotina de limpeza de processos node no Windows, evitando que o comando `npm run dev` aborte logo na inicialização.
- Centralização da configuração no arquivo `.env` da raiz do monorepo, removendo o arquivo duplicado `backend/.env`. O código de bootstrap do backend ([backend/src/main.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/main.ts)) agora resolve o arquivo `.env` subindo na hierarquia de diretórios caso o arquivo local não exista, e a CLI do Prisma também encontra o `.env` na raiz nativamente.

**Frontend**
- [frontend/src/pages/instance/Chat/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/instance/Chat/index.tsx): Adicionado banner descritivo no topo da barra lateral de chats exibindo o nome e o status de conexão atual da instância (Conectado/Conectando/Desconectado) com um indicador visual colorido.
- [frontend/src/pages/instance/Chat/messages.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/instance/Chat/messages.tsx): Adicionado suporte visual para renderizar o tipo de mensagem `reactionMessage`, exibindo o emoji correspondente no histórico do chat.
- Adicionado fallback visual para figurinhas sem URL e tratamento correto para renderizar figurinhas enviadas via link usando `mediaUrl` ou `stickerMessage.url`.

---

## [Unreleased] — 2026-06-22

### Sync workflow formalization for upstream triage

**Docs / Memory**
- `docs/SYNC-UPSTREAM.md`: added copy-paste examples for `zapo`, `baileys`, `evolution`, `auto`, and `--evolution-api` usage, plus output-to-file examples.
- `AGENTS.md`: documented the formal triage workflow, supported modes, and the sync memory index entry.
- `CLAUDE.md`: documented the three upstream validation tracks and the standard sync workflow.
- `memory/project_sync_workflows.md`: formalized the upstream triage rules and mode-specific touchpoints.

**Commits:** `e36c2b4`

### Feat: Aba Contatos + Iniciar Conversa

**Backend — `backend/src/routes/contact.routes.ts` (novo)**
- `GET /contact/find/:instanceName` protegido por `checkInstanceApiKey`.
- Dual-store: PostgreSQL via `prisma.$queryRawUnsafe` na tabela `"wa_mailbox_contacts"` (corrigido de `"wa_contacts"`); SQLite via `better-sqlite3` na tabela `mailbox_contacts` (em `.auth/{instanceName}.sqlite`).
- Adicionados logs descritivos do processo de busca de contatos no backend.
- try/catch retorna `[]` silenciosamente se tabela não existe (requer `SAVE_DATA_CONTACTS=true`).
- Normalização de campos com múltiplos fallbacks (`id || jid`, `name || notify || verifiedName`).
- Proteção contra path traversal: regex `[A-Za-z0-9_-]+` + `path.resolve` confinamento ao diretório `.auth/`.

**Backend — `backend/src/main.ts`**
- Registrado roteador `/contact`.

**Frontend — `frontend/src/lib/provider/features.ts`**
- Adicionado `contacts: { api: true, go: false, zapo: true }`.

**Frontend — `frontend/src/components/sidebar.tsx`**
- Item "Contatos" com ícone `Users` na sidebar de instância, respeitando feature flag.

**Frontend — `frontend/src/routes/index.tsx`**
- Rota `/manager/instance/:instanceId/contacts` com `ProtectedRoute feature="contacts"`.

**Frontend — `frontend/src/lib/queries/contact/` (novo)**
- `types.ts`: tipos `Contact` e `FindContactsResponse`.
- `findContacts.ts`: hook `useFindContacts` com React Query.

**Frontend — `frontend/src/pages/instance/Contacts/index.tsx` (novo)**
- Lista com avatar, nome, número; busca local em tempo real.
- Botão "Conversar" navega para rota existente `/chat/:remoteJid` — sem chamada de API adicional.
- Estado vazio com instrução sobre `SAVE_DATA_CONTACTS`.
- Integrado botão e diálogo compartilhado "Nova Conversa".

**Frontend — `frontend/src/components/NewConversationDialog.tsx` (novo)**
- Componente de diálogo compartilhado para iniciar conversas com números fora da agenda.
- Validação no frontend: sanitiza o número limpando caracteres não-dígitos, garante comprimento entre 10 e 15 dígitos e valida que não inicia com "0".
- Redireciona diretamente para a rota do chat com o JID formatado.

**Frontend — `frontend/src/pages/instance/Chat/index.tsx`**
- Adicionado botão "Nova Conversa" no topo da listagem de chats ativos, disparando o diálogo compartilhado.

**i18n — 4 arquivos de tradução**
- `sidebar.contacts` adicionado em pt-BR, en-US, es-ES, fr-FR.
- `sidebar.chat` corrigido em pt-BR, es-ES, fr-FR (chave faltante).
- Chaves de tradução da estrutura `newConversation` adicionadas em todos os idiomas.

---

### Feat: Alinhamento de Eventos e Design do Webhook

**Frontend — `frontend/src/pages/instance/Webhook/index.tsx`**
- Restrita a lista de eventos configuráveis (`API_EVENTS`) para conter apenas os 8 eventos ativamente suportados e disparados pelo Zapo-JS.
- Redesenhada a exibição de cada evento individual de Webhook para seguir o mesmo padrão visual e proporções do switch de "Webhook por Eventos" (usando `FormItem` com flexbox, `FormLabel` com tamanho `text-sm` e peso regular/médio para o título amigável, e `FormDescription className="text-xs"` para exibir a descrição detalhada e o nome técnico do evento).

### Feat: Implementação das opções rejectCall e readStatus do Dashboard

**Backend — `backend/src/manager.ts`**
- **`client.on('message', ...)`**: Adicionado suporte a `settings.readStatus`. Quando ativo, novas publicações no chat especial `status@broadcast` que não sejam de autoria própria recebem automaticamente um recibo de leitura (`read`) via `client.message.sendReceipt`.
- **`client.on('call', ...)`**: Adicionado suporte a `settings.rejectCall`. Quando ativado e um evento de chamada recebida do tipo `'offer'` é detectado, constrói uma stanza customizada `<call><reject/></call>` e envia via `client.lowlevel.sendNode` para recusar a chamada de rede. Se `settings.msgCall` estiver configurado, também envia automaticamente a mensagem de texto configurada para o chamador.

---

### Feat: Sincronização completa do histórico ao escanear QR Code

**Backend — `backend/src/manager.ts`**
- **`buildStore()`**: assinatura estendida com `opts: { syncFullHistory?: boolean }`. Quando `syncFullHistory=true`, os providers `messages` e `threads` são ativados (`'pg'`) no zapo-js store, garantindo que os blobs de histórico enviados pelo dispositivo primário sejam persistidos no backend PostgreSQL/SQLite em vez de descartados silenciosamente.
- **`connectClient()` — `clientOptions.history`**: adicionado `requireFullSync: settings.syncFullHistory ?? false`. Este campo instrui o protocolo WhatsApp a solicitar o histórico **completo** (`FULL`) e não apenas `RECENT` ao parear. Sem esse campo, o flag na UI era ignorado a nível de protocolo.
- **`client.on('history_sync_chunk', ...)`**: novo listener registrado apenas quando `syncFullHistory=true`. O evento contém metadados (`messagesCount`, `conversationsCount`, `progress`, `chunkOrder`, `syncType`). Os dados reais são persistidos internamente pelo zapo-js via `writeBehind`; o listener loga o progresso no terminal e emite o evento `'history.sync'` via webhook e socket, permitindo que a UI exiba um indicador de sincronização.

> **Nota arquitetural:** `WaHistorySyncChunkEvent` expõe apenas metadados. As mensagens históricas são gravadas no store interno do zapo-js (PostgreSQL `wa_*` tables gerenciadas pelo `@zapo-js/store-postgres`), não diretamente nas tabelas Prisma `wa_messages`. Para que mensagens novas *e* históricas apareçam no chat do Manager, configure `SAVE_DATA_NEW_MESSAGE=true`.

**Commits:** pendente

---

### Fix: OTP registration proxy forwarding and Android device fingerprint consistency

**Backend**
- [backend/src/config/device.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/config/device.ts): Ajustado `DEFAULT_MOBILE_DEVICE.osVersion` para `15`, mantendo coerência com `osBuildNumber`, e extraídos helpers puros para construir o `User-Agent` e o `MOBILE_TOKEN` do Baileys com a versão iOS.
- [backend/src/config/proxyUtils.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/config/proxyUtils.ts): Novo helper puro para montar `options` com `httpsAgent`/`httpAgent` do fluxo OTP a partir de `proxyConfig`.
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): `POST /register/requestCode` agora injeta `options` no `makeRegistrationSocket`, reutilizando o proxy da instância no `mobileRegisterFetch`.

**Testes**
- [backend/src/tests/device-proxy-otp.test.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/tests/device-proxy-otp.test.ts): Nova suíte unitária cobrindo fingerprint Android, independência entre versões Android/iOS, helpers do Baileys e construção dos agentes de proxy HTTP/SOCKS.

### Feat: Suíte de testes E2E do Registro Primário e validações preventivas no backend

**Backend**
- [backend/src/routes/instance.routes.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/routes/instance.routes.ts): Adicionadas validações no início de `POST /instance/register/requestCode` para validar a existência da instância (retorna `404`) e verificar se está configurada para transporte móvel (retorna `400`).

**Testes**
- [tests/zapo-primary-registration.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-primary-registration.spec.ts): Nova suíte de testes E2E com Playwright contendo testes CI-safe de contratos e erros (Suite A) e testes integrados para fluxo de SMS/OTP real (Suite B) que utilizam variáveis de ambiente (`TEST_PRIMARY_PHONE`, `TEST_OTP_CODE`) e possuem cleanup automático de instâncias.

**Docs**
- [docs/TESTING.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/docs/TESTING.md): Criado guia completo de testes contendo comandos rápidos de execução, listagem das variáveis de ambiente aceitas, suítes existentes e a explicação detalhada de como executar o fluxo do Registro Primário em múltiplos passos para obter e validar o SMS OTP.
- [CLAUDE.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/CLAUDE.md): Atualizada a seção "Testes E2E" com comandos rápidos de execução de testes e referenciando o novo guia.

### Testes: cobertura de webhook com receiver local, retry em HTTP 500 e suíte real opt-in

**Backend**
- [backend/src/manager.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/manager.ts): `sendWebhook()` agora considera `response.ok`, lança erro em HTTP 4xx/5xx e aplica timeout explícito com `AbortSignal.timeout(10_000)`, permitindo retry em falhas de destino que antes passavam silenciosamente.

**Testes**
- [backend/src/tests/zapo-webhook-delivery.test.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/backend/src/tests/zapo-webhook-delivery.test.ts): nova suíte sem WhatsApp real com receiver HTTP local, validação de `connection.update`, `messages.upsert` e retry em respostas 500.
- [tests/zapo-webhook-delivery.real.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-webhook-delivery.real.spec.ts): nova suíte opt-in para WhatsApp real, usando instância conectada e receiver local para validar entrega de webhook após envio real de mensagem.

### Docs: Atualização da documentação sobre o método BMAD v6.9.0

**Docs**
- [docs/BMAD_METHOD.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/docs/BMAD_METHOD.md): Nova documentação detalhando a metodologia BMAD, a transição para `uv run` como executor padrão de Python, o novo fluxo de arquitetura baseado em `ARCHITECTURE-SPINE.md`, a nova primitiva de memória compartilhada `memlog.py` e o novo skill `bmad-forge-idea`.
- [AGENTS.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/AGENTS.md): Adicionada a seção "Metodologia BMAD (BMAD Method v6.9.0)" para orientar desenvolvedores e agentes sobre as novas diretrizes.
- [CLAUDE.md](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/CLAUDE.md): Adicionada a seção "Metodologia BMAD" para guiar agentes sobre o uso obrigatório de `uv run` e da espinha dorsal.

### Feat: Sincronização manual de perfil, contadores dinâmicos e painel de dispositivo

#### Backend — `backend/src/manager.ts`

- **`ZapoManager.syncProfile(instanceName)`** — novo método estático que centraliza toda a lógica de sincronização de perfil (foto + nome). Substitui código duplicado que existia em `setImmediate` no evento `connection` e agora também serve o endpoint de sincronização manual.
  - Lê `pushName` via `creds.pushName ?? creds.meDisplayName` (campo correto da interface `WaAuthCredentials` do zapo-js — `creds.me.name` não existe).
  - **Update condicional:** só sobrescreve `profileName` e `profilePicUrl` no banco se o valor obtido for não-vazio — evita apagar dados existentes quando `getProfilePicture` retorna 400 (privacidade) ou `pushName` vem vazio.
  - Após update, relê o estado atual do DB para emitir via socket os valores reais persistidos (pode ser valor anterior preservado).
  - Log descritivo no terminal: JID, Name, PicURL obtidos.

#### Backend — `backend/src/routes/instance.routes.ts`

- **`POST /instance/syncProfile/:instanceName`** — endpoint protegido por `checkInstanceApiKey` para forçar sincronização de perfil sob demanda via frontend. Delega para `ZapoManager.syncProfile()` e retorna `{ profilePicUrl, profileName, ownerJid }`. Retorna 400 se instância não estiver ativa.
- **`GET /fetchInstances` — otimização N+1 → `groupBy`:** substitui `_count: { Message: 0, Chat: 0 }` hardcoded por contagens reais do banco. Executa duas queries `groupBy` em paralelo (`Promise.all`) antes do `.map()`, construindo lookup maps `chatMap` e `msgMap`. `Contact` permanece 0 (sem model correspondente no Prisma local — documentado inline com comentário).
- **Backfill de número:** se `registeredPhone` for nulo, o campo `number` da listagem é derivado dinamicamente do `ownerJid`.

#### Frontend — `frontend/src/lib/queries/instance/manageInstance.tsx`

- Adicionada mutation `syncProfile` via `useManageMutation`, que chama `POST /instance/syncProfile/:instanceName` e invalida `["instance", "fetchInstance"]` e `["instance", "fetchInstances"]` ao concluir, forçando reload automático na UI.

#### Frontend — `frontend/src/pages/instance/DashboardInstance/index.tsx`

- **Botão "Sincronizar Perfil":** adicionado em `secondaryActions` do `BaseHeader`, visível apenas quando `connectionStatus === "open"`.
- **Painel "Dispositivo Emulado":** card colapsível exibido quando `instanceType === "mobile"` e `instance.deviceInfo` presente. Grid 4 colunas (Fabricante, Modelo, Sistema Operacional, Build do Sistema). Fallback `"—"` quando campo vazio.
- **Ícone WhatsApp ao lado do `profileName`:** `WhatsAppIcon` (SVG inline, verde `#25D366`) exibido no `CardTitle` e no `BaseHeader title` quando `instance.profileName` está preenchido — indica visualmente que o nome veio do WhatsApp conectado.
- **`InstanceName` acima do token:** exibe `instance.name` (identificador técnico) com label localizado "Nome da instância" e botão de cópia, antes do `InstanceToken`. Permite copiar o nome para uso em integrações de API sem precisar lembrar ou buscar em outro lugar.
- **Label no token:** adicionado label "Token da instância" acima do `InstanceToken` para consistência visual com o `InstanceName`.
- Importa `Copy` do lucide-react e `copyToClipboard` de `@/utils/copy-to-clipboard`.

#### Frontend — `frontend/src/components/instance-card.tsx`

- **Ícone WhatsApp no `<h3>`:** `WhatsAppIcon` (SVG inline, `h-3.5 w-3.5`, verde `#25D366`) exibido ao lado do `displayName` quando `instance.profileName` está preenchido.
- Fallbacks de `manufacturer` e `device` no card corrigidos: `|| "Samsung"` e `|| "SM-S911B"` substituídos por `|| "—"` — evitava exibir valores falsos quando campos estavam vazios.

#### Frontend — `frontend/src/components/base-header.tsx`

- Prop `title` alterada de `string` para `ReactNode` — permite passar JSX com ícone embutido sem quebrar usos existentes que passam strings.

---

## [Unreleased] — 2026-06-21

### Fix: Versão WA Business Android desatualizada causando `old_version` no registro OTP

**Causa raiz:** fallback hardcoded `appVersion: '2.24.4.76'` em `backend/src/config/device.ts` abaixo da versão mínima aceita pelo WhatsApp. O fetch de startup em `fetchAndroidWaVersion.ts` funciona quando o servidor alcança `play.google.com`, mas containers sem acesso caíam no fallback obsoleto.

**Backend — `backend/src/config/device.ts`**
- Atualizado `DEFAULT_MOBILE_DEVICE.appVersion`: `2.24.4.76` → `2.26.23.73` (versão atual Play Store em 2026-06-21)

**Backend — `backend/src/main.ts`**
- Adicionado `scheduleDailyVersionCheck()`: setTimeout recursivo que dispara diariamente às 03:00 (horário do servidor) para re-buscar versão atual do WA Business no Play Store via `fetchLatestAndroidWaVersion()`. Re-agenda após cada execução. Garante que containers de longa duração não dependam de restart para obter versão mínima atualizada. Log de sucesso/falha em cada execução.

### Feat: Configuração de proxy na criação de instância (todos os modos)

**Backend — `backend/src/routes/instance.routes.ts`**
- Endpoint `POST /create`: aceita campo `proxy` no body (`host`, `port`, `protocol`, `enabled`, `username`, `password`). Testa conectividade via `testProxyConnectivity` (não bloqueia criação em falha), atualiza `ZapoManager.proxyStatusCache` e persiste `proxyConfig` no banco.

**Frontend — `frontend/src/pages/Dashboard/NewInstance.tsx`**
- Schema Zod estendido com campos proxy: `proxyEnabled`, `proxyProtocol`, `proxyHost`, `proxyPort`, `proxyUsername`, `proxyPassword`
- Seção colapsível "Proxy" com select de protocolo (HTTP/HTTPS/SOCKS4/SOCKS5), host, porta, usuário, senha, switch enabled
- Payload inclui `proxy` apenas quando seção aberta + host + porta preenchidos
- Reset completo ao fechar dialog

**Frontend — `frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx`**
- Estado local de proxy (`proxyOpen`, `proxyEnabled`, `proxyProtocol`, `proxyHost`, `proxyPort`, `proxyUsername`, `proxyPassword`)
- Seção colapsível idêntica ao NewInstance, passada ao `createInstance` via spread
- Fix: `resetAll()` agora reseta `proxyEnabled` e `proxyProtocol` (anteriormente persistiam entre aberturas do dialog)

### Feat: Badge de tipo de instância — 3 estados (Primário / Mobile / Web)

**Frontend — `frontend/src/components/instance-card.tsx`**
- Substituído badge binário Mobile/Web por IIFE com 3 estados:
  - **Primário** (violeta + `KeyRound`): `mobileTransport=true` E `number` preenchido (registrado via OTP)
  - **Mobile** (esmeralda + `Smartphone`): `mobileTransport=true` sem número (companion)
  - **Web** (âmbar + `Globe`): conexão QR padrão

### Refactor: Badges de Proxy e Webhook — ícone + label curto responsivo

**Frontend — `frontend/src/components/instance-card.tsx`**
- Substituído `FlagBadge` genérico por `ProxyBadge` e `WebhookBadge` especializados
- `ProxyBadge`: `🛡 Proxy OK` (roxo) / `🛡 Proxy ERR` (vermelho) / `🛡 Proxy —` (cinza)
- `WebhookBadge`: `🔗 Webhook ON` (azul) / `🔗 Webhook OFF` (cinza)
- Responsivo: prefixo "Proxy "/"Webhook " oculto em `< sm` via `hidden sm:inline`; telas largas exibem label completo

---

## [Unreleased] — 2026-06-20

### Fix: Chat não exibia mensagens recebidas nem enviadas pelo app (Mobile Transport / @lid JID)

**Causa raiz:** Mobile Transport usa JIDs no formato `@lid` (Linked ID privado) em vez do JID de telefone `@s.whatsapp.net`. O frontend navega e filtra mensagens pelo JID de telefone (URL do chat e body do `findMessages`), causando mismatch silencioso — as mensagens eram recebidas pelo zapo-js mas armazenadas num bucket de chave diferente, nunca retornadas ao frontend.

**Backend — `backend/src/manager.ts`**
- Handler `client.on('message', ...)`: lê `event.key.remoteJidAlt` (JID alternativo que zapo-js inclui quando o primário é `@lid`) e normaliza `key.remoteJid → @s.whatsapp.net` antes de chamar `storeMessage` e emitir via socket/webhook. Payload do socket passa a usar o objeto `normalized` retornado por `storeMessage`, que inclui o campo `messageType`.
- `storeMessage()`: detecta `messageType` excluindo campos de metadado (`messageContextInfo`, `$$unknownFieldCount`, `viewOnceMessageV2Extension`, `pinInChatMessage`) da iteração `Object.keys()`, evitando que a serialização proto ponha `messageContextInfo` primeiro e resulte em `messageType: 'unknown'`. Passa a retornar o objeto `normalized`.
- Adicionado método estático `debugState(instanceName)` para inspeção em tempo real do mapa em memória (chats e contagem de mensagens por JID).

**Backend — `backend/src/routes/chat.routes.ts`**
- Endpoint de diagnóstico `GET /chat/debug/:instanceName` — retorna estado in-memory (chats, messages por JID, cliente ativo). Temporário; manter para debugging em produção.

**Efeito colateral corrigido no frontend:** socket payload sem `messageType` causava que o merge `allMessages` (RQ + realtime) sobrescrevesse o objeto correto do React Query com o objeto bruto do socket (sem `messageType`), fazendo o switch do `MessageContent` cair no caso `default` e exibir "Unknown message type". Resolvido ao incluir `messageType` no payload do socket.

### Fix: Persistência de mensagens e exibição em tempo real no chat

**Backend — `backend/src/manager.ts`**
- `storeMessage()`: persiste mensagem em `wa_messages` (upsert fire-and-forget) quando `SAVE_DATA_NEW_MESSAGE=true`.
- `getMessageList()`: agora `async`; quando `SAVE_DATA_NEW_MESSAGE=true` busca do banco e faz merge com mapa in-memory (DB como cold store, memória sobrescreve em caso de conflito por ID).

**Backend — `backend/prisma/schema.prisma` e migração**
- Novo model `Message` mapeado para `wa_messages` com campos `instanceName`, `remoteJid`, `messageId`, `fromMe`, `messageType`, `message` (JSONB), `messageTimestamp`, `source`.
- `backend/prisma/migrations/20260623000001_add_wa_messages/migration.sql`: migration idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

**Backend — `backend/src/routes/chat.routes.ts`**
- `POST /chat/findMessages/:instanceName`: adicionado `await` em `ZapoManager.getMessageList()`.

**Frontend — `frontend/src/pages/instance/Chat/messages.tsx`**
- `useFindMessages` recebe `refetchInterval: 3000` — polling garante que mensagens recebidas apareçam mesmo sem evento de socket (fallback robusto).
- Cleanup do useEffect usa callbacks nomeados (`onUpsert`, `onSend`, `onUpdate`) para `socket.offHandler()` em vez de `socket.off(event)` que removia TODOS os handlers do evento no socket compartilhado.

**Frontend — `frontend/src/pages/instance/Chat/index.tsx`**
- Removido `disconnectSocket()` do cleanup do useEffect — destruía o socket compartilhado ao navegar entre abas, fazendo `messages.tsx` perder a conexão de real-time.

**Frontend — `frontend/src/services/websocket/socket.ts`**
- Adicionado método `offHandler(event, callback)` à interface `WebSocketConnection` e implementação no `createSocketWrapper`, permitindo remoção seletiva de listener específico sem afetar outros handlers do mesmo evento.

### Correção de exibição de mensagens enviadas (fromMe) no chat

**Backend**
- `backend/src/manager.ts`:
  - Implementada a função utilitária `unwrapMessage` que desempacota recursivamente estruturas encapsuladas como `deviceSentMessage`, `viewOnceMessage`, `viewOnceMessageV2`, etc.
  - Atualizado `storeMessage` para executar `unwrapMessage` antes de salvar e definir o tipo das mensagens, garantindo que o banco de dados e os webhooks trafeguem dados fáceis de processar pelo frontend.
- `backend/src/routes/message.routes.ts`:
  - Corrigido o objeto `message` passado para `ZapoManager.recordSentMessage()` nos endpoints de envio de áudio, texto, mídia, sticker, botões, lista e carrossel. Anteriormente, era passado o retorno cru do client `sentMsg.message` que é indefinido (uma vez que o `send()` retorna apenas `{id, ack}`), gerando mensagens em branco (`{}`) e do tipo `'unknown'`. Agora passa a estrutura correta correspondente ao tipo de mensagem enviada.

### Pareamento QR Code / Código de Pareamento para Zapo Mobile Companion

**Backend**
- `backend/src/manager.ts`:
  - Modificada a inicialização do cliente no `connectClient` para condicionalmente ignorar a configuração `mobileTransport` quando a instância ainda não possuir credenciais registradas (campo `ownerJid` vazio no banco de dados). Isso permite que a instância mobile pendente de pareamento seja inicializada temporariamente via WebSocket normal para gerar o QR code / código de pareamento, e mude para a emulação TCP do dispositivo móvel na reconexão após o primeiro pareamento.
- `backend/src/routes/instance.routes.ts`:
  - Adicionado fallback para `getMobileDevice()` e `getMobileDevice().appVersion` no endpoint `GET /fetchInstances` se a instância móvel estiver sem `deviceInfo` salvo no banco de dados (padrão em novas instâncias pareadas via QR Code), exibindo corretamente a "Versão do app mobile" na dashboard.

**Frontend**
- `frontend/src/pages/instance/DashboardInstance/index.tsx`:
  - Removido o bloqueio `instanceType !== "mobile"` que ocultava as opções de gerar QR Code e código de pareamento para instâncias do tipo Mobile. Agora o usuário pode escolher conectar como Companion (Tablet Mode) escaneando o QR Code ou digitando o código de pareamento, além de poder registrar como dispositivo primário via SMS/Voz.
  - Importado e renderizado o card de status de proxy `ProxyStatusPanel` dinamicamente na Dashboard da instância quando a mesma possui proxy configurado e ativado (`instance.proxyEnabled === true`), exibindo o estado da conexão, IP externo, latência e servidor.
- `frontend/src/pages/instance/Proxy/index.tsx`:
  - Exportado o componente `ProxyStatusPanel` para permitir seu reuso em outros locais (como no Dashboard da Instância).

### Logs de debug para conexões de proxy

**Backend**
- `backend/src/routes/config.routes.ts`:
  - Adicionados logs detalhados com `console.error` no backend (exibindo `err.cause`) ao falhar o teste de conectividade de proxy.
  - Retornado o campo `details` com a causa real do erro no JSON de resposta, permitindo que a interface ou o cliente saibam o motivo exato de `fetch failed`.
  - Mapeado erro específico de código HTTP `402` (Payment Required) retornado por túneis HTTP para fornecer uma mensagem amigável instruindo o usuário a verificar o saldo/conta do plano de proxy.
  - Adicionada validação de conectividade em tempo real ao salvar configurações de proxy ativas no endpoint `POST /proxy/set/:instanceName`. Se a conexão falhar, retorna status 400 formatado no padrão esperado pela UI (`response.message`), impedindo que o proxy seja salvo como sucesso quando a conexão falhar.
- `backend/src/manager.ts`:
  - Introduzido `ZapoManager.proxyStatusCache` em memória para persistir o estado de conectividade da última verificação ou tentativa de conexão do proxy por instância.
  - O cache é atualizado com `connected: true/false` ao conectar o cliente e capturar erros de inicialização de proxy.
  - No bloco `catch` de inicialização do cliente, realiza um teste de conectividade em tempo real via `testProxyConnectivity` antes de marcar a falha no cache. Isso previne que erros da aplicação/registro (ex: `mobileTransport requires registered credentials`) sejam marcados incorretamente como falhas de proxy na dashboard.
  - Omitida a propriedade `ws` (agente WebSocket do proxy) das configurações enviadas ao `WaClient` quando a instância utiliza `mobileTransport`, uma vez que a conexão móvel nativa TCP (porta 5222) não suporta agentes WebSocket. Isso evita a exceção `mobileTransport does not support socketOptions.proxy.ws` enquanto mantém o proxy ativo para envio/download de mídias e link previews.
  - Adicionado suporte e mapeamento para erro HTTP `407` (Proxy Authentication Required) em `testProxyConnectivity`.
  - Aplicada sanitização com expressão regular (`toLowerCase` + `replace(/[^a-z0-9]/g, '')`) nos sufixos de `session` e `country` adicionados ao usuário do proxy. Isso evita rejeições de autenticação de proxy (HTTP 407) causadas por formatos inválidos contendo letras maiúsculas ou caracteres especiais (como o nome da instância `Teste-mobile` auto-injetado como ID de sessão).
  - Adicionados logs informativos detalhados no terminal ao iniciar o teste de conectividade de proxy, mostrando o usuário final composto com sufixos, o host do proxy e o resultado (sucesso, IP retornado e latência).
- `backend/src/routes/instance.routes.ts`:
  - Retornadas as propriedades `proxyConnected` e `proxyError` em `GET /fetchInstances` a partir do cache de status do proxy.

**Frontend**
- `frontend/src/pages/instance/Proxy/index.tsx`:
  - Ajustado o tratamento de erros no salvamento de proxy para capturar chaves de resposta alternativas (`error?.response?.data?.message`, `error?.response?.data?.error`, etc.) de forma resiliente, evitando que mensagens de erro importantes fiquem ocultas ou indefinidas no toast.
- `frontend/src/components/instance-card.tsx`:
  - O badge de Proxy ativado muda dinamicamente para vermelho com o rótulo "Proxy falhou" e o ícone `ShieldAlert` se a propriedade `proxyConnected` for `false`, alertando o usuário diretamente na listagem de instâncias.
- `frontend/src/pages/instance/DashboardInstance/index.tsx`:
  - Adicionado um banner de `Alert` vermelho com `ShieldAlert` no topo da Dashboard da instância avisando sobre a falha de proxy e exibindo a mensagem descritiva do erro.
  - Ocultados os botões/diálogos de "QR Code" e "Código de Pareamento" (que ficavam em loop de carregamento infinito) para instâncias móveis (`mobileTransport`), exibindo apenas a opção correta de "Registrar via SMS/Voz" (Registro Primário).
- `frontend/src/types/evolution.types.ts`:
  - Atualizado o tipo `Instance` para suportar `proxyConnected` e `proxyError`.

### Correção de conexão em instâncias móveis pendentes

**Backend**
- `backend/src/routes/instance.routes.ts`:
  - No endpoint `/instance/create`, não inicia a conexão de forma assíncrona para instâncias `mobileTransport` pendentes de pareamento.
  - No endpoint `/instance/connect/:instanceName`, captura erros de inicialização da conexão TCP (ex: porta 5222 bloqueada) e retorna status `200` com `status: 'disconnected'` e a mensagem do erro, evitando falhas de rede HTTP 500 no console do frontend.
- `backend/src/manager.ts`:
  - Tratado o evento de desconexão (`close`) no Prisma de forma segura com `try-catch`, evitando falhas de banco de dados (`P2025`) se a instância for excluída do painel durante a desconexão.

**Frontend**
- `frontend/src/pages/instance/DashboardInstance/index.tsx`:
  - Modificado o alerta de desconexão. Se a instância for do tipo `mobileTransport` e estiver desconectada, o painel oculta as opções de QR Code / Código de Pareamento e exibe um botão dedicado "Registrar Dispositivo Móvel" para abrir o modal de Registro Primário diretamente, com o nome da instância já preenchido.
- `frontend/src/pages/Dashboard/PrimaryRegistration/index.tsx`:
  - Adicionado suporte a `defaultInstanceName` para preencher automaticamente o campo de texto do nome da instância.

### Flags visuais e versão por instância no dashboard

**Backend**
- `backend/src/routes/instance.routes.ts`: `GET /fetchInstances` passou a expor `instanceType`, `mobileTransport`, `webhookEnabled`, `softwareVersion` e `deviceInfo`, permitindo que a interface diferencie instâncias Web/Mobile, mostre o estado do webhook e exiba a versão correta por instância sem inferência no frontend.

**Frontend**
- `frontend/src/components/instance-card.tsx`: Adicionados flags visuais explícitos para proxy, webhook e tipo de instância, com ícones e rótulos separados para estados ativo/inativo e categorias Web/Mobile.
- `frontend/src/pages/instance/DashboardInstance/index.tsx`: Adicionado bloco de informação com o tipo da instância e a versão do software vinculado, diferenciando WhatsApp Web de app mobile.
- `frontend/src/types/evolution.types.ts`: Tipos atualizados para refletir os novos campos do contrato da instância.

**Testes**
- `tests/zapo.spec.ts`: Ajustada a cobertura do `fetchInstances` para validar o novo shape do retorno.
- `tests/zapo-settings-webhook.spec.ts`: Incluída verificação de que a flag `webhookEnabled` acompanha ativação/desativação no `fetchInstances`.

### Limite de tentativas de QR Code (QRCODE_LIMIT)

**Backend**
- `backend/src/manager.ts`: Implementado `QRCODE_LIMIT` (padrão: 5). Ao atingir o limite de QR Codes sem scan, a instância para de reconectar, emite evento `connection.update` com `status: disconnected, reason: qrcode_limit_reached` via webhook e socket, e chama `disconnectClient()`. Contador reseta em `auth_paired` para permitir re-pareamento após o limite. Equivalente à variável `QRCODE_LIMIT` da Evolution API.
- `docker-stack-swarm.yaml`: Variável `QRCODE_LIMIT` documentada e declarada no serviço `app`.

### Persistência de dados e gravação de mensagens outbound

**Backend**
- `backend/src/manager.ts`: Adicionado suporte a `SAVE_DATA_NEW_MESSAGE`, `SAVE_DATA_CONTACTS` e `SAVE_DATA_HISTORIC` em `buildStore()` e `connectClient()` para controlar a persistência no PostgreSQL/SQLite. Adicionado método `recordSentMessage()` para gravação de mensagens enviadas.
- `backend/src/routes/message.routes.ts`: Chamada a `ZapoManager.recordSentMessage()` após o envio bem-sucedido de mensagens em todas as 7 rotas de envio.
- `backend/.env.example`: Documentação das variáveis de ambiente de persistência de dados.
- `backend/prisma/schema.prisma`: Adicionados campos `profilePicUrl`, `profileName` e `ownerJid` (com default `""`) ao model `Instance`.
- `backend/prisma/migrations/20260622000002_add_instance_profile/migration.sql`: Migration idempotente (`ADD COLUMN IF NOT EXISTS`) para os novos campos de perfil.
- `backend/package.json`: Removido hook `predev: prisma generate` — causava EPERM no Windows (DLL travado pelo Vite em paralelo). Usar `npm run prisma:generate` manualmente (com servidor parado) após mudanças de schema.

**Infra**
- `docker-stack-swarm.yaml`: Declaração das variáveis `SAVE_DATA_NEW_MESSAGE`, `SAVE_DATA_CONTACTS` e `SAVE_DATA_HISTORIC` no serviço `app`.

### Fix 1-4: Correções de restart e resiliência pós-análise técnica

**Backend**
- `backend/src/main.ts`: `bootstrap()` refatorado — servidor HTTP + Socket.io criados e `setSocketEmitter()` registrado **antes** de `ZapoManager.loadAll()`. Elimina janela cega onde eventos `connection.update` disparados durante reconexão das instâncias eram perdidos por `_socketEmitter` ainda ser `null`.
- `backend/prisma/schema.prisma`: adicionado model `ChatEntry` mapeado para tabela `wa_chats` — persiste a lista de chats por instância no PostgreSQL, sobrevivendo a restarts.
- `backend/prisma/migrations/20260622000001_add_wa_chats/migration.sql`: migration idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`) para a tabela `wa_chats`.
- `backend/src/manager.ts`: `getChatList()` agora `async` — lê `wa_chats` do banco (persistente) com overlay in-memory para entradas recém-chegadas; `storeMessage()` faz upsert fire-and-forget no banco via `prisma.chatEntry.upsert()`.
- `backend/src/manager.ts`: `sendWebhook()` implementa 3 tentativas com backoff exponencial (1 s, 2 s, 4 s); falha definitiva é logada como `ERROR`. Sem dependências novas.
- `backend/src/routes/chat.routes.ts`: adicionado `await` em `ZapoManager.getChatList()` (agora async).
- `backend/src/tests/chat-corrections.test.ts`: stub de `getChatList` atualizado para `async` (match de assinatura).

**Frontend**
- `frontend/src/services/websocket/socket.ts`: `reconnectionAttempts: 5` → `Infinity`; interface `SocketCallbacks` adicionada (`onDisconnect`, `onReconnect`) para que chamadores possam exibir banner de UX sem acoplar lógica de UI ao módulo de socket.
- `frontend/src/pages/instance/Chat/index.tsx`: passa `onDisconnect` (exibe toast "Conexão perdida. Reconectando...") e `onReconnect` (fecha toast, exibe "Reconectado.", invalida cache TanStack Query `["chats","findChats"]`) ao `connectSocket()`.

### Isolamento de chave de mensagens e status de conexão real

**Backend**
- `backend/src/middleware/auth.ts`: Adicionada `checkStrictInstanceApiKey` para rotas de mensagem, aceitando apenas a `apiKey` da instância e rejeitando `GLOBAL_API_KEY` com `401 Unauthorized`.
- `backend/src/routes/message.routes.ts`: Rotas `/message/*` passaram a usar a validação estrita de chave por instância.
- `backend/src/routes/instance.routes.ts`: `GET /fetchInstances` agora só marca `open` quando existe cliente ativo real em memória; instâncias sem `activeClients` retornam `close`/`disconnected` mesmo que o banco ainda esteja com status `connected`.

### Automação de Testes e Correções de Autenticação

**Testes**
- `tests/zapo.spec.ts`: Corrigidos os cenários de teste da `Suite 2` (Autenticação e Autorização). A validação dos endpoints `/message/*` foi ajustada de 401 para 503/500 quando a chave global (`GLOBAL_API_KEY`) ou a chave específica (`instanceApiKey`) é válida mas a instância de teste está desconectada, alinhando as expectativas com o comportamento real do middleware `checkInstanceApiKey`.
- `tests/zapo-settings-webhook.spec.ts`: Criada uma nova suíte de testes de integração reutilizável para validar a busca e persistência das configurações de comportamento (`/settings`) e webhook (`/webhook`) de instâncias do Zapo Manager de forma isolada de instâncias ativas do WhatsApp.

### Suporte a Mensagens Interativas e Envio de Texto

**Frontend**
- `frontend/src/components/test-interactive-modal.tsx`: Adicionado suporte a aba "Texto" (que dispara `POST /message/sendText/:instanceName`), expandido a contagem de colunas do grid de abas para 6 e adicionada a classe `max-h-[90vh] overflow-y-auto` ao `<DialogContent>` para permitir rolagem de tela nos payloads longos.
- `frontend/src/components/instance-card.tsx`: Adicionado contorno verde esmeralda semi-transparente, fundo suave e cor de texto correspondente no avatar/iniciais da instância quando não há foto de perfil cadastrada.
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
| Push origin | Múltiplos commits à frente de `origin/master` — realizar push após validação local |
| History sync UI | `history.sync` socket event disponível; frontend ainda não exibe indicador de progresso |
| Histórico no chat | Mensagens históricas ficam no store interno do zapo-js, não nas tabelas Prisma — integração futura necessária para exibir no Manager chat |
