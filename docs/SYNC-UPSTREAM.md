# Sincronização com Upstreams

Dois upstreams independentes para rastrear:

| Upstream | Tipo | Afeta |
|---|---|---|
| `github.com/evolution-foundation/evolution-manager-v2` | git submodule | `frontend/` |
| `github.com/vinikjkkj/zapo` | pacotes npm | `backend/` |

---

## 1. Frontend — git submodule (evolution-manager-v2)

O `frontend/` é um git submodule rastreando o repo original:
`https://github.com/evolution-foundation/evolution-manager-v2`

### Estrutura de remotes

```
upstream (evolution-foundation/evolution-manager-v2)
    ↓  git fetch + merge
frontend/ (submodule — fork local com customizações zapo)
    ↓  git add frontend && commit
zapo-manager/ (repo principal)
```

## Clonar o projeto pela primeira vez

```bash
git clone --recurse-submodules https://github.com/SEU-USER/zapo-manager
```

Se já clonou sem `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Sincronizar atualizações do upstream

```bash
cd frontend
git fetch origin
git log HEAD..origin/main --oneline   # ver o que vai entrar
git merge origin/main                 # aplicar
```

Resolver conflitos se houver (customizações zapo vs mudanças upstream), depois:

```bash
cd ..
git add frontend
git commit -m "chore: sync frontend with upstream vX.Y.Z"
```

## Adicionar upstream como remote separado (opcional mas recomendado)

Se o submodule apontar para um fork seu no GitHub em vez do repo original:

```bash
cd frontend
git remote add upstream https://github.com/evolution-foundation/evolution-manager-v2
```

Fluxo de sync passa a ser:

```bash
cd frontend
git fetch upstream
git merge upstream/main
cd ..
git add frontend
git commit -m "chore: sync frontend with upstream"
```

## Ver estado do submodule

```bash
# Commit que o submodule está apontando vs HEAD do upstream
git submodule status

# Log de commits pendentes no upstream
git -C frontend log HEAD..origin/main --oneline
```

## Atualizar .gitmodules para apontar para fork próprio

Após criar fork em `github.com/SEU-USER/evolution-manager-v2`:

```bash
# Atualizar URL no .gitmodules
git config -f .gitmodules submodule.frontend.url https://github.com/SEU-USER/evolution-manager-v2
git config -f .git/config submodule.frontend.url https://github.com/SEU-USER/evolution-manager-v2

# Aplicar
git submodule sync
git add .gitmodules
git commit -m "chore: point frontend submodule to own fork"
```

Adicionar upstream no frontend:

```bash
cd frontend
git remote add upstream https://github.com/evolution-foundation/evolution-manager-v2
git push origin main   # subir customizações para o fork
```

## Publicar customizações zapo no fork

```bash
cd frontend
# após fazer mudanças no frontend
git add .
git commit -m "feat: customização zapo"
git push origin main   # push para SEU fork

cd ..
git add frontend       # atualizar o gitlink no repo principal
git commit -m "chore: update frontend submodule"
git push origin master
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

---

## Resumo dos comandos do dia a dia

### Frontend (submodule)

| Ação | Comando |
|---|---|
| Buscar atualizações upstream | `git -C frontend fetch upstream` |
| Aplicar atualizações | `git -C frontend merge upstream/main` |
| Commitar atualização no principal | `git add frontend && git commit` |
| Ver o que mudou no upstream | `git -C frontend log HEAD..upstream/main --oneline` |
| Estado do submodule | `git submodule status` |
| Publicar customizações | `git -C frontend push origin main` |

### Backend (npm)

| Ação | Comando |
|---|---|
| Ver o que está desatualizado | `cd backend && npm outdated` |
| Atualizar pacotes zapo | `npm update zapo-js @zapo-js/*` |
| Usar commit específico do GitHub | `npm install github:vinikjkkj/zapo#<ref>` |
