---
name: feedback-workflow
description: "Como o usuário prefere trabalhar — aprovações, branches, agentes paralelos"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 81af7271-cbf3-4868-aa5d-e74fb308c027
---

Trabalha direto em `master` sem criar feature branches — confirmou explicitamente quando perguntado (2026-06-19).

**Why:** Projeto solo/pequeno time, overhead de PR não compensa.

**How to apply:** Não criar branch ao iniciar implementação. Commitar direto em master.

---

Usa múltiplos agentes de IA em paralelo. Gemini/Antigravity IDE trabalha no backend, Claude Code no frontend — ou vice-versa. Quando o usuário reporta "foi feito no backend", é trabalho de outro agente; revisar o diff antes de comentar.

**Why:** Workflow multi-agente — cada agente tem contexto diferente.

**How to apply:** Ao receber update de implementação de outro agente, sempre revisar `git diff` antes de dar feedback.

---

Aprova planos antes de executar. Fluxo: brainstorm → plano escrito → aprovação → execução.

**Why:** Evita implementação desnecessária em direção errada.

**How to apply:** Nunca pular a etapa de aprovação do plano.
