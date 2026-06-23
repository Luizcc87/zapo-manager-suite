# Sincronização com Upstreams

Dois upstreams independentes para rastrear:

| Upstream | Tipo | Afeta |
|---|---|---|
| `github.com/evolution-foundation/evolution-manager-v2` | git subtree | `frontend/` |
| `github.com/vinikjkkj/zapo` | pacotes npm | `backend/` |

---

## 1. Frontend — git subtree (evolution-manager-v2)

O `frontend/` é integrado ao monorepo como um **subtree** mapeando o repositório original:
`https://github.com/evolution-foundation/evolution-manager-v2`

### Estrutura de remotes

```
upstream-frontend (evolution-foundation/evolution-manager-v2)
    ↓  git fetch + git subtree pull --squash
zapo-manager-suite/ (monorepo completo)
```

## Clonar o projeto pela primeira vez

Diferente de submódulos, o monorepo com subtree não exige parâmetros adicionais ou inicializações recursivas:

```powershell
git clone https://github.com/Luizcc87/zapo-manager-suite.git
```

## Sincronizar atualizações do upstream

Para buscar as novidades do painel oficial e mesclá-las no monorepo, siga estas etapas:

1. **Obter as atualizações do upstream**:
   ```powershell
   git fetch upstream-frontend
   ```

2. **Testar e mesclar em uma branch descartável (Recomendado)**:
   Antes de atualizar o `master`, crie uma branch temporária para validar possíveis conflitos:
   ```powershell
   git checkout -b sync/test-subtree-pull
   git subtree pull --prefix=frontend upstream-frontend main --squash
   ```
   * **Se houver conflitos**: Resolva-os dentro da pasta `frontend/`, rode os testes locais e, se estiver tudo correto, faça o merge. Caso queira desistir e resetar o estado, aborte com:
     ```powershell
     git merge --abort
     git checkout master
     git branch -D sync/test-subtree-pull
     ```
   * **Se o pull for limpo e bem-sucedido**: Você pode prosseguir com o merge real na branch principal:
     ```powershell
     git checkout master
     git subtree pull --prefix=frontend upstream-frontend main --squash
     git branch -D sync/test-subtree-pull
     ```

---

## 2. Backend — pacotes npm (zapo)

Repo: `https://github.com/vinikjkkj/zapo`

Pacotes consumidos pelo `backend/`:
- `zapo-js` — client principal
- `@zapo-js/store-postgres`
- `@zapo-js/store-redis`
- `@zapo-js/store-sqlite`
- `@zapo-js/media-utils`

### Verificar versões disponíveis

```bash
# Ver versão atual instalada vs última publicada no npm
cd backend
npm outdated zapo-js @zapo-js/store-postgres @zapo-js/store-redis @zapo-js/store-sqlite @zapo-js/media-utils
```

### Atualizar para última versão publicada

```bash
cd backend
npm update zapo-js @zapo-js/store-postgres @zapo-js/store-redis @zapo-js/store-sqlite @zapo-js/media-utils
```

Testar antes de commitar — mudanças na API do zapo podem quebrar `backend/src/manager.ts`.

```bash
cd ..
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): update zapo-js to vX.Y.Z"
```

### Usar versão direta do GitHub (patch antes de publicar no npm)

Quando precisar de correção que ainda não foi publicada no npm:

```bash
cd backend
npm install github:vinikjkkj/zapo#<commit-ou-tag>
```

Ou no `package.json`:

```json
"zapo-js": "github:vinikjkkj/zapo#main"
```

Voltar para npm quando a versão for publicada:

```bash
npm install zapo-js@latest
```

### Monitorar releases

Acompanhar: `https://github.com/vinikjkkj/zapo/releases`

Changelog e breaking changes aparecem lá antes de chegar no npm.

### Script de triagem

Use o script local para gerar um esqueleto de análise antes de implementar:

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/vinikjkkj/zapo/releases/tag/v1.2.0 --tag v1.2.0
```

Opcionalmente, grave o relatório em arquivo:

```bash
node scripts/zapo-release-triage.mjs --tag v1.2.0 --output tmp/zapo-release-triage.md
```

O script não altera código. Ele só padroniza:
- resumo da release
- mapa de impacto local
- pontos de código prováveis
- testes sugeridos
- docs a atualizar

### Exemplos de uso

Use `--mode auto` quando a URL já identifica o upstream. Se quiser forçar o trilho, passe o modo explicitamente.

#### Zapo

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/vinikjkkj/zapo/releases/tag/v1.2.0 --tag v1.2.0 --mode auto --evolution-api
```

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/vinikjkkj/zapo/releases/tag/v1.2.0 --tag v1.2.0 --mode zapo
```

#### Baileys

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/WhiskeySockets/Baileys/releases/tag/v6.6.0 --tag v6.6.0 --mode auto
```

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/WhiskeySockets/Baileys/releases/tag/v6.6.0 --tag v6.6.0 --mode baileys
```

#### Evolution Manager v2

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/evolution-foundation/evolution-manager-v2/releases/tag/v1.0.0 --tag v1.0.0 --mode auto --evolution-api
```

```bash
node scripts/zapo-release-triage.mjs --release-url https://github.com/evolution-foundation/evolution-manager-v2/releases/tag/v1.0.0 --tag v1.0.0 --mode evolution --evolution-api
```

#### Saída em arquivo

```bash
node scripts/zapo-release-triage.mjs --release-url <url> --tag <tag> --mode auto --evolution-api --output tmp/zapo-release-triage.md
```

### Triagem rápida de release

Quando sair uma nova tag no upstream, use este checklist antes de tocar no backend:

1. Ler o release note e identificar se o impacto é:
   - evento novo
   - alteração de payload
   - correção de envio/mapeamento de JID
   - mudança de persistência/segredos
2. Mapear o impacto para os pontos locais:
   - `backend/src/manager.ts`
   - `backend/src/routes/message.routes.ts`
   - `backend/src/routes/instance.routes.ts`
   - `backend/src/config/device.ts`
   - `backend/src/config/fetchAndroidWaVersion.ts`
3. Conferir se o comportamento já existe no repo local antes de implementar.
4. Se a mudança tocar contrato público, atualizar `CHANGELOG.md` e `docs/openapi.yaml`.

#### Release `v1.2.0` do Zapo

Fonte: `https://github.com/vinikjkkj/zapo/releases/tag/v1.2.0`

Mudanças relevantes:

- `feat(message): emit typed message_unavailable event for unavailable placeholders`
  - Impacto provável: novos eventos de mensagem em `backend/src/manager.ts` e, se expostos, novos tipos para webhook/socket/UI.
- `feat(message): opt-in persistAllSecrets for all message secrets`
  - Impacto provável: configuração de store/persistência em `backend/src/manager.ts` e revisão de segurança para qualquer material de auth/crypto gravado em disco.
- `fix(message): stamp peer_recipient_pn on LID-addressed 1:1 sends`
  - Impacto provável: envios de mensagem e resolução de JID em `backend/src/routes/message.routes.ts`, principalmente nos fluxos que lidam com LID/JID e números do Brasil.

Leitura prática para o projeto local:

- Se o problema for de entrega de mensagem, começar por `message.routes.ts` e pelos helpers de resolução de JID.
- Se a mudança envolver eventos novos, começar por `manager.ts` e pelos testes de webhook/socket.
- Se a mudança envolver segredos/persistência, revisar o contrato de store e o que realmente deve ser persistido no backend antes de habilitar qualquer flag equivalente.

---

## Resumo dos comandos do dia a dia

### Frontend (subtree)

| Ação | Comando |
|---|---|
| Configurar remote oficial (se necessário) | `git remote add upstream-frontend https://github.com/evolution-foundation/evolution-manager-v2.git` |
| Buscar atualizações upstream | `git fetch upstream-frontend` |
| Mesclar atualizações com squash | `git subtree pull --prefix=frontend upstream-frontend main --squash` |
| Ver o que mudou no upstream | `git log master..upstream-frontend/main --oneline` |

### Backend (npm)

| Ação | Comando |
|---|---|
| Ver o que está desatualizado | `cd backend && npm outdated` |
| Atualizar pacotes zapo | `npm update zapo-js @zapo-js/*` |
| Usar commit específico do GitHub | `npm install github:vinikjkkj/zapo#<ref>` |
| Comparar release tag com o estado local | `git log --oneline --decorate v1.1.3..v1.2.0` |
