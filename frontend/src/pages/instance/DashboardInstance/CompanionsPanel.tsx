import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCompanions, useLinkCompanion, useRevokeCompanion, useRevokeAllCompanions, useReconcileCompanions } from "@/lib/queries/instance/companion";
import { Button } from "@evoapi/design-system/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Input } from "@/components/ui/input";
import { Label } from "@evoapi/design-system/label";
import { Alert, AlertDescription, AlertTitle } from "@evoapi/design-system/alert";
import { ShieldAlert, Trash2, Link2, RefreshCw, Layers } from "lucide-react";

interface CompanionsPanelProps {
  instanceName: string;
}

export function CompanionsPanel({ instanceName }: CompanionsPanelProps) {
  const { t } = useTranslation();
  const { data: companions, isLoading, error, refetch } = useCompanions(instanceName);
  const linkMutation = useLinkCompanion(instanceName);
  const revokeMutation = useRevokeCompanion(instanceName);
  const revokeAllMutation = useRevokeAllCompanions(instanceName);
  const reconcileMutation = useReconcileCompanions(instanceName);

  const [mode, setMode] = useState<"qr" | "code">("qr");
  const [value, setValue] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    if (!value.trim()) return;

    try {
      await linkMutation.mutateAsync({ mode, value: value.trim() });
      setSuccessMsg(t("zapoMobile.companions.msgSuccess", "Solicitação de pareamento enviada com sucesso!"));
      setValue("");
      refetch();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || t("zapoMobile.companions.msgError", "Erro ao parear."));
    }
  };

  const handleRevoke = async (deviceJid: string) => {
    if (!window.confirm(t("zapoMobile.companions.confirmRevoke", { jid: deviceJid, defaultValue: "Tem certeza que deseja desconectar o companion {{jid}}?" }))) return;
    try {
      await revokeMutation.mutateAsync({ deviceJid });
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleRevokeAll = async (excludeHosted: boolean) => {
    const msg = excludeHosted
      ? t("zapoMobile.companions.confirmRevokeOthers", "Deseja desconectar todos os companions EXCETO o hospedado por esta sessão?")
      : t("zapoMobile.companions.confirmRevokeAll", "Deseja desconectar absolutamente TODOS os companions secundários?");
    if (!window.confirm(msg)) return;

    try {
      await revokeAllMutation.mutateAsync({ excludeHostedCompanion: excludeHosted });
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleReconcile = async () => {
    try {
      await reconcileMutation.mutateAsync();
      refetch();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Esquerda: Lista de Companions */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {t("zapoMobile.companions.title", "Companions Conectados")}
            </CardTitle>
            <CardDescription>
              {t("zapoMobile.companions.subtitle", "WhatsApp Web ou celulares secundários atualmente hospedados por esta sessão primária.")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconcile}
            disabled={reconcileMutation.isPending || isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${reconcileMutation.isPending ? "animate-spin" : ""}`} />
            {t("zapoMobile.companions.sync", "Sincronizar")}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              {t("zapoMobile.companions.loading", "Carregando companions...")}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{t("zapoMobile.companions.errorTitle", "Erro")}</AlertTitle>
              <AlertDescription>{t("zapoMobile.companions.error", "Não foi possível carregar a lista de companions.")}</AlertDescription>
            </Alert>
          ) : !companions || companions.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
              {t("zapoMobile.companions.empty", "Nenhum companion pareado. Utilize a seção ao lado para vincular novos aparelhos.")}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                    <tr>
                      <th className="px-4 py-3">{t("zapoMobile.companions.colDevice", "Dispositivo (JID)")}</th>
                      <th className="px-4 py-3">{t("zapoMobile.companions.colKey", "Key Index")}</th>
                      <th className="px-4 py-3">{t("zapoMobile.companions.colAdded", "Adicionado em")}</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {companions.map((comp) => (
                      <tr key={comp.deviceJid} className="border-t hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{comp.deviceJid}</td>
                        <td className="px-4 py-3">{comp.keyIndex}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(comp.addedAtSeconds * 1000).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRevoke(comp.deviceJid)}
                            disabled={revokeMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleRevokeAll(true)}
                  disabled={revokeAllMutation.isPending}
                >
                  {t("zapoMobile.companions.btnRevokeOthers", "Revogar Outros")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleRevokeAll(false)}
                  disabled={revokeAllMutation.isPending}
                >
                  {t("zapoMobile.companions.btnRevokeAll", "Revogar Todos")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direita: Formulário de Pareamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {t("zapoMobile.companions.linkTitle", "Vincular Novo Companion")}
          </CardTitle>
          <CardDescription>
            {t("zapoMobile.companions.linkSubtitle", "Insira o QR Code bruto ou o código de pareamento de 8 dígitos gerado pelo aparelho secundário.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLink} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("zapoMobile.companions.linkMode", "Modo de Pareamento")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "qr" ? "default" : "outline"}
                  onClick={() => setMode("qr")}
                  className="w-full text-xs"
                >
                  {t("zapoMobile.companions.modeQr", "QR Code (Bruto)")}
                </Button>
                <Button
                  type="button"
                  variant={mode === "code" ? "default" : "outline"}
                  onClick={() => setMode("code")}
                  className="w-full text-xs"
                >
                  {t("zapoMobile.companions.modeCode", "Código (8 dígitos)")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payload-value">
                {mode === "qr" ? t("zapoMobile.companions.modeQr", "QR Code (Bruto)") : t("zapoMobile.companions.modeCode", "Código (8 dígitos)")}
              </Label>
              <Input
                id="payload-value"
                placeholder={
                  mode === "qr"
                    ? t("zapoMobile.companions.inputQrPlaceholder", "ex: 2@H2H3Jg4Lh...")
                    : t("zapoMobile.companions.inputCodePlaceholder", "ex: ABCD-EFGH ou ABCDEFGH")
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full flex items-center gap-2"
              disabled={linkMutation.isPending}
            >
              <Link2 className="h-4 w-4" />
              {linkMutation.isPending ? t("zapoMobile.companions.btnSubmitting", "Conectando...") : t("zapoMobile.companions.btnSubmit", "Parear Dispositivo")}
            </Button>

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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
