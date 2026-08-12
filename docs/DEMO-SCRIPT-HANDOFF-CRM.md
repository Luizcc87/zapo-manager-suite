# Script de Demo — Handoff Bot/Humano + CRM Leve

Roteiro de vídeo para demonstrar o diferencial do Zapo Manager pro público de agentes autônomos (Hermes Agent, OpenClaw, Claude, ChatGPT Work, etc). Validado ponta a ponta contra instância real antes deste script existir — ver `CHANGELOG.md` (Épico 1 e Épico 2) para as validações que sustentam cada passo.

**Regra de ouro (decidida em party mode):** nunca mostrar CRM sozinho, sem handoff visível. Mostrar agente lendo/editando ficha do contato sem deixar claro que humano pode assumir a qualquer momento passa a impressão errada — falta de controle. Handoff e CRM aparecem sempre juntos na demo.

## Preparação

- Instância WhatsApp real conectada (não sandbox — a demo perde força se for simulação).
- Agente de IA configurado com as MCP tools do Zapo Manager (`get_conversation_status`, `update_conversation_status`, `get_lead`, `update_lead`).
- Pelo menos 1 slot de CRM configurado na instância (ex: `field01` → "Empresa").
- Painel aberto lado a lado com o terminal/log do agente, pra audiência ver os dois lados da mesma interação.

## Roteiro (≈2 min)

**1. Cliente manda mensagem (0:00–0:15)**
Número de teste manda "Oi, gostaria de saber sobre o produto X".

**2. Agente responde sozinho, com contexto (0:15–0:40)**
- Mostrar o agente chamando `get_lead` primeiro — tela dividida: log do agente à esquerda, painel à direita.
- Agente responde citando algo que já sabia do contato (ex: "Vi que você é da Acme Ltda, certo?") — prova visual de que consultou o CRM antes de responder, não é resposta genérica.
- Painel mostra badge "Bot" na conversa.

**3. Cliente pede atendente humano (0:40–0:55)**
Cliente manda "prefiro falar com uma pessoa".

**4. Atendente assume (0:55–1:15)**
- Atendente clica "Assumir conversa" no painel.
- Badge muda de "Bot" pra "Assigned" em tempo real, sem reload.
- **Corte para o log do agente:** próxima tentativa de resposta automática é bloqueada — mostrar o erro `blocked: true` retornado pela MCP tool. Deixar claro que isso é o backend recusando, não o agente "decidindo" parar.

**5. Atendente responde manualmente (1:15–1:35)**
Atendente digita e envia resposta pelo painel — mensagem chega no WhatsApp real.

**6. Atendente devolve ao bot (1:35–1:50)**
- Clica "Devolver ao bot".
- Badge volta pra "Bot".
- Agente volta a responder normalmente — provar com uma nova mensagem de teste.

**7. Fechamento (1:50–2:00)**
Card final com o pitch: *"O cérebro é o seu agente. O corpo com trava de segurança é o Zapo Manager."* Link pro repositório e pro guia de integração MCP.

## O que NÃO incluir

- Não mostrar `update_conversation_status` com `status: "open"` sendo chamado pelo próprio agente — isso é anti-padrão (documentado como erro em `AI-AGENTS-MCP-INTEGRATION.md`) e confundiria a audiência sobre quem deveria assumir.
- Não usar instância sandbox/fake — reduz a credibilidade da demo.
- Não cortar a parte do bloqueio (passo 4) — é o momento que prova a trava de segurança de verdade, não é só promessa em texto.

## Depois de gravar

Anexar o vídeo neste mesmo diretório (`docs/`) ou linkar de um serviço externo, e referenciar a partir do `README.md` na seção "O corpo com trava de segurança para o seu agente de IA".
