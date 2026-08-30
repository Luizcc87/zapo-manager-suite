# Plano de Upgrade `zapo-js` 1.8.2

Data: 2026-08-30

## Release Summary

Estado local:
- `backend/package.json`: `zapo-js` em `^1.8.0`.
- `backend/package-lock.json`: resolvido em `zapo-js@1.8.0`.
- npm `latest`: `zapo-js@1.8.2`.
- Pacotes auxiliares ja estao nas ultimas versoes publicadas verificadas:
  - `@zapo-js/store-postgres@1.2.0`
  - `@zapo-js/store-redis@1.3.0`
  - `@zapo-js/store-sqlite@1.2.0`
  - `@zapo-js/media-utils@1.0.0`
  - `@zapo-js/fake-server@1.3.0`

Escopo do upgrade: atualizar somente o motor principal de `1.8.0` para `1.8.2`, mantendo os pacotes auxiliares se `npm view` continuar confirmando que nao ha versoes novas.

Mudancas upstream a triar:
- `v1.8.1`
  - `fix(retry): let the retry ladder reach count 3 before placeholder resend`
  - `fix(media): skip the streaming sidecar for non-streamable mp4`
  - `fix(history): resolve the stored message author from the top-level participant`
- `v1.8.2`
  - `fix(offline): request the next offline batch until the queue drains`
  - `fix(phash): grow the canonical buffer instead of capping participants`

## Implementation Checklist

1. Criar branch curta:
   ```powershell
   git checkout -b chore/zapo-js-1.8.2
   ```

2. Gerar triagem formal antes de editar:
   ```powershell
   node scripts/zapo-release-triage.mjs --release-url https://github.com/vinikjkkj/zapo/releases/tag/v1.8.2 --tag v1.8.2 --mode zapo --output tmp/zapo-js-v1.8.2-triage.md
   ```

3. Confirmar novamente as versoes publicadas no momento da execucao:
   ```powershell
   cd backend
   npm view zapo-js version dist-tags time --json
   npm view @zapo-js/store-postgres version dist-tags --json
   npm view @zapo-js/store-redis version dist-tags --json
   npm view @zapo-js/store-sqlite version dist-tags --json
   npm view @zapo-js/media-utils version dist-tags --json
   npm view @zapo-js/fake-server version dist-tags --json
   ```

4. Atualizar lockfile e manifest:
   ```powershell
   cd backend
   npm install zapo-js@1.8.2 --legacy-peer-deps
   ```

5. Inspecionar diff limitado:
   ```powershell
   git diff -- backend/package.json backend/package-lock.json
   ```

6. Se houver erro de tipo, revisar primeiro os pontos locais mapeados abaixo antes de adaptar contratos:
   - `backend/src/manager.ts`
   - `backend/src/routes/message.routes.ts`
   - `backend/src/routes/instance.routes.ts`
   - `backend/src/config/device.ts`
   - `backend/src/config/fetchAndroidWaVersion.ts`

7. Atualizar `CHANGELOG.md` porque o comportamento de runtime do motor WhatsApp muda:
   - titulo sugerido: `Upgrade zapo-js v1.8.2`
   - escopo: retry de placeholders, mp4 nao streamable, autoria em historico, drain de offline batches e phash de participantes.

## Active Production Instances Impact Warning

Risco principal: medio.

Motivo: `1.8.1` e `1.8.2` sao patches SemVer, mas tocam pontos sensiveis para producao: retry de mensagem, historico/offline sync, autoria de mensagens e processamento de participantes. Antes de publicar em VPS, validar que:
- o lock Redis `lock:zapo:<instanceName>` continua sendo adquirido e renovado;
- deploy segue `replicas: 1` e `stop-first`;
- instancias com proxy ativo continuam abortando sem fallback direto quando o proxy falha;
- nenhuma mudanca no motor altera o fluxo de reconnect, logout ou pairing code.

## Test Checklist

Gates locais obrigatorios:
```powershell
npm --prefix backend run build
npm run test:manager:api
npm run test:manager:ui
npm run test:manager:smoke:fake
```

Gate agregado aceitavel quando o ambiente estiver pronto:
```powershell
npm run build:all
npm run test:manager
npm run test:manager:smoke:fake
```

Validados manualmente ou por teste direcionado:
- envio de texto e midia por `backend/src/routes/message.routes.ts`;
- envio de video mp4 comum e mp4 nao streamable;
- recebimento de historico com autor/participant correto em grupo;
- offline sync drenando mais de um batch, se houver instancia/test fixture que reproduza;
- pairing code continua fire-and-forget na rota HTTP;
- `history_sync_chunk` continua emitindo apenas metadados quando `syncFullHistory=true`.

Nao rodar por padrao:
```powershell
npm run test:smoke:real
```

Esse gate exige confirmacao explicita e instancia real conectada.

## Local Impact Map

`backend/src/manager.ts`
- Retry/placeholder resend pode afetar eventos de mensagem e logs.
- Offline batch drain e history author podem alterar ordem/volume de eventos persistidos.
- Confirmar que listeners `connection`, `auth_qr`, `auth_pairing_required` e `history_sync_chunk` seguem compativeis.

`backend/src/routes/message.routes.ts`
- Media fix para mp4 nao streamable pode afetar envio/download/renderizacao de videos.
- Confirmar que normalizacao de URLs para Buffer/path local segue compativel com `zapo-js`.

`backend/src/routes/instance.routes.ts`
- Confirmar que `WA_VERSION`, `getState()` e fluxo de `connectClient()` seguem sem mudanca de contrato.

`backend/src/config/device.ts` e `backend/src/config/fetchAndroidWaVersion.ts`
- Sem mudanca upstream direta identificada, mas manter como check obrigatorio por causa de mobile transport e `failure_client_too_old`.

`docs/openapi.yaml`
- Provavelmente sem alteracao, porque as releases sao fixes internos do motor. Atualizar apenas se algum payload publico, webhook ou endpoint mudar.

## Likely Code Touchpoints

Esperado:
- `backend/package.json`
- `backend/package-lock.json`
- `CHANGELOG.md`

Somente se build/teste acusar quebra real:
- `backend/src/manager.ts`
- `backend/src/routes/message.routes.ts`
- `backend/src/routes/instance.routes.ts`
- `backend/src/config/device.ts`
- `backend/src/config/fetchAndroidWaVersion.ts`
- testes sob `tests/`

## Decision

Recomendacao: executar o upgrade para `zapo-js@1.8.2`.

Justificativa: o projeto ja esta em `1.8.0`; `1.8.1` e `1.8.2` sao patches com correcoes diretamente relevantes para confiabilidade de mensagens, midia, historico/offline sync e participantes. A mudanca deve ser tratada como upgrade estreito do backend, com pacote principal fixado em `1.8.2`, changelog atualizado e gates offline completos antes de qualquer release Docker.

## Release / Publish Follow-up

Somente apos merge/testes:
```powershell
npm run build:all
npm run test:manager
npm run test:manager:smoke:fake
git add backend/package.json backend/package-lock.json CHANGELOG.md
git commit -m "chore(backend): upgrade zapo-js to v1.8.2"
```

Se for publicar uma nova versao da suite:
```bash
git tag vX.Y.Z
git push origin master vX.Y.Z
bash scripts/build-push.sh vX.Y.Z
docker buildx imagetools inspect lc1868/zapo-manager:vX.Y.Z
docker buildx imagetools inspect lc1868/zapo-manager:zapo-js-1.8.2
```

Ao criar tag, criar tambem a GitHub Release ou pedir confirmacao explicita antes.
