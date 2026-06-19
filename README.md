<div align="center">

<img src="frontend/public/assets/images/zapo-manager-logo-light.svg" alt="Zapo Manager" width="420"/>

**Painel web para gerenciamento de instâncias WhatsApp via Zapo API**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](frontend/LICENSE)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Swarm%20ready-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

[GitHub](https://github.com/Luizcc87) · [Reportar Issue](https://github.com/Luizcc87/zapo-manager/issues) · [Docs](docs/)

</div>

---

## O que é a Zapo API?

[Zapo](https://github.com/vinikjkkj/zapo) (`zapo-js`) é uma biblioteca Node.js que implementa o protocolo nativo do WhatsApp — o mesmo protocolo que o aplicativo oficial usa no celular. É **compatível com a API REST da Evolution API v2**, funcionando como um drop-in replacement.

### Por que Zapo é diferente das outras APIs de WhatsApp?

A maioria das APIs de WhatsApp (incluindo a Evolution API clássica) usa **WebSocket**, emulando uma aba de navegador (Chrome/Safari). O Zapo usa **TCP Socket direto**, emulando o protocolo nativo de um aplicativo Android. Isso tem impacto direto em estabilidade e risco de banimento.

### Modos de Conexão

| | WhatsApp Web (padrão do mercado) | Zapo Mobile — Companion | Zapo Mobile — Primário |
|---|---|---|---|
| **Protocolo** | WebSocket (navegador) | **TCP nativo (app Android)** | **TCP nativo (app Android)** |
| **Emula** | Chrome/Firefox | Tablet Android | Celular Android (conta master) |
| **QR Code** | Sim | Sim | **Não** |
| **Celular físico necessário** | Sempre ligado | Pode ser desligado | **Não existe** |
| **Risco de ban** | Médio | **Muito baixo** | **Extremamente baixo** |
| **Estabilidade** | Média | **Altíssima** | **Altíssima** |

**Companion (recomendado):** escaneie QR Code pelo celular uma vez — o Zapo roda de forma independente no servidor. Celular pode ser desligado.

**Primário:** o Zapo assume a identidade do celular principal. Sem QR Code, sem celular físico. Ideal para números dedicados a automação. ⚠️ Desloga o app do celular físico.

> Documentação completa dos modos: [docs/zapo_connection_modes.md](docs/zapo_connection_modes.md)

### Lock Distribuído (Swarm-safe)

O backend usa **locks Redis** (`lock:zapo:<instancia>`) para garantir que apenas um container conecte ao WhatsApp por vez — prevenindo banimentos por dupla conexão em ambientes com múltiplas réplicas.

---

## Sobre este projeto

**Zapo Manager** é o painel administrativo que expõe e gerencia a Zapo API. O sistema é composto por dois módulos:

| Módulo | Stack | Função |
|---|---|---|
| `backend/` | Node.js · TypeScript · Express · Prisma · Redis | Emula a API REST da Evolution API v2, gerencia sessões WhatsApp, distribui webhooks |
| `frontend/` | React 18 · Vite · Tailwind CSS 4 · TanStack Query | SPA administrativa — dashboard, chat, integrações, configurações |

Projetado para rodar em **Docker Swarm** com suporte a **x86_64** e **ARM64**.

---

## Funcionalidades do Painel

- Dashboard com múltiplas instâncias WhatsApp
- Interface de chat com histórico e busca
- Registro de número primário via SMS/OTP
- Integrações: OpenAI · Dify · Typebot · Chatwoot · Flowise · N8N · Webhooks · RabbitMQ · SQS · WebSocket
- Tema claro/escuro · i18n: PT-BR · EN-US · ES-ES · FR-FR

---

## Quick Start

### Docker Compose (recomendado)

```bash
git clone https://github.com/Luizcc87/zapo-manager.git
cd zapo-manager

# Copie e ajuste as variáveis
cp backend/.env.example backend/.env

# Suba todos os serviços (app + PostgreSQL + Redis)
docker-compose up -d --build
```

Acesse `http://localhost:8080` → use a `GLOBAL_API_KEY` definida no `.env`.

### Docker Swarm

```bash
docker stack deploy -c docker-compose.yml zapo-stack
```

> O serviço é configurado com `replicas: 1` e `order: stop-first` para garantir que apenas uma instância conecte ao WhatsApp por vez.

### Build Multi-Arquitetura (x86 + ARM64)

```bash
sh docker_build.sh
```

---

## Variáveis de Ambiente

Configure em `backend/.env`:

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta do servidor Express | `8080` |
| `GLOBAL_API_KEY` | Token de autenticação global (header `apikey`) | `minha_chave_secreta` |
| `DATABASE_URL` | PostgreSQL via Prisma | `postgresql://user:pass@localhost:5432/zapo_db` |
| `REDIS_URL` | Redis para cache e locks distribuídos | `redis://localhost:6379/0` |
| `WEBHOOK_URL` | Destino global para webhooks de eventos | `https://meu-webhook.com/hook` |

---

## Desenvolvimento Local

```bash
npm install        # instala dependências (root + backend + frontend)
# Garanta que o PostgreSQL e o Redis estejam em execução antes do próximo comando
npm run dev        # inicia backend :8080 + frontend :5173 (migrations rodam automaticamente)
```

Documentação detalhada: [docs/DEV_SETUP.md](docs/DEV_SETUP.md)

---

## Hospedagem Recomendada

Para hospedar o Zapo Manager em produção, recomendamos a **Hostinger** — VPS acessíveis com suporte a Docker e excelente custo-benefício no Brasil.

👉 **[Conheça os planos da Hostinger](https://www.hostinger.com/br?REFERRALCODE=PHGLUIZCCVNL)**

---

## Licença e Créditos

Este projeto é distribuído sob a **Apache License 2.0**.

- Frontend baseado no [Evolution Manager v2](https://github.com/EvolutionAPI/evolution-manager-v2) © 2025 Evolution API Team.
- Backend baseado na biblioteca [Zapo](https://github.com/vinikjkkj/zapo) © 2026 vinikjkkj (MIT).

Consulte [frontend/LICENSE](frontend/LICENSE) para os termos completos.

---

<div align="center">

Feito por [Luiz Carlos Ceconi](https://github.com/Luizcc87)

</div>
