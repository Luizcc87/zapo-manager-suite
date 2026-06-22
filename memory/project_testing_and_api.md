---
name: project-testing-and-api
description: "Suíte de testes Playwright, API Scalar Reference, e padrões de testing do projeto (2026-06-22)"
metadata:
  node_type: memory
  type: project
---

## Suíte de Testes Playwright

### Como rodar

```powershell
# Pré-requisito: Redis rodando
docker compose up -d redis

# Rodar todas as suítes
npx playwright test

# Suíte específica
npx playwright test tests/zapo.spec.ts

# Suíte com WhatsApp real (opt-in)
TEST_PRIMARY_PHONE=5511999999999 TEST_OTP_CODE=123456 npx playwright test tests/zapo-primary-registration.spec.ts --grep "Suite B"
```

### Arquitetura do ciclo de vida

- `tests/global-setup.ts`: limpa locks Redis (`lock:zapo:*`) antes dos testes para evitar locks fantasmas
- Backend é iniciado pelo Playwright via `npm run dev` na porta `8080`; se já rodando, reutiliza
- Playwright garante o desligamento completo do backend ao finalizar

### Suítes existentes

| Arquivo | Tipo | Descrição |
|---|---|---|
| `tests/zapo.spec.ts` | Integração | Instâncias, ciclo de vida, auth/authorization |
| `tests/zapo-settings-webhook.spec.ts` | Integração | Settings e webhook CRUD isolados |
| `tests/zapo-primary-registration.spec.ts` | Integração | Suite A (CI-safe, contratos) + Suite B (real OTP, opt-in) |
| `tests/zapo-webhook-delivery.real.spec.ts` | Real WA | Entrega de webhook com receiver HTTP local (opt-in) |

### Variáveis de ambiente para testes opt-in

| Var | Uso |
|---|---|
| `TEST_PRIMARY_PHONE` | Número real para Suite B (formato 55DDNNNNNNNNN) |
| `TEST_OTP_CODE` | Código OTP recebido (preencher após solicitar) |

### Testes unitários (vitest)

```powershell
cd backend
npx vitest run src/tests/
```

Suítes: `device-proxy-otp.test.ts`, `chat-corrections.test.ts`, `zapo-webhook-delivery.test.ts`

---

## Scalar API Reference

- **Endpoint:** `GET /api-docs` — UI interativa com tema "saturn" da Scalar
- **Spec:** `backend/openapi.yaml` — OpenAPI 3.1.0 com todos os endpoints documentados
- **Implementado em:** 2026-06-22 (conversa cdd938c2)

Grupos de endpoints na spec:
- Instâncias (CRUD + connect/disconnect/QR)
- Registro Primário (requestCode, confirmCode)
- Configurações (settings, webhook, proxy)
- Mensagens (text, media, buttons, list, carousel, sticker, document, audio)
- Chats + Mensagens (findChats, findMessages, debug)

---

## Padrões e Aprendizados de Testing

### Webhook testing
- `sendWebhook()` usa `AbortSignal.timeout(10_000)`, verifica `response.ok`, lança em 4xx/5xx
- Retry com backoff exponencial (1s, 2s, 4s) — 3 tentativas
- Para testar entrega: usar receiver HTTP local (vide `zapo-webhook-delivery.test.ts`)

### Mock vs Real
- Suite A = sem WhatsApp real, valida contratos de API e erros esperados
- Suite B = com WhatsApp real, usa variáveis de ambiente, sempre opt-in via `--grep`
- Nunca hardcodar números reais nos testes

**How to apply:** Sempre que adicionar endpoint novo, atualizar `backend/openapi.yaml`. Ao adicionar feature nova com comportamento testável, criar ao menos Suite A (CI-safe) correspondente.
