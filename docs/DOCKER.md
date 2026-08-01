# Docker — Build e Deploy

## Pré-requisitos

```bash
docker buildx create --use --name evo-multiarch   # uma vez por máquina
docker login                                        # autenticar no Docker Hub
```

---

## Build multi-arch (amd64 + arm64)

```bash
# tags: zapo-js-<versao-resolvida> + latest
bash scripts/build-push.sh

# tag específica + latest
bash scripts/build-push.sh v1.2.0

# somente latest
bash scripts/build-push.sh latest
```

Imagem publicada em: `lc1868/zapo-manager`  
Plataformas: `linux/amd64`, `linux/arm64`

---

## Dev local (docker-compose)

Sobe app + postgres + redis em rede local sem Swarm:

```bash
docker compose up -d
```

Acesse: http://localhost:8082  
Arquivo: [`docker-compose.yml`](../docker-compose.yml)

> **Nota:** `GLOBAL_API_KEY=global_key` é só para dev local — não usar em produção.

---

## Produção — Docker Swarm

### 1. Pré-requisito: rede pública

```bash
docker network create --driver overlay --attachable network_swarm_public
```

### 2. Configurar variáveis

```bash
cp .env.example .env
# editar .env com valores reais
export $(cat .env | xargs)
```

Gerar credenciais:
```bash
export GLOBAL_API_KEY=$(openssl rand -hex 32)
export POSTGRES_PASSWORD=$(openssl rand -base64 24)
export SERVER_URL=https://zapo.seu-dominio.com
```

Alertas Telegram opcionais:

```bash
export TELEGRAM_ALERTS_ENABLED=true
export TELEGRAM_BOT_TOKEN=<token-do-bot>
export TELEGRAM_CHAT_ID=<chat-id>
export TELEGRAM_ALERT_DEDUPE_SECONDS=600
export TELEGRAM_ALERT_CONNECTION_EVENTS=false
export INSTANCE_EVENTS_RETENTION_DAYS=30
```

Sem essas variáveis, nenhum alerta externo é enviado. Alertas de desconexão ficam desligados por padrão e exigem `TELEGRAM_ALERT_CONNECTION_EVENTS=true` para evitar ruído em loops de reconexão. Erros de entrega no Telegram não interrompem conexão, proxy, webhook ou envio de mensagens.

`INSTANCE_EVENTS_RETENTION_DAYS` controla a limpeza automática dos eventos internos exibidos na dashboard. O padrão sugerido é 30 dias; use `0` apenas se quiser desativar essa limpeza e assumir a retenção externamente.

Além do fallback global por `.env`, o backend aceita canais Telegram por instância via API:

- `GET /notification/channels/:instanceName`
- `POST /notification/channels/:instanceName`
- `POST /notification/channels/:instanceName/:channelId`
- `DELETE /notification/channels/:instanceName/:channelId`

O `botToken` é usado somente para envio e volta mascarado nas respostas.

### 3. Deploy

```bash
docker stack deploy -c docker-stack-swarm.yaml zapo --with-registry-auth
```

Arquivo: [`docker-stack-swarm.yaml`](../docker-stack-swarm.yaml)

### 4. Verificar

```bash
docker stack services zapo
docker service logs zapo_app --follow
```

### 5. Atualizar imagem (rolling update)

```bash
bash scripts/build-push.sh          # rebuild + push zapo-js-<versao> + latest
docker service update --image lc1868/zapo-manager:latest zapo_app
```

---

## Cloudflare Tunnel

Rota o tráfego público para o container sem expor porta no host:

| Campo           | Valor              |
|-----------------|--------------------|
| Service name    | `zapo_app`         |
| Port            | `8080`             |
| URL no tunnel   | `http://zapo_app:8080` |
| Public hostname | `zapo.seu-dominio.com` |

O `cloudflared` deve estar na rede `network_swarm_public`.
