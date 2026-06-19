# Configuração de Ambiente de Desenvolvimento

## Pré-requisitos

- Node.js 18+
- npm 8+
- PostgreSQL (ou SQLite para testes locais rápidos)
- Redis

## Método A: Execução Orquestrada (recomendado)

Na raiz do repositório:

```bash
# Instala dependências de todos os projetos
npm install

# Inicia backend (porta 8080) + frontend (porta 5173) simultaneamente.
# Certifique-se de que o PostgreSQL e Redis estejam em execução.
# As migrations serão aplicadas automaticamente no bootstrap do backend.
npm run dev
```

Acesse `http://localhost:5173` (a URL da API `http://localhost:8080` será detectada e preenchida automaticamente no campo "URL do Servidor" durante o desenvolvimento local) e use a `GLOBAL_API_KEY` configurada no `.env`.

## Método B: Serviços Separados

Útil para debugar cada serviço independentemente.

### Backend

```bash
cd backend
npm install
npx prisma generate
npm run dev
# Escuta em http://localhost:8080
# As migrations serão aplicadas automaticamente no bootstrap do backend.
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Escuta em http://localhost:5173
```

## Variáveis de Ambiente

Crie `backend/.env`:

```env
PORT=8080
GLOBAL_API_KEY=global_key
DATABASE_URL=postgresql://user:pass@localhost:5432/zapo_db
REDIS_URL=redis://localhost:6379/0
WEBHOOK_URL=http://seu-webhook.com/webhook
```

## Regenerando o Prisma Client

O arquivo `query_engine-windows.dll.node` fica bloqueado enquanto o servidor estiver rodando. Pare o servidor antes de regenerar:

```bash
# 1. Parar o dev server
# 2. Gerar o client
cd backend && npx prisma generate
# 3. Reiniciar
npm run dev
```

## Migrations de Schema

Ver [CLAUDE.md](../CLAUDE.md) — seção "Backend Database Migrations" para o padrão de migrations idempotentes obrigatório neste projeto.
