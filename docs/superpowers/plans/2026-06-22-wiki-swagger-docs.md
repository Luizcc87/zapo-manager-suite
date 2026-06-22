# Wiki + API Docs (Scalar + VitePress) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar API reference interativa (Scalar em `/api-docs`) e wiki narrativa (VitePress em GitHub Pages) ao zapo-manager.

**Architecture:** `docs/openapi.yaml` é a fonte única de verdade; o backend Express carrega esse arquivo e o serve via Scalar em `GET /api-docs`; o VitePress em `docs-site/` é compilado e publicado no GitHub Pages pelo GitHub Actions a cada push em `master` com mudanças em `docs-site/`.

**Tech Stack:** `@scalar/express-api-reference`, OpenAPI 3.0.3, VitePress 1.x, GitHub Actions, `peaceiris/actions-gh-pages`

## Global Constraints

- Node ≥ 20 (já em uso no projeto)
- Backend usa `tsx watch` — sem compilação prévia necessária para desenvolvimento
- `docs/openapi.yaml` é escrito à mão — sem geração automática via JSDoc
- Rota `/api-docs` é pública (sem autenticação) — Scalar pede apikey para chamar endpoints
- Regra de manutenção: novo endpoint no Express = novo path no `openapi.yaml` no mesmo commit
- Paths completos das rotas (prefixos do `main.ts`): `/instance/*`, `/message/*`, `/chat/*`, config sem prefixo

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `docs/openapi.yaml` | Criar | Spec completa dos 27 endpoints documentados |
| `backend/src/main.ts` | Modificar | Adicionar rota `GET /api-docs` via Scalar |
| `backend/package.json` | Modificar | Adicionar `@scalar/express-api-reference` |
| `docs-site/package.json` | Criar | VitePress dep + scripts |
| `docs-site/.vitepress/config.ts` | Criar | Nav, sidebar, título |
| `docs-site/index.md` | Criar | Homepage com hero e links |
| `docs-site/guide/quickstart.md` | Criar | Primeira instância em 5 min |
| `docs-site/guide/authentication.md` | Criar | apikey global vs instância |
| `docs-site/guide/instances.md` | Criar | mobile vs web, ciclo de vida |
| `docs-site/guide/messages.md` | Criar | Envio de mensagens com exemplos curl |
| `docs-site/guide/webhook.md` | Criar | Configurar, eventos, retry policy |
| `docs-site/guide/proxy.md` | Criar | Webshare, auto-registro, replace |
| `docs-site/guide/registration.md` | Criar | SMS OTP step-by-step |
| `docs-site/reference/events.md` | Criar | Todos os tipos de evento webhook |
| `docs-site/reference/errors.md` | Criar | Códigos HTTP + troubleshooting |
| `.github/workflows/docs.yml` | Criar | Build VitePress + deploy gh-pages |

---

### Task 1: Scalar API Reference no Backend

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/main.ts` (após linha 71, antes do bloco de licença)
- Create: `docs/openapi.yaml` (stub mínimo para validar integração)

**Interfaces:**
- Produz: `GET /api-docs` retorna 200 com HTML do Scalar
- Produz: `docs/openapi.yaml` com estrutura base (expandida na Task 2)

- [ ] **Step 1: Instalar dependência**

```bash
cd backend
npm install @scalar/express-api-reference
```

Esperado: `@scalar/express-api-reference` aparece em `backend/package.json` dependencies.

- [ ] **Step 2: Criar stub `docs/openapi.yaml`**

Criar arquivo `docs/openapi.yaml` na raiz do repo (não dentro de `backend/`):

```yaml
openapi: 3.0.3
info:
  title: Zapo Manager API
  version: 1.0.0
  description: |
    API REST para gerenciar instâncias WhatsApp via zapo-js.
    Autenticação via header `apikey` (GLOBAL_API_KEY ou chave da instância).
    
    **Try it out:** Configure o Server URL para sua VPS e clique em Authorize para inserir o GLOBAL_API_KEY.

servers:
  - url: http://localhost:8080
    description: Local dev
  - url: https://zapo.dominio.com
    description: VPS produção (substituir pelo domínio real)

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: apikey

security:
  - ApiKeyAuth: []

tags:
  - name: Instâncias
    description: Ciclo de vida das instâncias WhatsApp
  - name: Mensagens
    description: Envio de mensagens e mídia
  - name: Configuração
    description: Webhook, proxy e settings por instância
  - name: Chat
    description: Busca de chats e mensagens
  - name: Registro
    description: Registro primário via SMS/OTP (mobile transport)

paths:
  /instance/fetchInstances:
    get:
      tags: [Instâncias]
      summary: Listar instâncias
      description: Retorna todas as instâncias cadastradas. Filtros opcionais por instanceId ou instanceName.
      parameters:
        - in: query
          name: instanceId
          schema:
            type: string
          description: ID interno da instância (CUID)
        - in: query
          name: instanceName
          schema:
            type: string
          description: Nome da instância
      responses:
        '200':
          description: Lista de instâncias
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/InstanceSummary'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  schemas:
    InstanceSummary:
      type: object
      properties:
        id:
          type: string
          example: cmqmqwgg40000ioosgapeg2tu
        instanceName:
          type: string
          example: Teste-mobile
        status:
          type: string
          enum: [connected, connecting, disconnected]
        instanceType:
          type: string
          enum: [mobile, web]
        webhookEnabled:
          type: boolean
  responses:
    Unauthorized:
      description: API key ausente ou inválida
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Unauthorized: Invalid Global API Key
    NotFound:
      description: Instância não encontrada
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
                example: Instance not found
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: apikey
```

- [ ] **Step 3: Adicionar Scalar ao `backend/src/main.ts`**

Adicionar os imports após os imports existentes (linha ~18):

```typescript
import { apiReference } from '@scalar/express-api-reference';
import { readFileSync } from 'fs';
```

Adicionar a rota após `app.use('/', configRouter);` (linha 71) e antes do bloco de licença (linha 73):

```typescript
// ── API Docs (Scalar) ─────────────────────────────────────────────────────
const openapiSpecPath = path.join(__dirname, '../../docs/openapi.yaml');
const openapiSpec = readFileSync(openapiSpecPath, 'utf8');
app.use('/api-docs', apiReference({ spec: { content: openapiSpec } }));
```

- [ ] **Step 4: Verificar no browser**

Com o backend rodando (`npm run dev` no diretório `backend/`), abrir:

```
http://localhost:8080/api-docs
```

Esperado: UI do Scalar carrega, mostra "Zapo Manager API", exibe endpoint `GET /instance/fetchInstances`.

- [ ] **Step 5: Testar autenticação no Try it out**

Na UI do Scalar:
1. Clicar em `Authorize` → digitar qualquer valor no campo `apikey` → `Authorize`
2. Expandir `GET /instance/fetchInstances` → clicar `Send`
3. Esperado: request vai para `http://localhost:8080/instance/fetchInstances` com header `apikey`

- [ ] **Step 6: Commit**

```bash
git add docs/openapi.yaml backend/src/main.ts backend/package.json backend/package-lock.json
git commit -m "feat(docs): add Scalar API reference at /api-docs"
```

---

### Task 2: openapi.yaml Completo (27 endpoints)

**Files:**
- Modify: `docs/openapi.yaml` (expandir stub da Task 1)

**Interfaces:**
- Consome: stub do `docs/openapi.yaml` criado na Task 1
- Produz: spec com todos os 27 endpoints documentados, schemas de request/response

- [ ] **Step 1: Validar YAML antes de expandir**

```bash
npx @redocly/cli lint docs/openapi.yaml
```

Esperado: sem erros (ou apenas warnings de spec incompleta).

- [ ] **Step 2: Adicionar paths — Instâncias**

Adicionar à seção `paths:` do `docs/openapi.yaml`:

```yaml
  /instance/create:
    post:
      tags: [Instâncias]
      summary: Criar instância
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [instanceName]
              properties:
                instanceName:
                  type: string
                  example: minha-instancia
                token:
                  type: string
                  description: API key customizada (gerada automaticamente se omitida)
                  example: meu-token-secreto
                mobileTransport:
                  type: boolean
                  description: Usar transporte mobile TCP (requer registro SMS/OTP)
                  default: false
                deviceInfo:
                  type: object
                  description: Config do dispositivo mobile (appVersion, manufacturer, etc.)
                webhookConfig:
                  $ref: '#/components/schemas/WebhookConfig'
                proxyConfig:
                  $ref: '#/components/schemas/ProxyConfig'
      responses:
        '200':
          description: Instância criada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/InstanceSummary'
        '400':
          description: instanceName já existe ou dados inválidos
        '401':
          $ref: '#/components/responses/Unauthorized'

  /instance/connect/{instanceName}:
    get:
      tags: [Instâncias]
      summary: Conectar instância
      description: Inicia a conexão com o WhatsApp. Para instâncias web, retorna QR code via webhook. Para mobile, usa TCP.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Conexão iniciada
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: connecting
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /instance/connectionState/{instanceName}:
    get:
      tags: [Instâncias]
      summary: Estado da conexão
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Estado atual
          content:
            application/json:
              schema:
                type: object
                properties:
                  instance:
                    type: object
                    properties:
                      instanceName:
                        type: string
                      state:
                        type: string
                        enum: [open, connecting, close]
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /instance/syncProfile/{instanceName}:
    post:
      tags: [Instâncias]
      summary: Sincronizar perfil
      description: Busca nome e foto de perfil da instância conectada e salva no banco.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Perfil sincronizado
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /instance/logout/{instanceName}:
    delete:
      tags: [Instâncias]
      summary: Desconectar (logout)
      description: Desconecta a instância do WhatsApp sem excluí-la. Pode ser reconectada depois.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Desconectado com sucesso
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /instance/delete/{instanceName}:
    delete:
      tags: [Instâncias]
      summary: Excluir instância
      description: Remove permanentemente a instância e todos os seus dados.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Excluída com sucesso
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
```

- [ ] **Step 3: Adicionar paths — Registro SMS/OTP**

```yaml
  /instance/register/requestCode:
    post:
      tags: [Registro]
      summary: Solicitar código SMS
      description: Envia código de verificação por SMS para registrar número no WhatsApp Business via mobile transport.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [instanceName, phoneNumber]
              properties:
                instanceName:
                  type: string
                  example: Teste-mobile
                phoneNumber:
                  type: string
                  description: Número com DDI, sem +, sem espaços
                  example: "5511999999999"
                method:
                  type: string
                  enum: [sms, voice]
                  default: sms
      responses:
        '200':
          description: Código enviado
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: code_sent
        '400':
          description: Número inválido ou instância não está em estado mobile
        '401':
          $ref: '#/components/responses/Unauthorized'

  /instance/register/confirmCode:
    post:
      tags: [Registro]
      summary: Confirmar código SMS
      description: Confirma o código recebido e finaliza o registro da instância mobile.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [instanceName, code]
              properties:
                instanceName:
                  type: string
                  example: Teste-mobile
                code:
                  type: string
                  description: Código de 6 dígitos recebido por SMS
                  example: "123456"
      responses:
        '200':
          description: Registrado com sucesso
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: registered
        '400':
          description: Código inválido ou expirado
        '401':
          $ref: '#/components/responses/Unauthorized'
```

- [ ] **Step 4: Adicionar paths — Mensagens**

```yaml
  /message/status/{instanceName}/{messageId}:
    get:
      tags: [Mensagens]
      summary: Status de mensagem
      parameters:
        - $ref: '#/components/parameters/instanceName'
        - in: path
          name: messageId
          required: true
          schema:
            type: string
          example: AAAABBBBCCCCDDDD
      responses:
        '200':
          description: Status da mensagem
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [pending, sent, delivered, read, failed]
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /message/sendText/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar texto
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, text]
              properties:
                number:
                  type: string
                  description: Número destino com DDI
                  example: "5511999999999"
                text:
                  type: string
                  example: Olá! Mensagem de teste.
                delay:
                  type: integer
                  description: Delay em ms antes de enviar (simula digitação)
                  example: 1200
                quoted:
                  type: object
                  description: Mensagem a ser respondida (key)
      responses:
        '200':
          description: Mensagem enviada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /message/sendMedia/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar mídia (imagem, vídeo, documento, áudio)
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, mediatype, media]
              properties:
                number:
                  type: string
                  example: "5511999999999"
                mediatype:
                  type: string
                  enum: [image, video, document, audio]
                media:
                  type: string
                  description: URL pública ou base64 do arquivo
                  example: https://exemplo.com/imagem.jpg
                caption:
                  type: string
                  example: Legenda da imagem
                fileName:
                  type: string
                  description: Nome do arquivo (usado para documents)
                  example: relatorio.pdf
      responses:
        '200':
          description: Mídia enviada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /message/sendWhatsAppAudio/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar áudio como mensagem de voz
      description: Converte e envia áudio no formato PTT (Push to Talk) do WhatsApp.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, audio]
              properties:
                number:
                  type: string
                  example: "5511999999999"
                audio:
                  type: string
                  description: URL pública ou base64 do áudio (mp3, ogg, wav)
      responses:
        '200':
          description: Áudio enviado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /message/sendSticker/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar sticker
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, sticker]
              properties:
                number:
                  type: string
                  example: "5511999999999"
                sticker:
                  type: string
                  description: URL pública ou base64 (webp ou imagem convertida)
      responses:
        '200':
          description: Sticker enviado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /message/sendButtons/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar mensagem com botões
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, title, buttons]
              properties:
                number:
                  type: string
                  example: "5511999999999"
                title:
                  type: string
                  example: Escolha uma opção
                description:
                  type: string
                buttons:
                  type: array
                  items:
                    type: object
                    properties:
                      buttonId:
                        type: string
                      buttonText:
                        type: object
                        properties:
                          displayText:
                            type: string
      responses:
        '200':
          description: Botões enviados
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /message/sendList/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar lista interativa
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, title, buttonText, sections]
              properties:
                number:
                  type: string
                  example: "5511999999999"
                title:
                  type: string
                description:
                  type: string
                buttonText:
                  type: string
                  example: Ver opções
                sections:
                  type: array
                  items:
                    type: object
                    properties:
                      title:
                        type: string
                      rows:
                        type: array
                        items:
                          type: object
                          properties:
                            rowId:
                              type: string
                            title:
                              type: string
                            description:
                              type: string
      responses:
        '200':
          description: Lista enviada
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /message/sendCarousel/{instanceName}:
    post:
      tags: [Mensagens]
      summary: Enviar carrossel
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [number, cards]
              properties:
                number:
                  type: string
                  example: "5511999999999"
                cards:
                  type: array
                  items:
                    type: object
                    properties:
                      header:
                        type: object
                      body:
                        type: object
                      buttons:
                        type: array
      responses:
        '200':
          description: Carrossel enviado
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageSent'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

- [ ] **Step 5: Adicionar paths — Configuração**

```yaml
  /webhook/find/{instanceName}:
    get:
      tags: [Configuração]
      summary: Buscar config de webhook
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Config atual
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebhookConfig'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /webhook/set/{instanceName}:
    post:
      tags: [Configuração]
      summary: Configurar webhook
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WebhookConfig'
            example:
              enabled: true
              url: https://meu-sistema.com/webhook
              events:
                - connection.update
                - messages.upsert
              webhookBase64: false
              webhookByEvents: false
      responses:
        '200':
          description: Config salva
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WebhookConfig'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'

  /settings/find/{instanceName}:
    get:
      tags: [Configuração]
      summary: Buscar settings da instância
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Settings atuais
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/InstanceSettings'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /settings/set/{instanceName}:
    post:
      tags: [Configuração]
      summary: Atualizar settings da instância
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/InstanceSettings'
      responses:
        '200':
          description: Settings atualizados
        '401':
          $ref: '#/components/responses/Unauthorized'

  /proxy/find/{instanceName}:
    get:
      tags: [Configuração]
      summary: Buscar config de proxy
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Config de proxy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProxyConfig'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /proxy/set/{instanceName}:
    post:
      tags: [Configuração]
      summary: Configurar proxy
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProxyConfig'
      responses:
        '200':
          description: Proxy configurado
        '401':
          $ref: '#/components/responses/Unauthorized'

  /proxy/status/{instanceName}:
    get:
      tags: [Configuração]
      summary: Testar conectividade do proxy
      description: Faz uma requisição de teste através do proxy configurado e retorna IP externo e latência.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: Resultado do teste
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  ip:
                    type: string
                    example: 92.112.170.205
                  latencyMs:
                    type: integer
                    example: 1101
                  error:
                    type: string
        '401':
          $ref: '#/components/responses/Unauthorized'

  /proxy/replace/{instanceName}:
    post:
      tags: [Configuração]
      summary: Substituir IP do proxy
      description: Chama o endpoint do provedor para trocar o IP rotativo do proxy desta instância.
      parameters:
        - $ref: '#/components/parameters/instanceName'
      responses:
        '200':
          description: IP substituído com sucesso
        '400':
          description: PROXY_REPLACE_API_URL não configurado
        '401':
          $ref: '#/components/responses/Unauthorized'
```

- [ ] **Step 6: Adicionar paths — Chat**

```yaml
  /chat/findChats/{instanceName}:
    post:
      tags: [Chat]
      summary: Buscar chats
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                where:
                  type: object
                  description: Filtros Prisma (ex: { jid: "5511@s.whatsapp.net" })
      responses:
        '200':
          description: Lista de chats
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
        '401':
          $ref: '#/components/responses/Unauthorized'

  /chat/findMessages/{instanceName}:
    post:
      tags: [Chat]
      summary: Buscar mensagens
      parameters:
        - $ref: '#/components/parameters/instanceName'
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                where:
                  type: object
                  description: Filtros Prisma (ex: { jid: "5511@s.whatsapp.net" })
                take:
                  type: integer
                  description: Número máximo de mensagens
                  example: 50
                skip:
                  type: integer
                  example: 0
      responses:
        '200':
          description: Lista de mensagens
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
        '401':
          $ref: '#/components/responses/Unauthorized'
```

- [ ] **Step 7: Adicionar schemas compartilhados à seção `components.schemas`**

Adicionar dentro de `components.schemas:` (junto com `InstanceSummary` já existente):

```yaml
    MessageSent:
      type: object
      properties:
        key:
          type: object
          properties:
            remoteJid:
              type: string
            fromMe:
              type: boolean
            id:
              type: string
        messageTimestamp:
          type: integer
        status:
          type: string

    WebhookConfig:
      type: object
      properties:
        enabled:
          type: boolean
          default: false
        url:
          type: string
          format: uri
          example: https://meu-sistema.com/webhook
        events:
          type: array
          description: |
            Eventos a receber. Lista vazia = todos os eventos.
            Valores: connection.update, messages.upsert, messages.update,
            presence.update, chats.update, groups.update, call
          items:
            type: string
          example: [connection.update, messages.upsert]
        webhookBase64:
          type: boolean
          description: Enviar mídia como base64 no payload
          default: false
        webhookByEvents:
          type: boolean
          default: false

    InstanceSettings:
      type: object
      properties:
        rejectCall:
          type: boolean
          default: false
        msgCall:
          type: string
          description: Mensagem enviada ao rejeitar chamada
        groupsIgnore:
          type: boolean
          default: false
        alwaysOnline:
          type: boolean
          default: false
        readMessages:
          type: boolean
          default: false
        readStatus:
          type: boolean
          default: false

    ProxyConfig:
      type: object
      properties:
        enabled:
          type: boolean
          default: false
        host:
          type: string
          example: p.webshare.io
        port:
          type: integer
          example: 80
        protocol:
          type: string
          enum: [http, https, socks5]
          default: http
        username:
          type: string
        password:
          type: string
```

Adicionar dentro de `components.parameters:`:

```yaml
    instanceName:
      in: path
      name: instanceName
      required: true
      schema:
        type: string
      example: Teste-mobile
      description: Nome único da instância
```

- [ ] **Step 8: Validar spec completa**

```bash
npx @redocly/cli lint docs/openapi.yaml
```

Esperado: 0 errors. Warnings sobre exemplos são aceitáveis.

- [ ] **Step 9: Verificar no Scalar**

Abrir `http://localhost:8080/api-docs` — todos os 5 tags devem aparecer com seus endpoints expandíveis.

- [ ] **Step 10: Reiniciar backend para recarregar spec**

O `readFileSync` lê o arquivo uma vez na inicialização. Reiniciar o dev server para ver mudanças no YAML:

```bash
# No terminal do backend, Ctrl+C e então:
npm run dev
```

- [ ] **Step 11: Commit**

```bash
git add docs/openapi.yaml
git commit -m "docs(openapi): add complete spec for all 27 endpoints"
```

---

### Task 3: VitePress Scaffold

**Files:**
- Create: `docs-site/package.json`
- Create: `docs-site/.vitepress/config.ts`
- Create: `docs-site/index.md`

**Interfaces:**
- Produz: VitePress rodando em `http://localhost:5174` com homepage e nav funcional

- [ ] **Step 1: Criar `docs-site/package.json`**

```json
{
  "name": "zapo-manager-docs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.5.0"
  }
}
```

- [ ] **Step 2: Instalar VitePress**

```bash
npm --prefix docs-site install
```

Esperado: `docs-site/node_modules/` criado, `package-lock.json` gerado.

- [ ] **Step 3: Criar `docs-site/.vitepress/config.ts`**

```typescript
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Zapo Manager',
  description: 'Documentação do Zapo Manager — WhatsApp API Gateway',
  lang: 'pt-BR',
  themeConfig: {
    nav: [
      { text: 'Guia', link: '/guide/quickstart' },
      { text: 'Referência', link: '/reference/events' },
      { text: 'API Interativa ↗', link: 'https://zapo.dominio.com/api-docs', target: '_blank' },
    ],
    sidebar: [
      {
        text: 'Guia',
        items: [
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Autenticação', link: '/guide/authentication' },
          { text: 'Instâncias', link: '/guide/instances' },
          { text: 'Mensagens', link: '/guide/messages' },
          { text: 'Webhooks', link: '/guide/webhook' },
          { text: 'Proxy', link: '/guide/proxy' },
          { text: 'Registro Mobile', link: '/guide/registration' },
        ],
      },
      {
        text: 'Referência',
        items: [
          { text: 'Eventos Webhook', link: '/reference/events' },
          { text: 'Erros', link: '/reference/errors' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Luizcc87/zapo-manager-suite' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Zapo Manager — WhatsApp API Gateway',
    },
  },
});
```

- [ ] **Step 4: Criar `docs-site/index.md` (homepage)**

```markdown
---
layout: home

hero:
  name: Zapo Manager
  text: WhatsApp API Gateway
  tagline: Gerencie instâncias WhatsApp via REST API com suporte a mobile transport, webhooks e proxy.
  actions:
    - theme: brand
      text: Quickstart
      link: /guide/quickstart
    - theme: alt
      text: API Interativa
      link: https://zapo.dominio.com/api-docs

features:
  - title: Multi-instância
    details: Crie e gerencie múltiplas instâncias WhatsApp de uma só API.
  - title: Mobile Transport
    details: Conexão via protocolo TCP mobile com registro SMS/OTP — mais estável que QR code.
  - title: Webhooks com Retry
    details: Entrega de eventos com 3 tentativas e backoff exponencial. Suporte a connection.update, messages.upsert e mais.
  - title: Proxy por instância
    details: Configure proxy HTTP/SOCKS5 individual por instância com troca de IP integrada.
---
```

- [ ] **Step 5: Verificar VitePress rodando**

```bash
npm --prefix docs-site run dev
```

Esperado: servidor em `http://localhost:5173` (ou próxima porta disponível). Homepage carrega com hero e 4 feature cards. Nav mostra "Guia", "Referência", "API Interativa ↗".

- [ ] **Step 6: Adicionar `docs-site` ao `.gitignore` adequado**

Verificar se `docs-site/node_modules` está ignorado. Se o `.gitignore` da raiz não incluir `node_modules`, adicionar:

```bash
echo "docs-site/node_modules" >> .gitignore
echo "docs-site/.vitepress/dist" >> .gitignore
echo "docs-site/.vitepress/cache" >> .gitignore
```

- [ ] **Step 7: Commit**

```bash
git add docs-site/ .gitignore
git commit -m "feat(docs): add VitePress scaffold with nav and homepage"
```

---

### Task 4: GitHub Actions para Deploy Automático

**Files:**
- Create: `.github/workflows/docs.yml`

**Interfaces:**
- Consome: `docs-site/` criado na Task 3
- Produz: deploy automático em `gh-pages` branch a cada push em `master` com mudanças em `docs-site/`

- [ ] **Step 1: Habilitar GitHub Pages no repositório**

No GitHub: Settings → Pages → Source → selecionar **Deploy from a branch** → branch `gh-pages` → folder `/ (root)`.

> Nota: a branch `gh-pages` não existe ainda — o Actions vai criá-la no primeiro deploy.

- [ ] **Step 2: Criar `.github/workflows/docs.yml`**

```yaml
name: Deploy Docs

on:
  push:
    branches: [master]
    paths:
      - 'docs-site/**'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: docs-site/package-lock.json

      - name: Install deps
        run: npm --prefix docs-site ci

      - name: Build
        run: npm --prefix docs-site run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs-site/.vitepress/dist
          cname: ''
```

- [ ] **Step 3: Commit e push para disparar o workflow**

```bash
git add .github/workflows/docs.yml
git commit -m "ci: add GitHub Actions workflow for VitePress docs deploy"
git push origin master
```

- [ ] **Step 4: Verificar execução no GitHub**

Abrir: `https://github.com/Luizcc87/zapo-manager-suite/actions`

Esperado: workflow "Deploy Docs" executa, build passa, branch `gh-pages` é criada/atualizada.

- [ ] **Step 5: Verificar site publicado**

Após o workflow completar (~2 min), abrir:

```
https://luizcc87.github.io/zapo-manager-suite/
```

Esperado: homepage VitePress carrega com hero e nav.

---

### Task 5: Conteúdo da Wiki

**Files:**
- Create: `docs-site/guide/quickstart.md`
- Create: `docs-site/guide/authentication.md`
- Create: `docs-site/guide/instances.md`
- Create: `docs-site/guide/messages.md`
- Create: `docs-site/guide/webhook.md`
- Create: `docs-site/guide/proxy.md`
- Create: `docs-site/guide/registration.md`
- Create: `docs-site/reference/events.md`
- Create: `docs-site/reference/errors.md`

**Interfaces:**
- Consome: scaffold da Task 3 (links do sidebar já apontam para esses arquivos)

- [ ] **Step 1: Criar `docs-site/guide/quickstart.md`**

```markdown
# Quickstart

Primeira instância funcionando em 5 minutos.

## Pré-requisitos

- Zapo Manager rodando (ver [Docker](https://github.com/Luizcc87/zapo-manager-suite#docker))
- `GLOBAL_API_KEY` definido no `.env` do backend
- Número WhatsApp disponível

## 1. Criar instância

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: SEU_GLOBAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "minha-instancia",
    "webhookConfig": {
      "enabled": true,
      "url": "https://webhook.site/SEU_ID",
      "events": ["connection.update", "messages.upsert"]
    }
  }'
```

## 2. Conectar (QR code)

```bash
curl http://localhost:8080/instance/connect/minha-instancia \
  -H "apikey: SEU_GLOBAL_API_KEY"
```

O QR code chega via webhook `connection.update` com `status: "connecting"` e campo `qr`.

## 3. Enviar primeira mensagem

Após conectar (`status: "connected"` no webhook):

```bash
curl -X POST http://localhost:8080/message/sendText/minha-instancia \
  -H "apikey: SEU_GLOBAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "text": "Olá! Primeira mensagem via Zapo Manager."
  }'
```

## Próximos passos

- [Autenticação](./authentication) — entender apikey global vs instância
- [Instâncias mobile](./instances) — conexão mais estável via TCP
- [API Interativa](/api-docs) — testar todos os endpoints no browser
```

- [ ] **Step 2: Criar `docs-site/guide/authentication.md`**

```markdown
# Autenticação

Todos os endpoints exigem o header `apikey`.

## GLOBAL_API_KEY

Chave mestra definida em `backend/.env`. Aceita em **qualquer endpoint** de qualquer instância.

```
apikey: SUA_GLOBAL_API_KEY
```

Gerar uma chave segura:
```bash
openssl rand -hex 32
```

## Instance API Key

Cada instância tem sua própria chave gerada no momento da criação (ou definida manualmente via campo `token` no `POST /instance/create`).

Aceita em endpoints **específicos da instância** (enviar mensagens, configurar webhook, etc.).

```
apikey: TOKEN_DA_INSTANCIA
```

## Onde cada chave é aceita

| Endpoint | GLOBAL_API_KEY | Instance Key |
|----------|:-:|:-:|
| `GET /instance/fetchInstances` | ✅ | ❌ |
| `POST /instance/create` | ✅ | ❌ |
| `DELETE /instance/delete/:name` | ✅ | ❌ |
| `POST /message/sendText/:name` | ✅ | ✅ |
| `POST /webhook/set/:name` | ✅ | ✅ |
| `GET /proxy/status/:name` | ✅ | ✅ |

## Boas práticas

- Use `GLOBAL_API_KEY` apenas em sistemas de administração
- Distribua `instanceToken` para sistemas que só precisam enviar mensagens
- Nunca exponha nenhuma das chaves em código frontend público
```

- [ ] **Step 3: Criar `docs-site/guide/instances.md`**

```markdown
# Instâncias

## Tipos de conexão

### Web (QR Code)

Conexão padrão via protocolo WebSocket. Mais simples de configurar.

```json
{
  "instanceName": "minha-instancia-web"
}
```

- QR code entregue via webhook `connection.update`
- Reconexão automática (`recoverFromClientTooOld: true`)
- Exibido como "Chrome" nos dispositivos vinculados

### Mobile (TCP)

Conexão via protocolo TCP mobile. Mais estável e com menor risco de banimento.

```json
{
  "instanceName": "minha-instancia-mobile",
  "mobileTransport": true
}
```

- Requer registro via SMS/OTP (ver [Registro Mobile](./registration))
- Exibido como "Android" nos dispositivos vinculados
- Não precisa de QR code após registro

## Ciclo de vida

```
create → connect → [connecting] → [connected]
                                       ↓
                               [disconnected] → connect (reconectar)
                                       ↓
                                    delete
```

## Listar instâncias

```bash
curl http://localhost:8080/instance/fetchInstances \
  -H "apikey: SEU_GLOBAL_API_KEY"
```

## Estados possíveis

| Estado | Descrição |
|--------|-----------|
| `disconnected` | Criada mas não conectada |
| `connecting` | Aguardando QR scan ou reconectando |
| `connected` | Conectada e pronta para enviar mensagens |
```

- [ ] **Step 4: Criar `docs-site/guide/messages.md`**

```markdown
# Mensagens

Todos os endpoints de mensagem ficam em `/message/:tipo/:instanceName`.

## Texto simples

```bash
curl -X POST http://localhost:8080/message/sendText/INSTANCIA \
  -H "apikey: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{"number": "5511999999999", "text": "Olá!"}'
```

## Imagem com legenda

```bash
curl -X POST http://localhost:8080/message/sendMedia/INSTANCIA \
  -H "apikey: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "mediatype": "image",
    "media": "https://exemplo.com/foto.jpg",
    "caption": "Legenda da foto"
  }'
```

## Documento/PDF

```bash
curl -X POST http://localhost:8080/message/sendMedia/INSTANCIA \
  -H "apikey: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "mediatype": "document",
    "media": "https://exemplo.com/relatorio.pdf",
    "fileName": "relatorio.pdf"
  }'
```

## Áudio (mensagem de voz)

```bash
curl -X POST http://localhost:8080/message/sendWhatsAppAudio/INSTANCIA \
  -H "apikey: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{"number": "5511999999999", "audio": "https://exemplo.com/audio.mp3"}'
```

## Formato do número

Use DDI + DDD + número, sem `+`, sem espaços:
- ✅ `5511999999999`
- ❌ `+55 (11) 99999-9999`

Para grupos: usar o ID do grupo (`120363...@g.us`).
```

- [ ] **Step 5: Criar `docs-site/guide/webhook.md`**

```markdown
# Webhooks

O Zapo Manager entrega eventos em tempo real via HTTP POST para a URL configurada.

## Configurar

```bash
curl -X POST http://localhost:8080/webhook/set/INSTANCIA \
  -H "apikey: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://meu-sistema.com/webhook",
    "events": ["connection.update", "messages.upsert"]
  }'
```

**`events` vazio** = recebe todos os eventos.

## Eventos disponíveis

| Evento | Quando dispara |
|--------|---------------|
| `connection.update` | Estado da conexão muda (connecting, connected, disconnected) |
| `messages.upsert` | Nova mensagem recebida ou enviada |
| `messages.update` | Status de mensagem atualizado (enviado, entregue, lido) |
| `presence.update` | Contato ficou online/offline |
| `chats.update` | Chat atualizado (pin, archive, mute) |
| `groups.update` | Grupo atualizado |
| `call` | Chamada recebida |

## Retry policy

Se o endpoint retornar erro (status ≥ 400, timeout > 10s ou falha de rede), o sistema tenta mais 2 vezes com backoff exponencial:

| Tentativa | Delay antes |
|-----------|------------|
| 1ª | imediata |
| 2ª | 1 segundo |
| 3ª | 2 segundos |

Após 3 falhas, o evento é descartado e o erro é logado no servidor.

## Exemplo de payload `connection.update`

```json
{
  "instance": "minha-instancia",
  "data": {
    "status": "connected",
    "meJid": "5511999999999@s.whatsapp.net"
  }
}
```

## Testar com webhook-tester

```bash
docker run --rm -t -p "9090:8080/tcp" ghcr.io/tarampampam/webhook-tester:2
```

Acessar `http://localhost:9090`, copiar URL da sessão e usar como webhook URL.
```

- [ ] **Step 6: Criar `docs-site/guide/proxy.md`**

```markdown
# Proxy

Configure proxy HTTP/SOCKS5 por instância para rotear tráfego do WhatsApp.

## Configurar proxy

```bash
curl -X POST http://localhost:8080/proxy/set/INSTANCIA \
  -H "apikey: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "host": "p.webshare.io",
    "port": 80,
    "protocol": "http",
    "username": "usuario",
    "password": "senha"
  }'
```

## Testar conectividade

```bash
curl http://localhost:8080/proxy/status/INSTANCIA \
  -H "apikey: SUA_CHAVE"
```

Resposta:
```json
{
  "success": true,
  "ip": "92.112.170.205",
  "latencyMs": 1101
}
```

## Substituir IP (proxy rotativo)

```bash
curl -X POST http://localhost:8080/proxy/replace/INSTANCIA \
  -H "apikey: SUA_CHAVE"
```

Requer `PROXY_REPLACE_API_URL` e `PROXY_REPLACE_API_KEY` configurados no `backend/.env`.

## Auto-registro de IP no startup

Se `PROXY_API_KEY` e `PROXY_IP_AUTH_URL` estiverem definidos, o servidor detecta o IP público e registra automaticamente no provedor a cada inicialização.
```

- [ ] **Step 7: Criar `docs-site/guide/registration.md`**

```markdown
# Registro Mobile (SMS/OTP)

Registrar um número no WhatsApp via mobile transport — mais estável que QR code.

## Pré-requisitos

- Instância criada com `"mobileTransport": true`
- Número WhatsApp não vinculado a nenhum dispositivo (ou desvinculado)

## Passo 1: Criar instância mobile

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: SUA_GLOBAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "minha-mobile", "mobileTransport": true}'
```

## Passo 2: Solicitar código SMS

```bash
curl -X POST http://localhost:8080/instance/register/requestCode \
  -H "apikey: SUA_GLOBAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "minha-mobile",
    "phoneNumber": "5511999999999",
    "method": "sms"
  }'
```

Resposta: `{ "status": "code_sent" }`

## Passo 3: Confirmar código

```bash
curl -X POST http://localhost:8080/instance/register/confirmCode \
  -H "apikey: SUA_GLOBAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "minha-mobile",
    "code": "123456"
  }'
```

Resposta: `{ "status": "registered" }`

## Após o registro

A instância se conecta automaticamente via TCP. Eventos de webhook `connection.update` com `status: "connected"` chegam quando a conexão é estabelecida.

> **Nota:** Re-registro não é necessário após reinicializações do servidor — as credenciais são persistidas no banco.
```

- [ ] **Step 8: Criar `docs-site/reference/events.md`**

```markdown
# Eventos Webhook

Payloads entregues via HTTP POST para a URL configurada no webhook.

## connection.update

Disparado quando o estado da conexão muda.

```json
{
  "instance": "minha-instancia",
  "data": {
    "status": "connected",
    "meJid": "5511999999999@s.whatsapp.net"
  }
}
```

```json
{
  "instance": "minha-instancia",
  "data": {
    "status": "connecting",
    "qr": "data:image/png;base64,..."
  }
}
```

```json
{
  "instance": "minha-instancia",
  "data": {
    "status": "disconnected",
    "reason": "loggedOut"
  }
}
```

**Valores de `status`:** `connecting`, `connected`, `disconnected`  
**Valores de `reason`:** `loggedOut`, `connectionLost`, `timedOut`, `qrcode_limit_reached`

## messages.upsert

Disparado ao receber ou enviar mensagem.

```json
{
  "instance": "minha-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "AAAABBBBCCCCDDDD"
    },
    "messageType": "conversation",
    "message": {
      "conversation": "Olá!"
    },
    "messageTimestamp": 1782000000,
    "pushName": "João Silva"
  }
}
```

**`messageType` possíveis:** `conversation`, `imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`, `stickerMessage`, `buttonsResponseMessage`, `listResponseMessage`, `extendedTextMessage`

## messages.update

Atualização de status de mensagem enviada.

```json
{
  "instance": "minha-instancia",
  "data": {
    "chatJid": "5511999999999@s.whatsapp.net",
    "status": "READ",
    "messageIds": ["AAAABBBBCCCCDDDD"]
  }
}
```

**`status` possíveis:** `PENDING`, `SERVER_ACK`, `DELIVERY_ACK`, `READ`, `PLAYED`

## presence.update

```json
{
  "instance": "minha-instancia",
  "data": {
    "id": "5511999999999@s.whatsapp.net",
    "presences": {
      "5511999999999@s.whatsapp.net": {
        "lastKnownPresence": "available"
      }
    }
  }
}
```

## chats.update

```json
{
  "instance": "minha-instancia",
  "data": { "chatJid": "5511@s.whatsapp.net", "status": "muted" }
}
```

## groups.update

```json
{
  "instance": "minha-instancia",
  "data": { "id": "120363@g.us", "subject": "Novo nome do grupo" }
}
```

## call

```json
{
  "instance": "minha-instancia",
  "data": {
    "callId": "CALL_ID",
    "from": "5511999999999@s.whatsapp.net",
    "status": "ringing"
  }
}
```
```

- [ ] **Step 9: Criar `docs-site/reference/errors.md`**

```markdown
# Erros

## Códigos HTTP

| Código | Significado | Causa comum |
|--------|------------|-------------|
| `401` | Unauthorized | `apikey` ausente, incorreto ou sem permissão para esta instância |
| `404` | Not Found | Instância com este nome não existe |
| `400` | Bad Request | Corpo da requisição inválido ou campo obrigatório ausente |
| `500` | Internal Server Error | Erro no servidor (verificar logs do backend) |

## Erros comuns

### `Unauthorized: Invalid Global API Key`

O header `apikey` não confere com `GLOBAL_API_KEY` do `.env`.

```bash
# Verificar a chave configurada
grep GLOBAL_API_KEY backend/.env
```

### `Instance not found`

A instância com o nome especificado não existe.

```bash
# Listar instâncias existentes
curl http://localhost:8080/instance/fetchInstances -H "apikey: SUA_CHAVE"
```

### `instanceName parameter is required`

O parâmetro `:instanceName` na URL está vazio ou inválido.

### Webhook não recebido

1. Verificar se `enabled: true` na config do webhook
2. Verificar se a URL está acessível pelo servidor (não `localhost` se o zapo-manager está em VPS)
3. Checar logs do backend por `[ZapoWebhook]` entries:
   ```
   [ZapoWebhook] [instancia] → connection.update
   [ZapoWebhook] [instancia] [connection.update] tentativa 1/3 falhou — retry em 1000ms: ...
   ```

### QR code não aparece

- Instância pode já estar conectada: `GET /instance/connectionState/:name`
- Limite de QR codes atingido: fazer logout e reconectar

### Erro de registro mobile `old_version`

A versão do WA Business está desatualizada. O backend atualiza automaticamente no startup e às 03:00 via Play Store. Reiniciar o servidor força a busca.
```

- [ ] **Step 10: Verificar todas as páginas no VitePress dev**

```bash
npm --prefix docs-site run dev
```

Navegar por todos os links do sidebar e verificar que:
- Nenhum link quebrado (404)
- Blocos de código renderizados corretamente
- Tabelas formatadas

- [ ] **Step 11: Build de produção**

```bash
npm --prefix docs-site run build
```

Esperado: sem erros, `docs-site/.vitepress/dist/` gerado.

- [ ] **Step 12: Commit e deploy**

```bash
git add docs-site/guide/ docs-site/reference/
git commit -m "docs(wiki): add complete guide and reference pages"
git push origin master
```

Após push: verificar GitHub Actions executando e site atualizado em `https://luizcc87.github.io/zapo-manager-suite/`.
```

---

## Self-Review

**Cobertura do spec:**
- [x] `docs/openapi.yaml` fonte única — Task 1 (stub) + Task 2 (completo)
- [x] Scalar em `/api-docs` — Task 1
- [x] VitePress scaffold — Task 3
- [x] GitHub Actions deploy — Task 4
- [x] 9 páginas de conteúdo — Task 5
- [x] CORS: documentado como não necessário (Scalar same-origin)

**Placeholders:**
- `zapo.dominio.com` aparece em `config.ts` e no `openapi.yaml` servers — intencional, o usuário substitui pelo domínio real antes de commit

**Consistência:**
- Prefixos de rota consistentes com `main.ts` (`/instance/*`, `/message/*`, `/chat/*`, config sem prefixo)
- `instanceName` como `$ref: '#/components/parameters/instanceName'` definido e referenciado
- Schemas `WebhookConfig`, `ProxyConfig`, `MessageSent`, `InstanceSettings` definidos antes de usar
