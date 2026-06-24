import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Phone, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useFetchProxy } from "@/lib/queries/proxy/fetchProxy";

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
  defaultInstanceName?: string;
}

export function PrimaryRegistrationDialog({
  open,
  onOpenChange,
  resetTable,
  defaultInstanceName,
}: Props) {
  const { t } = useTranslation();
  const { createInstance } = useManageInstance();

  const [step, setStep] = useState<Step>("warning");
  const [loading, setLoading] = useState(false);
  const [instanceName, setInstanceName] = useState("");

  // Proxy state
  const [proxyOpen, setProxyOpen] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [proxyProtocol, setProxyProtocol] = useState("http");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");

  // Pré-popula proxy quando reabrindo para instância existente
  const { data: existingProxy } = useFetchProxy({
    instanceName: defaultInstanceName ?? null,
    enabled: !!defaultInstanceName && open,
  });

  useEffect(() => {
    if (!existingProxy?.host) return;
    setProxyOpen(true);
    setProxyEnabled(existingProxy.enabled ?? true);
    setProxyProtocol(existingProxy.protocol || "http");
    setProxyHost(existingProxy.host || "");
    setProxyPort(existingProxy.port || "");
    setProxyUsername(existingProxy.username || "");
    setProxyPassword(existingProxy.password || "");
  }, [existingProxy]);

  const formMethods = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { instanceName: defaultInstanceName || "", phoneNumber: "", method: "sms" },
  });

  const otpMethods = useForm<OtpData>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    if (open && defaultInstanceName) {
      formMethods.setValue("instanceName", defaultInstanceName);
    }
  }, [open, defaultInstanceName]);

  const resetAll = () => {
    formMethods.reset({
      instanceName: defaultInstanceName || "",
      phoneNumber: "",
      method: "sms",
    });
    otpMethods.reset();
    setStep("warning");
    setInstanceName("");
    setProxyOpen(false);
    setProxyEnabled(true);
    setProxyProtocol("http");
    setProxyHost("");
    setProxyPort("");
    setProxyUsername("");
    setProxyPassword("");
  };

  const handleClose = (next: boolean) => {
    if (loading) return;
    onOpenChange(next);
    if (!next) resetAll();
  };

  const handleRequestCode = async (data: FormData) => {
    setLoading(true);
    try {
      console.groupCollapsed("[PrimaryRegistration][Browser] handleRequestCode");
      console.debug("[PrimaryRegistration][Browser] form data", {
        instanceName: data.instanceName,
        phoneNumber: data.phoneNumber,
        method: data.method,
        proxyOpen,
        proxyEnabled,
        proxyProtocol,
        proxyHost,
        proxyPort,
        proxyUsername,
        hasProxyPassword: !!proxyPassword,
      });
      const proxy = proxyOpen && proxyHost && proxyPort
        ? { enabled: proxyEnabled, protocol: proxyProtocol, host: proxyHost, port: proxyPort, username: proxyUsername, password: proxyPassword }
        : undefined;
      console.debug("[PrimaryRegistration][Browser] derived proxy", proxy);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.debug("[PrimaryRegistration][Browser] creating instance");
      await createInstance({
        instanceName: data.instanceName,
        integration: "WHATSAPP-BAILEYS",
        token: uuidv4().replace(/-/g, "").toUpperCase(),
        number: null,
        businessId: null,
        mobileTransport: true,
        ...(proxy && { proxy }),
      } as any);
      console.debug("[PrimaryRegistration][Browser] instance created");

      let phone = data.phoneNumber.trim();
      if (!phone.startsWith("+")) phone = `+${phone}`;
      console.debug("[PrimaryRegistration][Browser] normalized phone", phone);

      console.debug("[PrimaryRegistration][Browser] requesting registration code");
      await requestRegistrationCode({
        instanceName: data.instanceName,
        phoneNumber: phone,
        method: data.method,
      });
      console.debug("[PrimaryRegistration][Browser] requestRegistrationCode resolved");

      setInstanceName(data.instanceName);
      toast.info(
        t("primaryRegistration.toast.codeSent", {
          defaultValue: "Código enviado para o seu número. Verifique o SMS.",
        }),
      );
      setStep("otp");
    } catch (err: any) {
      console.error("[PrimaryRegistration][Browser] handleRequestCode error", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.details ||
        (err instanceof Error ? err.message : null) ||
        t("primaryRegistration.toast.errorRequest", {
          defaultValue: "Erro ao solicitar código. Verifique os dados.",
        });
      toast.error(msg);
    } finally {
      console.groupEnd();
      setLoading(false);
    }
  };

  const handleConfirmCode = async (data: OtpData) => {
    setLoading(true);
    try {
      console.groupCollapsed("[PrimaryRegistration][Browser] handleConfirmCode");
      console.debug("[PrimaryRegistration][Browser] confirm data", {
        instanceName,
        codeLength: data.code?.length,
      });
      await confirmRegistrationCode({ instanceName, code: data.code });
      console.debug("[PrimaryRegistration][Browser] confirmRegistrationCode resolved");
      toast.success(
        t("primaryRegistration.toast.success", {
          defaultValue: "Número registrado com sucesso como Primário!",
        }),
      );
      resetTable();
      handleClose(false);
    } catch (err: any) {
      console.error("[PrimaryRegistration][Browser] handleConfirmCode error", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.details ||
        (err instanceof Error ? err.message : null) ||
        t("primaryRegistration.toast.errorConfirm", {
          defaultValue: "Código inválido ou expirado. Tente novamente.",
        });
      toast.error(msg);
    } finally {
      console.groupEnd();
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

              {/* ── Proxy ── */}
              <div className="rounded-md border border-sidebar-border overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
                  onClick={() => setProxyOpen((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    {t("proxy.title", { defaultValue: "Proxy" })}
                    {proxyOpen && proxyHost && (
                      <span className="text-xs text-purple-500 font-mono">{proxyHost}</span>
                    )}
                  </span>
                  {proxyOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {proxyOpen && (
                  <div className="grid gap-3 px-3 pb-3 pt-1 bg-sidebar/30">
                    <div className="flex items-center justify-between rounded-md border border-sidebar-border bg-sidebar/30 p-2">
                      <Label className="text-sm">{t("proxy.form.enabled.label", { defaultValue: "Ativo" })}</Label>
                      <input type="checkbox" checked={proxyEnabled} onChange={(e) => setProxyEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs">{t("proxy.form.protocol.label", { defaultValue: "Protocolo" })}</Label>
                        <select
                          value={proxyProtocol}
                          onChange={(e) => setProxyProtocol(e.target.value)}
                          className="w-full rounded-md border border-sidebar-border bg-background px-2 py-1.5 text-sm"
                        >
                          {["http", "https", "socks4", "socks5"].map((p) => (
                            <option key={p} value={p}>{p.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">{t("proxy.form.host.label", { defaultValue: "Host" })}</Label>
                        <Input placeholder="proxy.exemplo.com" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} disabled={loading} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("proxy.form.port.label", { defaultValue: "Porta" })}</Label>
                      <Input placeholder="8080" value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} disabled={loading} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("proxy.form.username.label", { defaultValue: "Usuário" })}</Label>
                      <Input value={proxyUsername} onChange={(e) => setProxyUsername(e.target.value)} disabled={loading} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("proxy.form.password.label", { defaultValue: "Senha" })}</Label>
                      <Input type="password" value={proxyPassword} onChange={(e) => setProxyPassword(e.target.value)} disabled={loading} />
                    </div>
                  </div>
                )}
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
