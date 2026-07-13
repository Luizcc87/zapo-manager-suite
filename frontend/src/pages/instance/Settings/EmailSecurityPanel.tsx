import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useEmailStatus,
  useSetEmail,
  useRequestEmailVerificationCode,
  useVerifyEmailCode,
  useConfirmEmail,
} from "@/lib/queries/instance/email";
import { Button } from "@evoapi/design-system/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Input } from "@/components/ui/input";
import { Label } from "@evoapi/design-system/label";
import { Alert, AlertDescription, AlertTitle } from "@evoapi/design-system/alert";
import { Mail, ShieldCheck, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";

interface EmailSecurityPanelProps {
  instanceName: string;
}

export function EmailSecurityPanel({ instanceName }: EmailSecurityPanelProps) {
  const { t } = useTranslation();
  const { data: status, isLoading, error, refetch } = useEmailStatus(instanceName);
  const setEmailMutation = useSetEmail(instanceName);
  const requestCodeMutation = useRequestEmailVerificationCode(instanceName);
  const verifyCodeMutation = useVerifyEmailCode(instanceName);
  const confirmEmailMutation = useConfirmEmail(instanceName);

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Status/Input, 2: Code verification, 3: Confirm
  const [emailInput, setEmailInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Sync input value when data loads
  useEffect(() => {
    if (status?.email) {
      setEmailInput(status.email);
    }
  }, [status]);

  const handleSetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    if (!emailInput.trim()) return;

    try {
      await setEmailMutation.mutateAsync(emailInput.trim());
      setSuccessMsg(t("zapoMobile.email.msgSetSuccess", "E-mail definido na conta com sucesso. Solicite o código de verificação."));
      refetch();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || t("zapoMobile.email.error", "Erro ao definir e-mail."));
    }
  };

  const handleRequestCode = async () => {
    setSuccessMsg("");
    setErrorMsg("");
    try {
      await requestCodeMutation.mutateAsync({
        languageCode: "pt",
        localeCode: "BR",
      });
      setSuccessMsg(t("zapoMobile.email.msgRequestSuccess", "Código de verificação enviado! Verifique sua caixa de entrada."));
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || t("zapoMobile.email.error", "Erro ao solicitar código."));
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    if (!codeInput.trim()) return;

    try {
      const res = await verifyCodeMutation.mutateAsync(codeInput.trim());
      if (res.verified) {
        setSuccessMsg(t("zapoMobile.email.msgVerifySuccess", "E-mail verificado! Prossiga para a confirmação final."));
        setStep(3);
      } else if (res.autoVerifyFailed) {
        setErrorMsg(t("zapoMobile.email.msgVerifyFailed", "Código inválido ou expirado."));
      } else {
        setErrorMsg(t("zapoMobile.email.msgVerifyFailed", "Código inválido ou expirado."));
      }
      refetch();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || t("zapoMobile.email.error", "Erro ao verificar código."));
    }
  };

  const handleConfirm = async () => {
    setSuccessMsg("");
    setErrorMsg("");
    try {
      await confirmEmailMutation.mutateAsync();
      setSuccessMsg(t("zapoMobile.email.msgConfirmSuccess", "E-mail confirmado e ativo com sucesso!"));
      setStep(1);
      setCodeInput("");
      refetch();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || t("zapoMobile.email.error", "Erro ao confirmar e-mail."));
    }
  };

  if (isLoading) {
    return <div className="text-center py-6 text-muted-foreground">{t("zapoMobile.email.loading", "Carregando status do e-mail...")}</div>;
  }

  if (error) {
    const status = (error as any)?.response?.status;
    if (status === 403) {
      return (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t("zapoMobile.email.unavailableTitle", "Recurso indisponível")}</AlertTitle>
          <AlertDescription>
            {t("zapoMobile.email.unavailable", "Esta conta não possui elegibilidade para o recurso de e-mail de segurança no WhatsApp.")}
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>{t("zapoMobile.email.errorTitle", "Erro")}</AlertTitle>
        <AlertDescription>{t("zapoMobile.email.error", "Não foi possível carregar as informações de e-mail de segurança.")}</AlertDescription>
      </Alert>
    );
  }

  const isConfirmed = status?.confirmed;
  const isVerified = status?.verified;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          {t("zapoMobile.email.title", "E-mail de Segurança (2FA / Recuperação)")}
        </CardTitle>
        <CardDescription>
          {t("zapoMobile.email.subtitle", "Gerencie o e-mail associado à sua conta de WhatsApp. Válido apenas para contas conectadas via rede móvel (Mobile Transport).")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status badges */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-muted">
            {t("zapoMobile.email.status", "Status")}:{" "}
            {isConfirmed ? (
              <span className="text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("zapoMobile.email.statusConfirmed", "Confirmado e Ativo")}
              </span>
            ) : isVerified ? (
              <span className="text-amber-500">{t("zapoMobile.email.statusVerified", "Verificado (Aguardando Confirmação)")}</span>
            ) : status?.email ? (
              <span className="text-amber-500">{t("zapoMobile.email.statusPending", "Aguardando Verificação")}</span>
            ) : (
              <span className="text-muted-foreground">{t("zapoMobile.email.statusNone", "Não Cadastrado")}</span>
            )}
          </div>
          {status?.email && (
            <div className="px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-primary border border-primary/20">
              {status.email}
            </div>
          )}
        </div>

        {/* Form Steps */}
        {step === 1 && (
          <form onSubmit={handleSetEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-address">{t("zapoMobile.email.inputLabel", "Endereço de E-mail")}</Label>
              <div className="flex gap-2">
                <Input
                  id="email-address"
                  type="email"
                  placeholder={t("zapoMobile.email.inputPlaceholder", "seu-email@dominio.com")}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={isConfirmed}
                  required
                />
                {!isConfirmed && (
                  <Button type="submit" disabled={setEmailMutation.isPending}>
                    {t("zapoMobile.email.btnSet", "Definir")}
                  </Button>
                )}
              </div>
            </div>

            {status?.email && !isConfirmed && (
              <div className="pt-2 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {t("zapoMobile.email.hintPending", "E-mail cadastrado em espera. Clique ao lado para receber um código.")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestCode}
                  disabled={requestCodeMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {t("zapoMobile.email.btnRequest", "Enviar Código")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verification-code">{t("zapoMobile.email.codeLabel", "Código de Verificação")}</Label>
              <div className="flex gap-2">
                <Input
                  id="verification-code"
                  placeholder={t("zapoMobile.email.codePlaceholder", "Insira o código de 6 dígitos recebido por e-mail")}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  required
                />
                <Button type="submit" disabled={verifyCodeMutation.isPending}>
                  {t("zapoMobile.email.btnVerify", "Verificar")}
                </Button>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-muted-foreground hover:underline"
              >
                {t("zapoMobile.email.btnBack", "Voltar")}
              </button>
              <button
                type="button"
                onClick={handleRequestCode}
                className="text-primary hover:underline"
                disabled={requestCodeMutation.isPending}
              >
                {t("zapoMobile.email.btnResend", "Reenviar Código")}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center py-4">
            <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-lg">{t("zapoMobile.email.confirmTitle", "Pronto para confirmar!")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("zapoMobile.email.confirmSubtitle", "O código foi validado com sucesso. Clique abaixo para aplicar a vinculação final do e-mail.")}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setStep(1)}>
                {t("zapoMobile.email.btnBack", "Voltar")}
              </Button>
              <Button onClick={handleConfirm} disabled={confirmEmailMutation.isPending}>
                {confirmEmailMutation.isPending ? t("zapoMobile.email.btnConfirming", "Confirmando...") : t("zapoMobile.email.btnConfirm", "Confirmar E-mail")}
              </Button>
            </div>
          </div>
        )}

        {successMsg && (
          <Alert className="bg-primary/10 border-primary/20 text-primary">
            <AlertDescription className="text-xs font-semibold">{successMsg}</AlertDescription>
          </Alert>
        )}

        {errorMsg && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
