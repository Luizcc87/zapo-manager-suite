# Memory Index — zapo-manager

- [Perfil do usuário](user_profile.md) — dev sênior, multi-agente (Claude + Gemini), respostas curtas, trabalha direto em master
- [Projeto zapo-manager](project_zapo_manager.md) — fork Evolution Manager v2, stack frontend/backend, provider duality ("api"/"go")
- [Registro Primário SMS/OTP](project_primary_registration.md) — Fases 1-4 concluídas; Prisma client regenerado; proxy + badges implementados
- [Workflow e preferências](feedback_workflow.md) — master direto, aprova plano antes de executar, revisa diff de outro agente antes de comentar
- [Arquivos-chave](reference_key_files.md) — onde encontrar queries, rotas, schema, i18n, componentes principais
- [Infraestrutura e Portas](infrastructure.md) — Porta TCP 5222 para mobile, VPS/Docker/Cloudflare Tunnel
- [Prisma DLL EPERM + predev](feedback_windows_prisma.md) — fix para EPERM no Windows e predev que some do package.json
- [Fix @lid JID Mobile Transport](project_chat_lid_fix.md) — Mobile Transport usa @lid; normalizar via remoteJidAlt; socket emite normalized (com messageType)
- [Gerenciamento de versões WA](project_wa_version_management.md) — Web=reativo (zapo-js interno), Mobile=proativo (startup + 03:00 diário via Play Store)
