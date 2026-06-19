# Stage 1: Build the React Frontend (Evolution Manager v2)
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the TypeScript Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY backend/ ./
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
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Instalar dependências de produção (compilando nativos para a arquitetura do container)
# npx prisma generate NÃO é executado aqui: prisma é devDependency e o npx baixaria a versão
# mais recente (v7+, que tem breaking changes). O Prisma Client gerado pelo backend-builder
# (mesmo arch) é copiado diretamente abaixo.
RUN npm ci --only=production --legacy-peer-deps

# Copiar arquivos compilados do backend para a pasta dist
COPY --from=backend-builder /app/dist ./dist/

# Copiar o Prisma Client gerado pelo backend-builder (mesmo arch — funciona em multi-arch build)
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma/
COPY --from=backend-builder /app/node_modules/@prisma/client ./node_modules/@prisma/client/

# Copiar o frontend estático compilado para a pasta dist/public do backend
COPY --from=frontend-builder /app/dist ./dist/public/

# Remover ferramentas de compilação após o build para reduzir o tamanho da imagem
RUN apk del make g++ gcc python3

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/main.js"]
