# White-Label e Versionamento Unificado

Este documento especifica a arquitetura e as variáveis para personalização visual (White-Label) e versionamento unificado no **Zapo Manager**.

---

## 🎨 Conceito Arquitetural

Toda a personalização de marca e exibição de versão é centralizada em dois arquivos principais:

1. **`frontend/src/config/app-config.ts`**: Define os valores padrão de marca, URLs, logos e descrições.
2. **`frontend/src/hooks/useAppConfig.ts`**: Hook React que unifica as configurações locais com as informações dinâmicas retornadas pelo backend (`GET /`), calculando a tag de versão padronizada (`v1.6.20 (Zapo: v1.6.2)`).

Todas as páginas principais ([Home.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/Home.tsx), [Login/index.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/pages/Login/index.tsx) e [sidebar.tsx](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/frontend/src/components/sidebar.tsx)) consomem este hook, garantindo exibição 100% sincronizada sem redundâncias de código.

---

## ⚙️ Variáveis de Ambiente (Frontend & Backend)

### Frontend (`.env` ou Docker Build Args)

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_APP_NAME` | `Zapo Manager` | Nome da aplicação exibido na Home, Login e Sidebar. |
| `VITE_APP_VERSION` | `1.6.20` | Versão da release oficial da suíte. |
| `VITE_APP_DESCRIPTION` | `Painel de gerenciamento para a Zapo API` | Subtítulo exibido na tela inicial. |
| `VITE_APP_LOGO_DARK` | `/assets/images/zapo-manager-logo.svg` | Caminho/URL da logo para tema escuro. |
| `VITE_APP_LOGO_LIGHT` | `/assets/images/zapo-manager-logo-light.svg` | Caminho/URL da logo para tema claro. |
| `VITE_APP_COPYRIGHT` | `Zapo Manager` | Nome do titular do copyright no rodapé. |
| `VITE_APP_GITHUB_URL` | `https://github.com/Luizcc87/zapo-manager-suite` | Link para repositório ou página de suporte. |
| `VITE_APP_DOCS_URL` | `https://github.com/vinikjkkj/zapo` | Link da documentação da API do motor. |

### Backend (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `APP_VERSION` | `1.6.20` | Versão exposta em `GET /` e `GET /runtime/status`. |

---

## 🛠️ Exemplo de Configuração (.env)

```env
# Configuração de Marca Própria (White-Label)
VITE_APP_NAME="EmpresaZap Manager"
VITE_APP_VERSION="2.0.0"
VITE_APP_DESCRIPTION="Painel corporativo de gerenciamento de instâncias WhatsApp"
VITE_APP_LOGO_DARK="/assets/images/custom-logo-dark.svg"
VITE_APP_LOGO_LIGHT="/assets/images/custom-logo-light.svg"
VITE_APP_COPYRIGHT="EmpresaZap Soluções Tecnológicas"
VITE_APP_GITHUB_URL="https://github.com/sua-empresa/whats-manager"
VITE_APP_DOCS_URL="https://docs.sua-empresa.com"

# Backend Version Override
APP_VERSION="2.0.0"
```

---

## 🐳 Deploy White-Label com Docker

Ao compilar uma imagem customizada com argumentos de build Vite:

```bash
docker build \
  --build-arg VITE_APP_NAME="EmpresaZap Manager" \
  --build-arg VITE_APP_VERSION="2.0.0" \
  --build-arg VITE_APP_LOGO_DARK="/assets/images/custom-logo-dark.svg" \
  -t sua-empresa/zapo-manager:v2.0.0 .
```
