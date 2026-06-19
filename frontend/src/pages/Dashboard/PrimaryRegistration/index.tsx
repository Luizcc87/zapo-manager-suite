import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Phone, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Button } from "@evoapi/design-system/button";
import { Label } from "@evoapi/design-system/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useManageInstance } from "@/lib/queries/instance/manageInstance";
import {
  confirmRegistrationCode,
  requestRegistrationCode,
} from "@/lib/queries/instance/registrationApi";

// ── Schemas ──────────────────────────────────────────────────────────────────

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
type Step = "warning" | "form" | "otp";

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resetTable: () => void;
}

export function PrimaryRegistrationDialog({
  open,
  onOpenChange,
  resetTable,
}: Props) {
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

  const handleRequestCode = async (data: FormData) => {
    setLoading(true);
    try {
      await createInstance({
        instanceName: data.instanceName,
        integration: "WHATSAPP-BAILEYS",
        token: uuidv4().replace(/-/g, "").toUpperCase(),
        number: null,
        businessId: null,
        mobileTransport: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

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
        }),
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

  const handleConfirmCode = async (data: OtpData) => {
    setLoading(true);
    try {
      await confirmRegistrationCode({ instanceName, code: data.code });
      toast.success(
        t("primaryRegistration.toast.success", {
          defaultValue: "Número registrado com sucesso como Primário!",
        }),
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* ── Warning ── */}
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
                  defaultValue: "Leia com atenção antes de continuar.",
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
                        'Ao registrar o número como Primário aqui, o aplicativo WhatsApp instalado no celular exibirá a mensagem "Você foi desconectado porque este número foi registrado em outro aparelho". O histórico de mensagens ficará apenas neste servidor.',
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
                onClick={() => setStep("form")}
              >
                {t("primaryRegistration.warning.confirm", {
                  defaultValue: "Entendi, continuar",
                })}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Form ── */}
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
                    defaultValue: "Inclua o código do país, ex: +55 para Brasil.",
                  })}
                </p>
              </div>

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

        {/* ── OTP ── */}
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
