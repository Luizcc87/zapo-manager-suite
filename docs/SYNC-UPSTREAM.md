# Sincronização com Upstreams

Dois upstreams independentes para rastrear:

| Upstream | Tipo | Afeta |
|---|---|---|
| `github.com/evolution-foundation/evolution-manager-v2` | git submodule | `frontend/` |
| `github.com/vinikjkkj/zapo` | pacotes npm | `backend/` |

---

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
