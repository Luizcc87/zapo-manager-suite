# Stage 1: Build the React Frontend (Evolution Manager v2)
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY zapo-manager/frontend/package*.json ./
RUN npm ci
COPY zapo-manager/frontend/ ./
RUN npm run build

# Stage 2: Build the TypeScript Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY zapo-manager/backend/package*.json ./
RUN npm ci
COPY zapo-manager/backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Final Production Image
FROM node:22-alpine AS production
WORKDIR /app

# Instalar ffmpeg para processamento de mídias e ferramentas de build nativo para npm install (better-sqlite3 / sharp)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    gcc \
    libc6-compat

# Copiar arquivos de configuração do backend
COPY zapo-manager/backend/package*.json ./
COPY zapo-manager/backend/prisma ./prisma/

# Instalar dependências de produção (compilando nativos para a arquitetura do container)
RUN npm ci --only=production && npx prisma generate

# Copiar arquivos compilados do backend para a pasta dist
COPY --from=backend-builder /app/dist ./dist/

# Copiar o frontend estático compilado para a pasta dist/public do backend
COPY --from=frontend-builder /app/dist ./dist/public/

# Remover ferramentas de compilação após o build para reduzir o tamanho da imagem
RUN apk del make g++ gcc python3

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/main.js"]
