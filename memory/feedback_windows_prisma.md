---
name: feedback-windows-prisma-dll
description: "Prisma DLL EPERM no Windows ao rodar npm run dev — causa, fix imediato e fix permanente"
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

## Problema recorrente: `predev` some do package.json

**Causa:** Agente Gemini/outro processo sobrescreve `backend/package.json` sem o campo `predev`. O `predev: "prisma generate"` é intencional e crítico.

**Fix:** Sempre que editar ou revisar diff de `backend/package.json`, verificar se `predev` está presente:
```json
"scripts": {
  "predev": "prisma generate",
  "build": "tsc",
  ...
}
```

**Why:** Sem `predev`, o Prisma Client não é regenerado antes do `tsx watch`, causando erros de tipo ou runtime quando o schema muda.
