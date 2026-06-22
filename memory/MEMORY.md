# Memory Index — zapo-manager
*Atualizado: 2026-06-22*

## Contexto de projeto

- [Projeto zapo-manager](project_zapo_manager.md) — fork Evolution Manager v2, stack, features implementadas, estado atual
- [Registro Primário SMS/OTP](project_primary_registration.md) — Fases 1–6 concluídas; Baileys OTP fixes; proxy; testes E2E
- [Gerenciamento de versões WA](project_wa_version_management.md) — Web/Android/iOS separados; fetchers; tabela de erros OTP
- [Fix @lid JID Mobile Transport](project_chat_lid_fix.md) — Mobile Transport usa @lid; normalizar via remoteJidAlt
- [Sincronização de Histórico](project_history_sync.md) — requireFullSync, history_sync_chunk listener, limitação arquitetural
- [Configurações de Comportamento](project_behavior_settings.md) — rejectCall, readStatus, alwaysOnline, groupsIgnore, readMessages
- [Testes Playwright + Scalar API](project_testing_and_api.md) — suítes de teste, variáveis opt-in, openapi.yaml

## Infraestrutura e ambiente

- [Infraestrutura e Portas](infrastructure.md) — Porta TCP 5222 para mobile, VPS/Docker/Cloudflare Tunnel
- [Prisma DLL EPERM + predev removido](feedback_windows_prisma.md) — fix EPERM Windows; predev REMOVIDO intencionalmente

## Arquivos de referência

- [Arquivos-chave](reference_key_files.md) — mapa completo de arquivos backend/frontend/testes/docs

## Perfil e workflow

- [Perfil do usuário](user_profile.md) — dev sênior, multi-agente (Claude + Gemini), respostas curtas, master direto
- [Workflow e preferências](feedback_workflow.md) — master direto, aprova plano antes de executar, revisa diff de outro agente
