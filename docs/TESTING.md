# Testes E2E (Playwright) — Zapo Manager Suite

Este documento descreve como a suíte de testes de integração e ponta a ponta (E2E) está organizada no **Zapo Manager Suite**, quais são as variáveis de ambiente necessárias e como executar os testes em diferentes cenários.

---

## 📖 Visão Geral

Os testes são implementados utilizando o framework **Playwright** (`@playwright/test`) e estão localizados no diretório `tests/` na raiz do monorepo. Todos os testes são baseados em chamadas HTTP no nível de API contra o backend real executando em `http://127.0.0.1:8080`.

---

## 🚀 Como Executar

### Comandos Básicos

```bash
# Rodar todos os testes locais (CI-safe, pula testes que exigem conexões físicas com o WhatsApp)
npx playwright test

# Rodar apenas os testes de registro primário (Suite A)
npx playwright test tests/zapo-primary-registration.spec.ts

# Debug interativo
npx playwright test --debug tests/zapo-primary-registration.spec.ts

# Ver relatório de execução HTML
npx playwright show-report
```

---

## 🔒 Variáveis de Ambiente

Os testes utilizam variáveis de ambiente para customizar os comportamentos ou para fornecer credenciais de teste para conexões de WhatsApp reais:

| Nome da Variável | Valor Padrão | Descrição | Obrigatória em... |
|---|---|---|---|
| `GLOBAL_API_KEY` | `global_key` | Chave de API Global para autenticar no backend. | Sempre (padrão assumido se ausente) |
| `PLAYWRIGHT_BASE_URL` | `http://127.0.0.1:8080` | URL do servidor backend para as chamadas de teste. | Sempre (padrão assumido se ausente) |
| `TEST_CONNECTED_INSTANCE` | — | Nome de uma instância que já esteja conectada para testes de envio de mensagens reais. | Testes de fumaça reais (`zapo-smoke-real.spec.ts`) |
| `TEST_PRIMARY_PHONE` | — | Número do WhatsApp em formato completo (DDI + DDD + número) a ser registrado via OTP. | Suite B de Registro Primário |
| `TEST_OTP_CODE` | — | Código OTP de 6 dígitos recebido por SMS/Voz para o número de teste. | Teste de Happy Path da Suite B do Registro Primário |

---

## 🧩 Suítes Disponíveis

| Arquivo de Teste | O que Cobre | Pré-requisitos |
|---|---|---|
| [zapo.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo.spec.ts) | Operações gerais de instância, CRUD de mensagens, conexões simuladas e verificação de limites. | Nenhum (CI-Safe) |
| [zapo-mobile.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-mobile.spec.ts) | Criação de instâncias com transporte móvel. | Nenhum (CI-Safe) |
| [zapo-settings-webhook.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-settings-webhook.spec.ts) | Persistência e busca de configurações de comportamento e webhooks. | Nenhum (CI-Safe) |
| [zapo-primary-registration.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-primary-registration.spec.ts) | Validações e fluxo de Registro Primário via SMS OTP. | **Suite A:** Nenhuma.<br>**Suite B:** `TEST_PRIMARY_PHONE` e `TEST_OTP_CODE`. |
| [zapo-smoke-real.spec.ts](file:///d:/Projetos%20Dev/Outros/apis-whatsapp-doc-testes/zapo-manager/tests/zapo-smoke-real.spec.ts) | Teste de fumaça real de envio de mensagens em lote. | Requer `TEST_CONNECTED_INSTANCE`. |

---

## 📲 Executando Testes com Infraestrutura Real (Registro Primário)

Como o Registro Primário exige o recebimento e validação de um SMS real nos servidores do WhatsApp, a execução do fluxo feliz do Registro Primário (Suite B) é executada em etapas no terminal do operador:

### Fluxo de Registro Primário Interativo

1. **Solicitar o envio do SMS/OTP:**
   Defina o telefone de testes na variável `TEST_PRIMARY_PHONE` e execute apenas os testes de solicitação de código:
   ```bash
   TEST_PRIMARY_PHONE=+5511999990000 npx playwright test --grep "Solicita código" tests/zapo-primary-registration.spec.ts
   ```
   *Nota: Esse comando enviará o código de 6 dígitos por SMS para o telefone fornecido.*

2. **Obter o código do chip físico:**
   Verifique no dispositivo o SMS recebido (por exemplo: `123-456`).

3. **Confirmar o código na suíte:**
   Defina as variáveis com o telefone e o OTP recebido para rodar o Happy Path completo:
   ```bash
   # No Windows (PowerShell)
   $env:TEST_PRIMARY_PHONE="+5511999990000"
   $env:TEST_OTP_CODE="123456"
   npx playwright test tests/zapo-primary-registration.spec.ts

   # No Linux/macOS ou Git Bash
   TEST_PRIMARY_PHONE=+5511999990000 TEST_OTP_CODE=123456 npx playwright test tests/zapo-primary-registration.spec.ts
   ```

---

## 🛠️ Adicionando Novos Testes

Siga as seguintes convenções ao expandir a suíte de testes:

1. **Localização:** Crie novos arquivos sempre dentro do diretório `tests/` com a extensão `.spec.ts`.
2. **Nomenclatura:** Use o prefixo `zapo-` seguido do nome da funcionalidade (ex: `zapo-chat-history.spec.ts`).
3. **Isolamento:** Cada `test.describe` deve ser auto-contido. Crie instâncias temporárias para o teste e garanta o cleanup no hook `test.afterAll`.
4. **Segurança em CI:** Se o teste depender de interações reais do WhatsApp ou SMS, certifique-se de que ele use `test.skip` baseado na ausência das variáveis de ambiente necessárias.
5. **Idioma:** Siga o padrão do projeto escrevendo os comentários e descrições dos testes em **Português (PT-BR)**.
6. **Código Limpo:** Nunca comite arquivos contendo `test.only`.
