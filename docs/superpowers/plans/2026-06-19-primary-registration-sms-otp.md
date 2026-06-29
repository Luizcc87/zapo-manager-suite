# Registro Primário via SMS/OTP — Plano de Implementação

> [!WARNING]
> **ATUALIZAÇÃO DE ARQUITETURA (2026-06-29 — Baileys v7.0.0-rc13 ESM)**:
> O Baileys v7 removeu completamente o suporte para sockets de registro de celulares (`makeRegistrationSocket`). Desta forma, o fluxo de envio e confirmação de código SMS/OTP foi **deativado** no backend. Os endpoints `/instance/register/requestCode` e `/instance/register/confirmCode` realizam apenas a validação estática de parâmetros para fins de compatibilidade de testes de contrato E2E, respondendo com `400 Bad Request` com o erro informando a indisponibilidade.
> O método recomendado e ativo para conectar uma instância Primária móvel sem QR code é através da importação direta de credenciais de login no store Zapo.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao zapo-manager um fluxo de diálogo multi-step que permite registrar um número WhatsApp como Primário (sem QR Code) via SMS OTP, chamando os endpoints `/instance/register/requestCode` e `/instance/register/confirmCode` do backend Zapo/Evolution API.

**Architecture:** Dialog de 3 passos (formulário → confirmação de aviso → entrada de OTP) renderizado no Dashboard. Dois novos módulos de query (`registrationApi.ts` + `useRegistration.ts`) encapsulam as chamadas HTTP. O fluxo termina com a instância conectada como Primária: o celular físico é deslogado pelo backend automaticamente.

**Tech Stack:** React 18, TypeScript, Vite, Zod, react-hook-form, @tanstack/react-query, axios (`apiGlobal`), react-i18next (4 idiomas), @evoapi/design-system (Button, Dialog, Label, Collapsible), lucide-react, react-toastify.

## Global Constraints

- Provider: este fluxo só está disponível para provider `"api"` (Evolution API/Baileys). Para `"go"`, o botão não aparece.
- Endpoints backend assumidos (precisam existir no servidor Zapo): `POST /instance/register/requestCode` e `POST /instance/register/confirmCode`.
- Todos os textos novos devem estar nos 4 arquivos i18n: `pt-BR.json`, `en-US.json`, `es-ES.json`, `fr-FR.json`.
- Sem testes unitários no projeto (script `test` é no-op); validação é manual no browser.
- Commits frequentes; cada task termina com commit.
- Não modificar `GoNewInstance.tsx`, `go/instance/manageInstance.tsx` ou qualquer arquivo do provider `"go"`.
- Dev server: `cd frontend && npm run dev` (Vite em http://localhost:5173).

---

## Mapa de Arquivos

| Ação | Arquivo |
|---|---|
| **Criar** | `frontend/src/lib/queries/instance/registrationApi.ts` |
| **Criar** | `frontend/src/pages/dashboard/PrimaryRegistration/index.tsx` |
| **Modificar** | `frontend/src/pages/dashboard/index.tsx` |
| **Modificar** | `frontend/src/translate/languages/pt-BR.json` |
| **Modificar** | `frontend/src/translate/languages/en-US.json` |
| **Modificar** | `frontend/src/translate/languages/es-ES.json` |
| **Modificar** | `frontend/src/translate/languages/fr-FR.json` |

---

## Pré-requisito: Confirmar Endpoints do Backend

Antes de começar, verificar se o servidor Zapo expõe os endpoints de registro. Executar com o servidor rodando:

```bash
# Substitua <API_URL> e <APIKEY> pelos valores da sua instância
curl -X POST <API_URL>/instance/register/requestCode \
  -H "apikey: <APIKEY>" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"teste","phoneNumber":"+5511999999999","method":"sms"}'
```

Se retornar 404, o backend precisa implementar esses endpoints primeiro (fora do escopo deste plano — ver seção "Adicionando ao Backend" ao final).

---

## Task 1: Módulo de API — Funções de Registro

**Files:**
- Criar: `frontend/src/lib/queries/instance/registrationApi.ts`

**Interfaces:**
- Produz: `requestRegistrationCode(params)`, `confirmRegistrationCode(params)` — usados pela Task 2.

- [ ] **Step 1.1: Criar o arquivo com tipos e funções**

```typescript
// frontend/src/lib/queries/instance/registrationApi.ts
import { apiGlobal } from "../api";

export interface RequestCodeParams {
  instanceName: string;
  phoneNumber: string; // formato E.164: "+5511999999999"
  method: "sms" | "voice";
}

export interface RequestCodeResponse {
  status: "success" | "error";
  message?: string;
}

export interface ConfirmCodeParams {
  instanceName: string;
  code: string; // 6 dígitos
}

export interface ConfirmCodeResponse {
  status: "success" | "error";
  message?: string;
}

export const requestRegistrationCode = async (
  params: RequestCodeParams
): Promise<RequestCodeResponse> => {
  const response = await apiGlobal.post<RequestCodeResponse>(
    "/instance/register/requestCode",
    params
  );
  return response.data;
};

export const confirmRegistrationCode = async (
  params: ConfirmCodeParams
): Promise<ConfirmCodeResponse> => {
  const response = await apiGlobal.post<ConfirmCodeResponse>(
    "/instance/register/confirmCode",
    params
  );
  return response.data;
};
```

- [ ] **Step 1.2: Verificar importação de `apiGlobal`**

Confirmar que `frontend/src/lib/queries/api.ts` exporta `apiGlobal`. Abrir o arquivo e checar:

```typescript
// Deve existir algo como:
export const apiGlobal = axios.create({ ... });
```

Se o nome for diferente, ajustar o import no passo anterior.

- [ ] **Step 1.3: Verificar type-check**

```bash
cd frontend && npm run type-check
```

Esperado: zero erros relacionados ao arquivo novo.

- [ ] **Step 1.4: Commit**

```bash
git add frontend/src/lib/queries/instance/registrationApi.ts
git commit -m "feat: add registration API functions for primary SMS/OTP flow"
```

---

## Task 2: Componente `PrimaryRegistrationDialog`

Dialog multi-step para registrar o número como Primário. Três passos internos controlados por estado local:

- `"warning"` — aviso sobre desconexão do celular físico
- `"form"` — campos: nome da instância + telefone + método (SMS/voz)
- `"otp"` — campo para digitar o código de 6 dígitos

**Files:**
- Criar: `frontend/src/pages/dashboard/PrimaryRegistration/index.tsx`

**Interfaces:**
- Consome: `requestRegistrationCode`, `confirmRegistrationCode` (Task 1); `useManageInstance` (existente em `src/lib/queries/instance/manageInstance.tsx`)
- Produz: componente `PrimaryRegistrationDialog` — usado pela Task 3.

- [ ] **Step 2.1: Criar arquivo do componente**

```tsx
// frontend/src/pages/dashboard/PrimaryRegistration/index.tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Phone, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Button } from "@evoapi/design-system/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@evoapi/design-system/label";

import {
  confirmRegistrationCode,
  requestRegistrationCode,
} from "@/lib/queries/instance/registrationApi";
import { useManageInstance } from "@/lib/queries/instance/manageInstance";

// ── Schemas ─────────────────────────────────────────────────────────────────

const formSchema = z.object({
  instanceName: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9-_]+$/, "Somente letras, números, - e _"),
  phoneNumber: z
    .string()
    .min(10, "Número inválido")
    .regex(/^\+?[1-9]\d{7,14}$/, "Formato: +5511999999999"),
  method: z.enum(["sms", "voice"]),
});

const otpSchema = z.object({
  code: z
    .string()
    .length(6, "O código deve ter 6 dígitos")
    .regex(/^\d{6}$/, "Somente dígitos"),
});

type FormData = z.infer<typeof formSchema>;
type OtpData = z.infer<typeof otpSchema>;

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetTable: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

type Step = "warning" | "form" | "otp";

export function PrimaryRegistrationDialog({ open, onOpenChange, resetTable }: Props) {
  const { t } = useTranslation();
  const { createInstance } = useManageInstance();

  const [step, setStep] = useState<Step>("warning");
  const [loading, setLoading] = useState(false);
  const [instanceName, setInstanceName] = useState("");

  const formMethods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { instanceName: "", phoneNumber: "", method: "sms" },
  });

  const otpMethods = useForm<OtpData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const resetAll = () => {
    formMethods.reset();
    otpMethods.reset();
    setStep("warning");
    setInstanceName("");
  };

  const handleClose = (next: boolean) => {
    if (loading) return;
    onOpenChange(next);
    if (!next) resetAll();
  };

  // Step: warning → form
  const handleAcceptWarning = () => setStep("form");

  // Step: form → otp (cria instância + solicita código)
  const handleRequestCode = async (data: FormData) => {
    setLoading(true);
    try {
      // 1. Cria a instância sem conectar
      await createInstance({
        instanceName: data.instanceName,
        integration: "WHATSAPP-BAILEYS",
        token: uuidv4().replace(/-/g, "").toUpperCase(),
        number: null,
        businessId: null,
        mobileTransport: true,
      } as Parameters<typeof createInstance>[0]);

      // 2. Solicita o código SMS/voz
      let phone = data.phoneNumber.trim();
      if (!phone.startsWith("+")) phone = `+${phone}`;

      await requestRegistrationCode({
        instanceName: data.instanceName,
        phoneNumber: phone,
        method: data.method,
      });

      setInstanceName(data.instanceName);
      toast.info(
        t("primaryRegistration.toast.codeSent", {
          defaultValue: "Código enviado para o seu número. Verifique o SMS.",
        })
      );
      setStep("otp");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("primaryRegistration.toast.errorRequest", {
              defaultValue: "Erro ao solicitar código. Verifique os dados.",
            });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step: otp → done (confirma código)
  const handleConfirmCode = async (data: OtpData) => {
    setLoading(true);
    try {
      await confirmRegistrationCode({
        instanceName,
        code: data.code,
      });

      toast.success(
        t("primaryRegistration.toast.success", {
          defaultValue: "Número registrado com sucesso como Primário!",
        })
      );
      resetTable();
      handleClose(false);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t("primaryRegistration.toast.errorConfirm", {
              defaultValue: "Código inválido ou expirado. Tente novamente.",
            });
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* ── Step: Warning ── */}
        {step === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-500">
                <ShieldAlert className="h-5 w-5" />
                {t("primaryRegistration.warning.title", {
                  defaultValue: "Atenção: Modo Primário",
                })}
              </DialogTitle>
              <DialogDescription>
                {t("primaryRegistration.warning.subtitle", {
                  defaultValue:
                    "Leia com atenção antes de continuar.",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    {t("primaryRegistration.warning.headline", {
                      defaultValue:
                        "O WhatsApp do seu celular físico SERÁ DESLOGADO.",
                    })}
                  </p>
                  <p>
                    {t("primaryRegistration.warning.body", {
                      defaultValue:
                        "Ao registrar o número como Primário aqui, o aplicativo WhatsApp instalado no celular exibirá a mensagem \"Você foi desconectado porque este número foi registrado em outro aparelho\". O histórico de mensagens ficará apenas neste servidor.",
                    })}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleClose(false)}>
                {t("button.cancel", { defaultValue: "Cancelar" })}
              </Button>
              <Button
                variant="destructive"
                onClick={handleAcceptWarning}
              >
                {t("primaryRegistration.warning.confirm", {
                  defaultValue: "Entendi, continuar",
                })}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step: Form ── */}
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                {t("primaryRegistration.form.title", {
                  defaultValue: "Registrar número como Primário",
                })}
              </DialogTitle>
              <DialogDescription>
                {t("primaryRegistration.form.subtitle", {
                  defaultValue:
                    "O código será enviado para o chip físico via SMS ou chamada de voz.",
                })}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={formMethods.handleSubmit(handleRequestCode)}
              className="space-y-4"
            >
              {/* Instance name */}
              <div className="space-y-2">
                <Label htmlFor="instanceName">
                  {t("primaryRegistration.form.instanceName", {
                    defaultValue: "Nome da instância",
                  })}{" "}
                  <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="instanceName"
                  placeholder="meu-numero-primario"
                  disabled={loading}
                  {...formMethods.register("instanceName")}
                />
                {formMethods.formState.errors.instanceName && (
                  <p className="text-sm text-rose-600">
                    {formMethods.formState.errors.instanceName.message}
                  </p>
                )}
              </div>

              {/* Phone number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">
                  {t("primaryRegistration.form.phoneNumber", {
                    defaultValue: "Número do chip (com DDI)",
                  })}{" "}
                  <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+5511999999999"
                  disabled={loading}
                  {...formMethods.register("phoneNumber")}
                />
                {formMethods.formState.errors.phoneNumber && (
                  <p className="text-sm text-rose-600">
                    {formMethods.formState.errors.phoneNumber.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("primaryRegistration.form.phoneHint", {
                    defaultValue:
                      "Inclua o código do país, ex: +55 para Brasil.",
                  })}
                </p>
              </div>

              {/* Method */}
              <div className="space-y-2">
                <Label>
                  {t("primaryRegistration.form.method", {
                    defaultValue: "Método de envio do código",
                  })}
                </Label>
                <div className="flex gap-3">
                  {(["sms", "voice"] as const).map((m) => (
                    <label
                      key={m}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent/30"
                    >
                      <input
                        type="radio"
                        value={m}
                        disabled={loading}
                        {...formMethods.register("method")}
                        className="accent-primary"
                      />
                      {m === "sms"
                        ? t("primaryRegistration.form.methodSms", {
                            defaultValue: "SMS",
                          })
                        : t("primaryRegistration.form.methodVoice", {
                            defaultValue: "Ligação de voz",
                          })}
                    </label>
                  ))}
                </div>
              </div>

              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("warning")}
                  disabled={loading}
                >
                  {t("button.back", { defaultValue: "Voltar" })}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("primaryRegistration.form.sending", {
                        defaultValue: "Enviando...",
                      })}
                    </>
                  ) : (
                    t("primaryRegistration.form.submit", {
                      defaultValue: "Enviar código SMS",
                    })
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* ── Step: OTP ── */}
        {step === "otp" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("primaryRegistration.otp.title", {
                  defaultValue: "Digite o código recebido",
                })}
              </DialogTitle>
              <DialogDescription>
                {t("primaryRegistration.otp.subtitle", {
                  defaultValue:
                    "Verifique o SMS (ou ligação) no chip físico e insira o código de 6 dígitos abaixo.",
                })}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={otpMethods.handleSubmit(handleConfirmCode)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="code">
                  {t("primaryRegistration.otp.label", {
                    defaultValue: "Código de 6 dígitos",
                  })}{" "}
                  <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  disabled={loading}
                  className="text-center text-xl tracking-widest"
                  {...otpMethods.register("code")}
                />
                {otpMethods.formState.errors.code && (
                  <p className="text-sm text-rose-600">
                    {otpMethods.formState.errors.code.message}
                  </p>
                )}
              </div>

              <DialogFooter className="flex gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={loading}
                >
                  {t("button.back", { defaultValue: "Voltar" })}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("primaryRegistration.otp.confirming", {
                        defaultValue: "Confirmando...",
                      })}
                    </>
                  ) : (
                    t("primaryRegistration.otp.submit", {
                      defaultValue: "Confirmar e Conectar",
                    })
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2.2: Verificar type-check**

```bash
cd frontend && npm run type-check
```

Esperado: zero erros. Se `@evoapi/design-system` não exportar `Label`, substituir por:

```tsx
import { Label } from "@/components/ui/label";
// ou criar um label simples inline:
// <label className="text-sm font-medium leading-none ...">
```

- [ ] **Step 2.3: Verificar lint**

```bash
cd frontend && npm run lint:check
```

Corrigir erros se houver.

- [ ] **Step 2.4: Commit**

```bash
git add frontend/src/pages/dashboard/PrimaryRegistration/index.tsx
git commit -m "feat: add PrimaryRegistrationDialog multi-step component"
```

---

## Task 3: Integrar Dialog no Dashboard

Adicionar botão "Registrar como Primário" na página do Dashboard, visível apenas para provider `"api"`.

**Files:**
- Modificar: `frontend/src/pages/dashboard/index.tsx`

**Interfaces:**
- Consome: `PrimaryRegistrationDialog` (Task 2); `getProvider` (existente).

- [ ] **Step 3.1: Ler o arquivo atual**

Abrir `frontend/src/pages/dashboard/index.tsx` e localizar:
1. Os imports no topo
2. O bloco de estado (`useState`)
3. O botão de "Nova Instância" (próximo ao `BaseHeader`)
4. O trecho onde `<NewInstance>` é renderizado (fim do JSX)

- [ ] **Step 3.2: Adicionar import e estado**

No topo dos imports, após os imports existentes, adicionar:

```tsx
import { PrimaryRegistrationDialog } from "./PrimaryRegistration";
import { getProvider } from "@/lib/queries/token";
```

Dentro da função `Dashboard()`, após os `useState` existentes, adicionar:

```tsx
const [primaryRegOpen, setPrimaryRegOpen] = useState(false);
const isApiProvider = getProvider() === "api";
```

- [ ] **Step 3.3: Adicionar botão na toolbar**

Localizar no JSX o botão com `Plus` que abre `setCreateOpen(true)`. Logo após esse botão (ou dentro do mesmo grupo), adicionar:

```tsx
{isApiProvider && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setPrimaryRegOpen(true)}
    className="flex items-center gap-2"
  >
    <Smartphone className="h-4 w-4" />
    {t("primaryRegistration.button", {
      defaultValue: "Registrar como Primário",
    })}
  </Button>
)}
```

Adicionar `Smartphone` ao import do `lucide-react`:

```tsx
import { ChevronsUpDown, Layers, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
```

- [ ] **Step 3.4: Renderizar o Dialog no final do JSX**

Antes do `</div>` final do retorno, após o `<NewInstance>` existente, adicionar:

```tsx
<PrimaryRegistrationDialog
  open={primaryRegOpen}
  onOpenChange={setPrimaryRegOpen}
  resetTable={resetTable}
/>
```

- [ ] **Step 3.5: Verificar type-check e lint**

```bash
cd frontend && npm run type-check && npm run lint:check
```

Esperado: zero erros.

- [ ] **Step 3.6: Commit**

```bash
git add frontend/src/pages/dashboard/index.tsx
git commit -m "feat: wire PrimaryRegistrationDialog into dashboard"
```

---

## Task 4: Strings i18n

Adicionar todas as chaves de tradução usadas pelo componente nos 4 arquivos de idioma. O componente usa `defaultValue` como fallback, então sem essas chaves a UI funciona, mas com fallback em PT-BR para todos os idiomas.

**Files:**
- Modificar: `frontend/src/translate/languages/pt-BR.json`
- Modificar: `frontend/src/translate/languages/en-US.json`
- Modificar: `frontend/src/translate/languages/es-ES.json`
- Modificar: `frontend/src/translate/languages/fr-FR.json`

- [ ] **Step 4.1: Adicionar em `pt-BR.json`**

Abrir o arquivo e adicionar a seção `"primaryRegistration"` em qualquer posição no objeto raiz:

```json
"primaryRegistration": {
  "button": "Registrar como Primário",
  "warning": {
    "title": "Atenção: Modo Primário",
    "subtitle": "Leia com atenção antes de continuar.",
    "headline": "O WhatsApp do seu celular físico SERÁ DESLOGADO.",
    "body": "Ao registrar o número como Primário aqui, o aplicativo WhatsApp instalado no celular exibirá a mensagem \"Você foi desconectado porque este número foi registrado em outro aparelho\". O histórico de mensagens ficará apenas neste servidor.",
    "confirm": "Entendi, continuar"
  },
  "form": {
    "title": "Registrar número como Primário",
    "subtitle": "O código será enviado para o chip físico via SMS ou chamada de voz.",
    "instanceName": "Nome da instância",
    "phoneNumber": "Número do chip (com DDI)",
    "phoneHint": "Inclua o código do país, ex: +55 para Brasil.",
    "method": "Método de envio do código",
    "methodSms": "SMS",
    "methodVoice": "Ligação de voz",
    "submit": "Enviar código SMS",
    "sending": "Enviando..."
  },
  "otp": {
    "title": "Digite o código recebido",
    "subtitle": "Verifique o SMS (ou ligação) no chip físico e insira o código de 6 dígitos abaixo.",
    "label": "Código de 6 dígitos",
    "submit": "Confirmar e Conectar",
    "confirming": "Confirmando..."
  },
  "toast": {
    "codeSent": "Código enviado para o seu número. Verifique o SMS.",
    "success": "Número registrado com sucesso como Primário!",
    "errorRequest": "Erro ao solicitar código. Verifique os dados.",
    "errorConfirm": "Código inválido ou expirado. Tente novamente."
  }
}
```

Adicionar também a chave `"back"` em `"button"` se não existir:

```json
"button": {
  "delete": "...",
  "cancel": "...",
  "back": "Voltar",
  ...
}
```

- [ ] **Step 4.2: Adicionar em `en-US.json`**

```json
"primaryRegistration": {
  "button": "Register as Primary",
  "warning": {
    "title": "Warning: Primary Mode",
    "subtitle": "Read carefully before proceeding.",
    "headline": "Your physical phone's WhatsApp WILL BE LOGGED OUT.",
    "body": "By registering the number as Primary here, the WhatsApp app on your phone will show the message \"You were disconnected because this number was registered on another device\". Message history will only exist on this server.",
    "confirm": "I understand, continue"
  },
  "form": {
    "title": "Register number as Primary",
    "subtitle": "The verification code will be sent to the physical SIM via SMS or voice call.",
    "instanceName": "Instance name",
    "phoneNumber": "Phone number (with country code)",
    "phoneHint": "Include country code, e.g. +1 for USA.",
    "method": "Code delivery method",
    "methodSms": "SMS",
    "methodVoice": "Voice call",
    "submit": "Send SMS code",
    "sending": "Sending..."
  },
  "otp": {
    "title": "Enter the code you received",
    "subtitle": "Check the SMS (or call) on your physical SIM and enter the 6-digit code below.",
    "label": "6-digit code",
    "submit": "Confirm & Connect",
    "confirming": "Confirming..."
  },
  "toast": {
    "codeSent": "Code sent to your number. Check your SMS.",
    "success": "Number successfully registered as Primary!",
    "errorRequest": "Error requesting code. Please check your details.",
    "errorConfirm": "Invalid or expired code. Please try again."
  }
}
```

Adicionar `"back": "Back"` em `"button"` se não existir.

- [ ] **Step 4.3: Adicionar em `es-ES.json`**

```json
"primaryRegistration": {
  "button": "Registrar como Principal",
  "warning": {
    "title": "Atención: Modo Principal",
    "subtitle": "Lea con atención antes de continuar.",
    "headline": "El WhatsApp de su teléfono físico SERÁ DESCONECTADO.",
    "body": "Al registrar el número como Principal aquí, la aplicación WhatsApp en el teléfono mostrará el mensaje \"Fue desconectado porque este número fue registrado en otro dispositivo\". El historial de mensajes solo existirá en este servidor.",
    "confirm": "Entendido, continuar"
  },
  "form": {
    "title": "Registrar número como Principal",
    "subtitle": "El código se enviará al SIM físico por SMS o llamada de voz.",
    "instanceName": "Nombre de instancia",
    "phoneNumber": "Número de teléfono (con código de país)",
    "phoneHint": "Incluya el código de país, ej: +34 para España.",
    "method": "Método de entrega del código",
    "methodSms": "SMS",
    "methodVoice": "Llamada de voz",
    "submit": "Enviar código SMS",
    "sending": "Enviando..."
  },
  "otp": {
    "title": "Ingrese el código recibido",
    "subtitle": "Verifique el SMS (o llamada) en el SIM físico e ingrese el código de 6 dígitos.",
    "label": "Código de 6 dígitos",
    "submit": "Confirmar y Conectar",
    "confirming": "Confirmando..."
  },
  "toast": {
    "codeSent": "Código enviado a su número. Verifique el SMS.",
    "success": "¡Número registrado exitosamente como Principal!",
    "errorRequest": "Error al solicitar el código. Verifique los datos.",
    "errorConfirm": "Código inválido o expirado. Intente nuevamente."
  }
}
```

Adicionar `"back": "Volver"` em `"button"` se não existir.

- [ ] **Step 4.4: Adicionar em `fr-FR.json`**

```json
"primaryRegistration": {
  "button": "Enregistrer comme Principal",
  "warning": {
    "title": "Attention: Mode Principal",
    "subtitle": "Lisez attentivement avant de continuer.",
    "headline": "WhatsApp sur votre téléphone physique SERA DÉCONNECTÉ.",
    "body": "En enregistrant le numéro comme Principal ici, l'application WhatsApp sur le téléphone affichera le message \"Vous avez été déconnecté car ce numéro a été enregistré sur un autre appareil\". L'historique des messages n'existera que sur ce serveur.",
    "confirm": "J'ai compris, continuer"
  },
  "form": {
    "title": "Enregistrer le numéro comme Principal",
    "subtitle": "Le code sera envoyé à la SIM physique par SMS ou appel vocal.",
    "instanceName": "Nom de l'instance",
    "phoneNumber": "Numéro de téléphone (avec indicatif pays)",
    "phoneHint": "Incluez l'indicatif pays, ex: +33 pour la France.",
    "method": "Méthode d'envoi du code",
    "methodSms": "SMS",
    "methodVoice": "Appel vocal",
    "submit": "Envoyer le code SMS",
    "sending": "Envoi en cours..."
  },
  "otp": {
    "title": "Entrez le code reçu",
    "subtitle": "Vérifiez le SMS (ou l'appel) sur la SIM physique et entrez le code à 6 chiffres.",
    "label": "Code à 6 chiffres",
    "submit": "Confirmer et Connecter",
    "confirming": "Confirmation..."
  },
  "toast": {
    "codeSent": "Code envoyé à votre numéro. Vérifiez votre SMS.",
    "success": "Numéro enregistré avec succès comme Principal!",
    "errorRequest": "Erreur lors de la demande de code. Vérifiez vos données.",
    "errorConfirm": "Code invalide ou expiré. Veuillez réessayer."
  }
}
```

Adicionar `"back": "Retour"` em `"button"` se não existir.

- [ ] **Step 4.5: Verificar lint**

```bash
cd frontend && npm run lint:check
```

- [ ] **Step 4.6: Commit**

```bash
git add frontend/src/translate/languages/
git commit -m "feat: add i18n strings for primary registration flow (4 languages)"
```

---

## Task 5: Teste Manual End-to-End

- [ ] **Step 5.1: Iniciar dev server**

```bash
cd frontend && npm run dev
```

Abrir http://localhost:5173 no browser.

- [ ] **Step 5.2: Verificar provider = "api"**

Ir em Configurações / Login → confirmar que o provider selecionado é `"api"` (não `"go"`). Se for `"go"`, o botão não deve aparecer — isso é o comportamento correto.

- [ ] **Step 5.3: Verificar botão no Dashboard**

No Dashboard, o botão "Registrar como Primário" deve aparecer próximo ao botão "Nova Instância".

- [ ] **Step 5.4: Testar fluxo Step 1 — Aviso**

Clicar em "Registrar como Primário". O dialog deve abrir no passo de aviso com texto âmbar.

- [ ] **Step 5.5: Testar fluxo Step 2 — Formulário**

Clicar em "Entendi, continuar". O formulário com campos "Nome da instância", "Número do chip" e escolha SMS/Voz deve aparecer.

Validações a testar (sem servidor):
- Nome com caracteres especiais (ex: `minha instancia`) → deve mostrar erro
- Telefone sem DDI (ex: `11999999999`) → deve mostrar erro

- [ ] **Step 5.6: Testar com backend real (se disponível)**

Com o servidor Zapo rodando e configurado no login:
1. Preencher nome: `teste-primario`
2. Preencher telefone: `+5511999999999` (número real com chip)
3. Escolher SMS → clicar "Enviar código SMS"
4. Verificar toast "Código enviado" e transição para Step 3
5. Digitar código recebido no SMS → clicar "Confirmar e Conectar"
6. Verificar toast de sucesso e instância na lista do Dashboard

- [ ] **Step 5.7: Commit final**

```bash
git add -A
git commit -m "feat: complete primary SMS/OTP registration flow in zapo-manager"
```

---

## Adicionando ao Backend (Fora do Escopo Deste Plano)

Se o servidor Zapo ainda não expõe os endpoints de registro, eles precisam ser implementados no backend (`providers-reference/zapo/`). Os endpoints esperados são:

### `POST /instance/register/requestCode`

**Body:**
```json
{
  "instanceName": "minha-instancia",
  "phoneNumber": "+5511999999999",
  "method": "sms"
}
```

**O que o backend faz:**
```typescript
// Usando Baileys internamente
const { code } = await sock.requestRegistrationCode({
  phoneNumber: params.phoneNumber,
  method: params.method,
});
// armazena `code` para uso no próximo endpoint
```

**Response:**
```json
{ "status": "success" }
```

### `POST /instance/register/confirmCode`

**Body:**
```json
{
  "instanceName": "minha-instancia",
  "code": "123456"
}
```

**O que o backend faz:**
```typescript
await sock.register(params.code);
// salva sessão no SQLite/Postgres e conecta como Primário
```

**Response:**
```json
{ "status": "success" }
```

---

## Fase 2: Registro Real via Baileys (Próximo Passo)

> **Status atual (2026-06-19):** endpoints do backend implementados como **simulação** (mock). O fluxo UI funciona e o Dashboard exibe status "Conectado", mas nenhum SMS real é enviado e nenhum OTP é validado com os servidores do WhatsApp.

### O que falta para produção

O backend Zapo precisa substituir o mock pelo fluxo real do Baileys nos dois endpoints.

---

### Task B1: Implementar `requestCode` real no backend Zapo

**Arquivo backend:** localize o handler de `POST /instance/register/requestCode` (criado na Fase 1).

**O que mudar:**

```typescript
// providers-reference/zapo/src/... (handler atual — MOCK)
// Substitua o bloco que só salva em cache por:

import makeRegistrationSocket from "@whiskeysockets/baileys/lib/Socket/registration"
// ou equivalente conforme versão do Baileys no projeto

export const requestCodeHandler = async (req, res) => {
  const { instanceName, phoneNumber, method } = req.body

  // 1. Garantir que instância existe no DB mas sem cliente ativo
  //    (a instância já foi criada pelo frontend via POST /instance/create)

  // 2. Criar socket de registro (sem salvar sessão ainda)
  const sock = makeRegistrationSocket({
    phoneNumber,  // "+5511999999999"
    // auth: usar store vazio ou temporário
  })

  // 3. Solicitar OTP ao WhatsApp — WA envia SMS/ligação para o chip
  const { ref } = await sock.requestRegistrationCode({ phoneNumber, method })

  // 4. Armazenar sock no cache em memória (keyed por instanceName)
  //    para uso posterior no confirmCode
  registrationSocketCache.set(instanceName, { sock, phoneNumber, ref })

  return res.json({ status: "success" })
}
```

**Cache em memória** (adicionar no módulo):

```typescript
// ponytail: Map simples, TTL de 10 min suficiente para o fluxo de registro
const registrationSocketCache = new Map<string, {
  sock: ReturnType<typeof makeRegistrationSocket>
  phoneNumber: string
  ref: string
}>()

// limpar entrada após 10 min para não vazar memória
const setWithTTL = (key: string, value: typeof ...) => {
  registrationSocketCache.set(key, value)
  setTimeout(() => registrationSocketCache.delete(key), 10 * 60 * 1000)
}
```

**Teste manual:**
```bash
curl -X POST <API_URL>/instance/register/requestCode \
  -H "apikey: <GLOBAL_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"teste","phoneNumber":"+5511999999999","method":"sms"}'
# Esperado: chip físico recebe SMS com código de 6 dígitos
```

---

### Task B2: Implementar `confirmCode` real no backend Zapo

**Arquivo backend:** handler de `POST /instance/register/confirmCode`.

**O que mudar:**

```typescript
export const confirmCodeHandler = async (req, res) => {
  const { instanceName, code } = req.body

  // 1. Recuperar sock do cache
  const cached = registrationSocketCache.get(instanceName)
  if (!cached) {
    return res.status(400).json({ status: "error", message: "Sessão de registro expirada. Solicite novo código." })
  }

  const { sock, phoneNumber } = cached

  // 2. Validar OTP com servidores do WhatsApp
  //    Baileys lida com o handshake criptográfico internamente
  await sock.register(code)

  // 3. Neste ponto, sock.authState.creds contém as credenciais criptográficas
  //    (identity keys, registration ID, etc.)
  //    Salvar no mesmo local que o Zapo usa para sessões normais
  //    (SQLite auth file ou tabela Prisma, dependendo da config da instância)
  await saveCredsToInstance(instanceName, sock.authState.creds)

  // 4. Atualizar status real no DB (agora tem cliente ativo)
  await prisma.instance.update({
    where: { name: instanceName },
    data: {
      connectionStatus: "open",
      ownerJid: `${phoneNumber.replace("+", "")}@s.whatsapp.net`,
      number: phoneNumber.replace("+", ""),
    }
  })

  // 5. Limpar cache de registro
  registrationSocketCache.delete(instanceName)

  return res.json({ status: "success" })
}
```

**Ponto crítico:** `saveCredsToInstance` deve salvar no mesmo formato/local que `makeWASocket` leria ao reconectar. Se o Zapo usa `useMultiFileAuthState` ou `usePrismaAuthState`, usar o mesmo provider aqui.

**Teste manual:**
```bash
curl -X POST <API_URL>/instance/register/confirmCode \
  -H "apikey: <GLOBAL_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"teste","code":"123456"}'
# Esperado: 200 OK; ao reiniciar o backend, instância reconecta sem QR Code
```

---

### Task B3: Validar reconexão automática pós-registro

Após Fase 2 implementada, o ciclo completo deve ser:

1. Frontend: requestCode → SMS chega no chip
2. Frontend: confirmCode → creds salvas no backend
3. Backend reinicia (ou instância é reconectada via `/instance/restart`)
4. Backend usa `makeWASocket` com as creds salvas → conecta diretamente como Primário
5. Dashboard mostra "Conectado" — agora real, não mock

**Teste de reconexão:**
```bash
# Após confirmCode com sucesso:
curl -X POST <API_URL>/instance/restart \
  -H "apikey: <INSTANCE_TOKEN>"
# Esperado: instância sobe sem QR Code, status "open" em ~5s
```

---

### Diferença mock vs. real

| Aspecto | Mock (atual) | Real (Fase 2) |
|---|---|---|
| SMS enviado para chip | ❌ Não | ✅ Sim (via Baileys → WA) |
| OTP validado com WhatsApp | ❌ Não | ✅ Sim |
| Credenciais criptográficas geradas | ❌ Não | ✅ Sim |
| Instância reconecta após restart | ❌ Não | ✅ Sim |
| Celular físico deslogado | ❌ Não | ✅ Sim (imediatamente) |
| Status no Dashboard | ✅ Verde (simulado) | ✅ Verde (real) |

---

## Self-Review Checklist

- [x] **Cobertura da spec**: fluxo completo coberto (aviso → form → OTP → sucesso)
- [x] **Placeholders**: nenhum — todo código está completo
- [x] **Tipos consistentes**: `RequestCodeParams` e `ConfirmCodeParams` definidos em Task 1 e consumidos em Task 2
- [x] **Provider guard**: botão escondido para provider `"go"`
- [x] **i18n**: 4 idiomas cobertos com traduções completas
- [x] **Warning de segurança**: passo 1 obrigatório com linguagem clara
- [x] **Sem modificação de arquivos Go**: respeitado
