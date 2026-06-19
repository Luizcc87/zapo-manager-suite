# Zapo-Manager

Este repositório contém o **Zapo-Manager**: uma solução unificada de gerenciamento do WhatsApp Web que integra o painel administrativo oficial do **Evolution Manager v2** com um backend customizado baseado na biblioteca **Zapo** (`zapo-js`), emulando as rotas da **Evolution API v2**.

O projeto é otimizado para rodar em clusters **Docker Swarm** com suporte a arquiteturas **x86_64** (amd64) e **ARM64** (arm64), além de possuir mecanismos robustos de lock distribuído para mitigar banimentos e conflitos de sessão.

---

## 📁 Estrutura do Projeto

O ecossistema Zapo-Manager é composto por dois módulos principais:

*   **`zapo-manager/backend/`**: Servidor Node.js + TypeScript + Express + Prisma. Ele emula as rotas REST da Evolution API v2 para gerenciamento de instâncias (criar, conectar, QR code) e envio/recebimento de mensagens, servindo também os arquivos estáticos do frontend.
*   **`zapo-manager/frontend/`**: Interface administrativa SPA em React + Tailwind CSS clonada diretamente do repositório dos mantenedores originais do Evolution Manager v2.

---

## ⚙️ Variáveis de Ambiente (Backend)

Crie um arquivo `.env` dentro de `zapo-manager/backend/` ou passe-as diretamente no contêiner:

| Variável | Descrição | Valor Padrão / Exemplo |
| :--- | :--- | :--- |
| `PORT` | Porta em que o gateway Express irá rodar. | `8080` |
| `GLOBAL_API_KEY` | Token global de autenticação (usado no header `apikey`). | `global_key` |
| `DATABASE_URL` | Banco de dados PostgreSQL (Prisma) ou SQLite fallback. | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_URL` | Redis usado para cache de sinal e locks distribuídos. | `redis://localhost:6379/0` |
| `WEBHOOK_URL` | URL global de destino para envio de webhooks de conexão/mensagens. | `http://seu-webhook.com/webhook` |

---

## 🚀 Como Executar em Desenvolvimento (Local Dev)

Você tem duas formas de rodar e debugar a aplicação em desenvolvimento local:

### Método A: Execução Simplificada (Orquestrada a partir da Raiz)
Se você estiver diretamente dentro do diretório `zapo-manager/`, você pode instalar as dependências e iniciar o frontend e o backend simultaneamente com apenas dois comandos, sem precisar navegar por outras pastas:

1.  **Instalar dependências de ambos os projetos:**
    ```bash
    npm install
    ```
    *(Este comando roda a instalação do root, backend e frontend sequencialmente).*
2.  **Preparar o banco de dados local (Prisma):**
    Navegue até a pasta `backend/` para preparar o banco de dados (seja SQLite ou Postgres):
    ```bash
    cd backend
    npx prisma db push
    cd ..
    ```
3.  **Iniciar Frontend e Backend simultaneamente:**
    ```bash
    npm run dev
    ```
    *(Este comando iniciará o backend na porta `8080` e o frontend na porta `5173` usando `concurrently`).*

---

### Método B: Execução Manual (Passo a Passo)
Caso prefira rodar e analisar cada serviço em terminais separados:

#### Passo 1: Preparar e Iniciar o Backend
1.  Navegue até a pasta do backend:
    ```bash
    cd zapo-manager/backend
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Gere o cliente do Prisma ORM e prepare o banco:
    ```bash
    npx prisma generate
    npx prisma db push
    ```
4.  Inicie o servidor em modo de desenvolvimento:
    ```bash
    npm run dev
    ```
    *O servidor estará escutando em `http://localhost:8080`.*

#### Passo 2: Preparar e Iniciar o Frontend
1.  Navegue até a pasta do frontend (em uma nova janela do terminal):
    ```bash
    cd zapo-manager/frontend
    ```
2.  Instale as dependências:
    ```bash
    npm install
    ```
3.  Inicie o servidor de desenvolvimento do Vite:
    ```bash
    npm run dev
    ```
    *O painel administrativo estará acessível no navegador em `http://localhost:5173`.*

---

### Passo 3: Acessar a Interface
Ao carregar a tela de Login em `http://localhost:5173`, insira o endereço do seu backend local (`http://localhost:8080`) e utilize a sua `GLOBAL_API_KEY` (`global_key`) para se autenticar.

---

## 🐳 Execução em Produção e Dockerização

O Zapo-Manager foi projetado para facilitar a distribuição e implantação estável.

### Opção A: Docker Compose Local
Para rodar toda a infraestrutura (Postgres + Redis + Zapo-Manager Gateway) localmente em um único comando:
1.  Na pasta `zapo-manager`, execute:
    ```bash
    docker-compose up -d --build
    ```
2.  Acesse o painel visual diretamente em `http://localhost:8080`.

### Opção B: Docker Swarm (Arquitetura Distribuída)
Em clusters Swarm, a escalabilidade horizontal irrestrita de conexões de WhatsApp pode levar a loops de reconexão e banimentos. Por isso:
*   O serviço `zapo-manager-app` é configurado com `deploy.replicas: 1`.
*   A estratégia de update é definida como `order: stop-first`, assegurando que a réplica antiga desconecte e pare totalmente antes que a nova suba.
*   O backend utiliza o lock distribuído no Redis (`lock:zapo:<instancia>`) para garantir que apenas um contêiner no cluster consiga inicializar o socket com o WhatsApp por vez.

Realize o deploy da stack:
```bash
docker stack deploy -c docker-compose.yml zapo-stack
```

### Compilação Multi-Arquitetura (x86 / ARM)
Se você estiver implantando em uma infraestrutura híbrida (como servidores x86 em nuvem com nós locais em Raspberry Pi / ARM), você pode compilar imagens Docker universais utilizando o script `docker_build.sh`:
```bash
sh docker_build.sh
```
*Este script inicializa o `docker buildx` para gerar e empurrar imagens otimizadas com compilação nativa de dependências binárias (`sharp`, `better-sqlite3`) para ambas as plataformas.*
