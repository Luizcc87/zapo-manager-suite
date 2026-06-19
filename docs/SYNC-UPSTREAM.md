# Sincronização com Upstream (evolution-manager-v2)

O `frontend/` é um git submodule rastreando o repo original:
`https://github.com/evolution-foundation/evolution-manager-v2`

## Estrutura de remotes

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

## Resumo dos comandos do dia a dia

| Ação | Comando |
|---|---|
| Buscar atualizações upstream | `git -C frontend fetch upstream` |
| Aplicar atualizações | `git -C frontend merge upstream/main` |
| Commitar atualização no principal | `git add frontend && git commit` |
| Ver o que mudou no upstream | `git -C frontend log HEAD..upstream/main --oneline` |
| Estado do submodule | `git submodule status` |
| Publicar customizações | `git -C frontend push origin main` |
