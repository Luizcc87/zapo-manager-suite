---
name: feedback-windows-prisma-dll
description: "Prisma DLL EPERM no Windows + predev — causa, fix e contexto de quando NÃO usar predev (atualizado 2026-06-22)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d09ecfa5-1d85-48cf-a8a6-a41a343a6b43
---

## Problema recorrente: EPERM ao rodar `npm run dev`

**Erro:**
```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'
```

**Causa:** `predev: "prisma generate"` tenta sobrescrever o DLL enquanto um processo node anterior ainda segura o file handle. `killPort(8080)` no dev.mjs não é suficiente — o processo pode ter morrido mas o OS ainda não liberou o handle.

**Fix imediato (quando acontecer):**
```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
# aguardar ~1s
cd backend && npx prisma generate
# depois rodar npm run dev normalmente
```

**Fix permanente (já implementado em scripts/dev.mjs):**
Após `killPort` loop, matar todos os processos node.exe exceto o próprio dev.mjs via PowerShell + aguardar 800ms antes de iniciar os filhos.

**Why:** Windows não libera handles de DLL imediatamente após SIGTERM/taskkill — precisa de tempo ou garantia que o processo morreu completamente antes de tentar sobrescrever o arquivo.

**How to apply:** Sempre que `prisma generate` falhar com EPERM: matar node primeiro, gerar, depois dev.

---

## Atenção: `predev` foi REMOVIDO intencionalmente do package.json

**Status atual:** `backend/package.json` NÃO tem `predev: "prisma generate"`.

**Motivo da remoção:** O hook `predev` causava EPERM no Windows (DLL travado pelo Vite em paralelo). Foi removido como fix permanente.

**Como regenerar o Prisma client manualmente** (necessário após mudanças de schema):
```powershell
# 1. Parar o dev server
# 2. Matar todos os processos node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
# 3. Gerar o client
cd backend && npx prisma generate
# 4. Reiniciar o dev server
npm run dev
```

**How to apply:** Ao modificar `backend/prisma/schema.prisma`, sempre regenerar o Prisma client manualmente antes de reiniciar o servidor. Não adicionar `predev` de volta sem coordenar com o usuário.

---

## Problema recorrente: agente sobrescreve package.json sem verificar

Agentes de IA às vezes sobrescrevem `backend/package.json` durante implementações.

**How to apply:** Sempre que editar ou revisar diff de `backend/package.json`, verificar que o script `predev` NÃO foi reintroduzido (remoção foi intencional). Verificar que scripts essenciais (`build`, `dev`, `prisma:generate`) estão presentes.
