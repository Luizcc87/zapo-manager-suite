<div align="center">

<img src="public/assets/images/zapo-manager-logo-light.svg" alt="Zapo Manager" width="380"/>

**Frontend do Zapo Manager — painel React para gerenciamento de instâncias WhatsApp**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

</div>

---

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS 4** + **Radix UI**
- **TanStack Query v5** para cache e estado do servidor
- **React Hook Form** + **Zod** para formulários
- **i18next** — PT-BR · EN-US · ES-ES · FR-FR
- **Socket.io Client** para eventos em tempo real

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # ESLint com auto-fix
npm run type-check # tsc --noEmit
```

Na tela de login, a URL do backend (`http://localhost:8080`) será detectada e preenchida de forma automática se estiver rodando localmente (Vite dev server). Em produção, ela assume o próprio host/domínio em que a aplicação está rodando.

## Variáveis de Ambiente (opcionais)

```env
VITE_API_URL=http://localhost:8080          # Sobrescreve a URL do backend autodetectada
VITE_API_KEY=sua_chave_global               # Preenche automaticamente a chave API no formulário
# Também há suporte legível para VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY
```

Sem essas variáveis, a aplicação realiza a detecção automática e o usuário pode ajustar os campos na tela de login.

## Estrutura

```
src/
├── components/     # UI reutilizável (Radix + Tailwind)
├── pages/          # Páginas por rota
├── lib/
│   ├── queries/    # Hooks React Query por integração
│   └── provider/   # Feature flags por provider (api / go)
├── contexts/       # InstanceContext, EmbedInstanceContext
├── translate/      # Arquivos de i18n por idioma
└── types/          # Tipos TypeScript
```

## Docker

```bash
docker-compose up -d   # Nginx interno na porta 80
```

## Integrações suportadas

Chat · OpenAI · Dify · Typebot · Chatwoot · Flowise · N8N · EvoAI · Evolution Bot · Webhook · WebSocket · RabbitMQ · SQS · Proxy

## Créditos

Frontend baseado no [Evolution Manager v2](https://github.com/EvolutionAPI/evolution-manager-v2) © 2025 Evolution API Team.

