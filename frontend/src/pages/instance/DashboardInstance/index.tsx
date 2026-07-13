/* eslint-disable react-hooks/exhaustive-deps */
import { Alert, AlertTitle } from "@evoapi/design-system/alert";
import { Avatar, AvatarImage } from "@evoapi/design-system/avatar";
import { Button } from "@evoapi/design-system/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CircleUser, Copy, Globe, LogOut, MessageCircle, Power, QrCode, RefreshCw, Send, Smartphone, ShieldAlert, UsersRound } from "lucide-react";
import { copyToClipboard } from "@/utils/copy-to-clipboard";

const InstanceName = ({ name }: { name: string }) => (
  <div className="flex items-center gap-3 truncate rounded-sm bg-primary/20 px-2 py-1">
    <pre className="block truncate text-xs font-mono">{name}</pre>
    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(name)}>
      <Copy size="15" />
    </Button>
  </div>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="WhatsApp">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";

import { BaseHeader } from "@/components/base-header";
import { InstanceStatus } from "@/components/instance-status";
import { InstanceToken } from "@/components/instance-token";
import { useTheme } from "@/components/theme-provider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import { useInstance } from "@/contexts/InstanceContext";

import { useManageInstance } from "@/lib/queries/instance/manageInstance";
import { getProvider, getToken, TOKEN_ID } from "@/lib/queries/token";

import { GoQrCodeModal } from "./GoQrCodeModal";
import { GoSendMessageModal } from "./GoSendMessageModal";
import { PrimaryRegistrationDialog } from "../../Dashboard/PrimaryRegistration";
import { ProxyStatusPanel } from "../Proxy";
import { CompanionsPanel } from "./CompanionsPanel";
import { EmailSecurityPanel } from "../Settings/EmailSecurityPanel";
import { connectSocket, disconnectSocket } from "@/services/websocket/socket";
import { useQueryClient } from "@tanstack/react-query";

function DashboardInstance() {
  const { t, i18n } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(i18n.language);
  const [qrCode, setQRCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [goQrOpen, setGoQrOpen] = useState(false);
  const [goSendOpen, setGoSendOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [primaryRegOpen, setPrimaryRegOpen] = useState(false);
  const token = getToken(TOKEN_ID.TOKEN);
  const isGo = getProvider() === "go";
  const { theme } = useTheme();

  const { connect, logout, restart, syncProfile } = useManageInstance();
  const { instance, reloadInstance } = useInstance();
  const queryClient = useQueryClient();

  // Estados de alertas do Bloco C (Mobile Security)
  const [regCodeAlert, setRegCodeAlert] = useState<{ code: string; expiryTimestampMs: number } | null>(null);
  const [takeoverAlert, setTakeoverAlert] = useState<{ newDeviceName?: string; newDevicePlatform?: string } | null>(null);

  useEffect(() => {
    if (instance) {
      localStorage.setItem(TOKEN_ID.INSTANCE_ID, instance.id);
      localStorage.setItem(TOKEN_ID.INSTANCE_NAME, instance.name);
      localStorage.setItem(TOKEN_ID.INSTANCE_TOKEN, instance.token);
    }
  }, [instance]);

  // Auto-refresh QR code every 20 seconds while the dialog is open.
  // WhatsApp QR codes expire in ~20 seconds; this keeps them valid silently.
  useEffect(() => {
    if (!qrDialogOpen || !instance || !token) return;

    const refreshQR = async () => {
      try {
        const data = await connect({ instanceName: instance.name, token });
        if (data?.code) setQRCode(data.code);
      } catch (error) {
        console.error("Error auto-refreshing QR code:", error);
      }
    };

    const interval = setInterval(refreshQR, 20000);
    return () => clearInterval(interval);
  }, [qrDialogOpen]);

  // Escuta Socket para os eventos de Companions e Alertas de Segurança (Bloco C)
  useEffect(() => {
    if (!instance || !token) return;

    const apiUrl = getToken(TOKEN_ID.API_URL) || window.location.origin;
    const socket = connectSocket(apiUrl.toString(), {
      instanceName: instance.name,
      apikey: token,
    });

    const handleRegCode = (event: any) => {
      if (event.instance === instance.name) {
        setRegCodeAlert({
          code: event.data.code,
          expiryTimestampMs: Number(event.data.expiryTimestampMs),
        });
      }
    };

    const handleTakeover = (event: any) => {
      if (event.instance === instance.name) {
        setTakeoverAlert({
          newDeviceName: event.data.newDeviceName,
          newDevicePlatform: event.data.newDevicePlatform,
        });
      }
    };

    const handleCompanionUpdate = (event: any) => {
      if (event.instance === instance.name) {
        // Invalida a lista de companions para atualizar na tela em tempo real
        queryClient.invalidateQueries({ queryKey: ["companions", instance.name] });
      }
    };

    const handleCompanionError = (event: any) => {
      if (event.instance === instance.name) {
        toast.error(`Erro ao gerenciar aparelho vinculado: ${event.data.message}`);
      }
    };

    socket.on("mobile_registration_code", handleRegCode);
    socket.on("mobile_account_takeover_notice", handleTakeover);
    socket.on("companion_host_linked", handleCompanionUpdate);
    socket.on("companion_host_revoked", handleCompanionUpdate);
    socket.on("companion_host_error", handleCompanionError);

    socket.connect();

    return () => {
      socket.offHandler("mobile_registration_code", handleRegCode);
      socket.offHandler("mobile_account_takeover_notice", handleTakeover);
      socket.offHandler("companion_host_linked", handleCompanionUpdate);
      socket.offHandler("companion_host_revoked", handleCompanionUpdate);
      socket.offHandler("companion_host_error", handleCompanionError);
      disconnectSocket(socket);
    };
  }, [instance?.name, token, queryClient]);

  const handleReload = async () => {
    await reloadInstance();
  };

  const handleSyncProfile = async (instanceName: string) => {
    try {
      if (!token) return;
      await syncProfile({ instanceName, token });
      await reloadInstance();
    } catch (error) {
      console.error("Error syncing profile:", error);
    }
  };

  const handleRestart = async (instanceName: string) => {
    try {
      await restart(instanceName);
      await reloadInstance();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleLogout = async (instanceName: string) => {
    try {
      await logout(instanceName);
      await reloadInstance();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleConnect = async (instanceName: string, wantPairing: boolean) => {
    try {
      setQRCode(null);
      if (!token) return console.error("Token not found.");

      if (wantPairing) {
        const data = await connect({ instanceName, token, number: instance?.number });
        setPairingCode(data.pairingCode);
      } else {
        const data = await connect({ instanceName, token });
        setQRCode(data.code);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const closeQRCodePopup = async () => {
    setQRCode(null);
    setPairingCode("");
    await reloadInstance();
  };

  const stats = useMemo(
    () => ({
      contacts: instance?._count?.Contact || 0,
      chats: instance?._count?.Chat || 0,
      messages: instance?._count?.Message || 0,
    }),
    [instance],
  );

  const qrCodeColor = useMemo(() => (theme === "dark" ? "#fff" : theme === "light" ? "#000" : "#189d68"), [theme]);
  const formatOwnerJid = (ownerJid: string) => ownerJid.split("@")[0].split(":")[0];

  if (!instance) return <LoadingSpinner />;

  const connected = instance.connectionStatus === "open";
  const instanceType = (instance.instanceType === "primary" ? "mobile" : instance.instanceType) ?? (instance.mobileTransport ? "mobile" : "web");
  const versionLabel = instanceType === "mobile" ? t("instance.dashboard.version.mobile", { defaultValue: "Versão do app mobile" }) : t("instance.dashboard.version.web", { defaultValue: "Versão do WhatsApp Web" });
  const versionValue = instance.softwareVersion || t("instance.dashboard.version.unavailable", { defaultValue: "Não disponível" });

  return (
    <div className="flex flex-col">
      <BaseHeader
        title={instance.profileName
          ? <span className="flex items-center gap-2">{instance.profileName}<WhatsAppIcon className="h-5 w-5 flex-shrink-0 text-[#25D366]" /></span>
          : instance.name}
        subtitle={instance.profileName ? instance.name : t("instance.dashboard.subtitle", { defaultValue: "Gerencie sua instância" })}
        secondaryActions={[
          {
            label: t("button.refresh", { defaultValue: "Atualizar" }),
            icon: <RefreshCw className="h-4 w-4" />,
            onClick: handleReload,
          },
          {
            label: t("instance.dashboard.button.restart", { defaultValue: "Reiniciar" }),
            icon: <Power className="h-4 w-4" />,
            onClick: () => handleRestart(instance.name),
          },
          ...(connected
            ? [
                {
                  label: t("instance.dashboard.button.syncProfile", { defaultValue: "Sincronizar Perfil" }),
                  icon: <RefreshCw className="h-4 w-4" />,
                  onClick: () => handleSyncProfile(instance.name),
                },
                {
                  label: t("instance.dashboard.button.disconnect", { defaultValue: "Desconectar" }),
                  icon: <LogOut className="h-4 w-4" />,
                  onClick: () => handleLogout(instance.name),
                  variant: "destructive" as const,
                },
              ]
            : []),
          ...(isGo && connected
            ? [
                {
                  label: t("instance.dashboard.button.sendMessage", { defaultValue: "Enviar mensagem" }),
                  icon: <Send className="h-4 w-4" />,
                  onClick: () => setGoSendOpen(true),
                  variant: "default" as const,
                },
              ]
            : []),
        ]}
      />

      <div className="flex flex-col gap-6">
        {/* Bloco C: Alertas Críticos de Segurança em Tempo Real */}
        {takeoverAlert && (
          <Alert variant="destructive" className="w-full flex flex-col gap-2 bg-red-950 border-red-800 text-red-200">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-red-500 animate-bounce" />
              <div>
                <AlertTitle className="text-base font-bold text-red-400">
                  ALERTA CRÍTICO: Tentativa de Takeover Detectada!
                </AlertTitle>
                <p className="text-xs text-red-300">
                  Outro dispositivo ({takeoverAlert.newDeviceName || "desconhecido"} na plataforma {takeoverAlert.newDevicePlatform || "?"}) está tentando assumir o controle do seu número de WhatsApp!
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" className="text-red-200 border-red-700 bg-red-900/55 hover:bg-red-800" onClick={() => setTakeoverAlert(null)}>
                Desconsiderar
              </Button>
            </div>
          </Alert>
        )}

        {regCodeAlert && (
          <Alert variant="destructive" className="w-full flex flex-col gap-2 bg-amber-950 border-amber-800 text-amber-200">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-500 animate-pulse" />
              <div>
                <AlertTitle className="text-base font-bold text-amber-400">
                  Aviso de Segurança: Código de Registro Solicitado
                </AlertTitle>
                <p className="text-xs text-amber-300">
                  Um código SMS de registro foi solicitado para o seu número! Código recebido: <span className="font-mono font-bold text-sm bg-amber-900 px-2 py-0.5 rounded">{regCodeAlert.code}</span>. Expira em {new Date(regCodeAlert.expiryTimestampMs).toLocaleTimeString()}.
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" className="text-amber-200 border-amber-700 bg-amber-900/55 hover:bg-amber-800" onClick={() => setRegCodeAlert(null)}>
                Fechar
              </Button>
            </div>
          </Alert>
        )}

        <Card className="border-sidebar-border bg-sidebar">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {instance.profilePicUrl && (
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={instance.profilePicUrl} alt={instance.name} />
                  </Avatar>
                )}
                <div>
                  <CardTitle className="flex items-center gap-2 break-all">
                    {instance.profileName || instance.name}
                    {instance.profileName && <WhatsAppIcon className="h-4 w-4 flex-shrink-0 text-[#25D366]" />}
                  </CardTitle>
                  {instance.ownerJid && (
                    <p className="mt-1 break-all text-xs text-muted-foreground">{formatOwnerJid(instance.ownerJid)}</p>
                  )}
                </div>
              </div>
              <InstanceStatus status={instance.connectionStatus} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-start space-y-4">
            <div className="w-full space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t("instance.dashboard.instanceName", { defaultValue: "Nome da instância" })}</p>
              <InstanceName name={instance.name} />
            </div>
            <div className="w-full space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t("instance.dashboard.token", { defaultValue: "Token da instância" })}</p>
              <InstanceToken token={instance.token} />
            </div>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/20 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {instanceType === "mobile" ? <Smartphone className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  {t("instance.type.label", { defaultValue: "Tipo da instância" })}
                </div>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {instanceType === "mobile" ? t("instance.type.mobile", { defaultValue: "Mobile" }) : t("instance.type.web", { defaultValue: "Web" })}
                </p>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/20 p-3 sm:col-span-2">
                <div className="text-xs font-medium text-muted-foreground">{versionLabel}</div>
                <p className="mt-1 break-all text-sm font-semibold">{versionValue}</p>
              </div>
            </div>

            {instanceType === "mobile" && instance.deviceInfo && (
              <div className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/5 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  {t("instance.dashboard.deviceInfo.title", { defaultValue: "Dispositivo Emulado" })}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-2.5">
                    <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                      {t("instance.dashboard.deviceInfo.manufacturer", { defaultValue: "Fabricante" })}
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block capitalize">
                      {(instance.deviceInfo as any).manufacturer || "—"}
                    </span>
                  </div>
                  <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-2.5">
                    <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                      {t("instance.dashboard.deviceInfo.model", { defaultValue: "Modelo" })}
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block font-mono">
                      {(instance.deviceInfo as any).device || "—"}
                    </span>
                  </div>
                  <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-2.5">
                    <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                      {t("instance.dashboard.deviceInfo.os", { defaultValue: "Sistema Operacional" })}
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block font-mono">
                      Android {(instance.deviceInfo as any).osVersion || "16"}
                    </span>
                  </div>
                  <div className="rounded-md border border-sidebar-border/60 bg-sidebar p-2.5">
                    <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                      {t("instance.dashboard.deviceInfo.build", { defaultValue: "Build do Sistema" })}
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block font-mono truncate" title={String((instance.deviceInfo as any).osBuildNumber || "")}>
                      {(instance.deviceInfo as any).osBuildNumber || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {instance.proxyEnabled && instance.proxyConnected === false && (
              <Alert variant="destructive" className="w-full flex items-start gap-3">
                <div className="mt-0.5">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <AlertTitle className="text-sm font-bold text-red-500">
                    {t("proxy.alert.failed.title", { defaultValue: "Falha na conexão do Proxy" })}
                  </AlertTitle>
                  <p className="mt-1 text-xs text-red-500/90 break-all leading-normal">
                    {instance.proxyError || t("proxy.alert.failed.description", { defaultValue: "Não foi possível estabelecer conexão através do proxy configurado. Por favor, verifique as configurações." })}
                  </p>
                </div>
              </Alert>
            )}

            {!connected && (
              <Alert variant="warning" className="flex flex-wrap items-center justify-between gap-3">
                <AlertTitle className="text-lg font-bold tracking-wide">
                  {instanceType === "mobile" 
                    ? t("instance.dashboard.alert.mobile", { defaultValue: "Esta é uma instância móvel pendente de registro." })
                    : t("instance.dashboard.alert")
                  }
                </AlertTitle>

                {isGo ? (
                  <>
                    <Button onClick={() => setGoQrOpen(true)}>
                      <QrCode className="mr-2 h-4 w-4" />
                      {t("instance.dashboard.button.qrcode.label")}
                    </Button>
                    <GoQrCodeModal open={goQrOpen} onOpenChange={setGoQrOpen} />
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {instanceType === "mobile" && (
                      <>
                        <Button onClick={() => setPrimaryRegOpen(true)} variant="outline">
                          <Smartphone className="mr-2 h-4 w-4" />
                          {t("primaryRegistration.button", { defaultValue: "Registrar via SMS/Voz" })}
                        </Button>
                        <PrimaryRegistrationDialog
                          open={primaryRegOpen}
                          onOpenChange={setPrimaryRegOpen}
                          resetTable={handleReload}
                          defaultInstanceName={instance.name}
                        />
                      </>
                    )}

                    <Dialog
                      open={qrDialogOpen}
                      onOpenChange={(open) => {
                        setQrDialogOpen(open);
                        if (!open) closeQRCodePopup();
                      }}
                    >
                      <DialogTrigger
                        onClick={() => {
                          setQrDialogOpen(true);
                          handleConnect(instance.name, false);
                        }}
                        asChild
                      >
                        <Button>
                          <QrCode className="mr-2 h-4 w-4" />
                          {t("instance.dashboard.button.qrcode.label")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent aria-describedby={undefined}>
                        <DialogHeader>
                          <DialogTitle>{t("instance.dashboard.button.qrcode.title")}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-3 py-4">
                          {qrCode ? (
                            <>
                              <QRCode value={qrCode} size={256} bgColor="transparent" fgColor={qrCodeColor} className="rounded-sm" />
                              <p className="text-xs text-muted-foreground animate-pulse">
                                {t("instance.dashboard.qrcode.autoRefresh", { defaultValue: "QR Code atualiza automaticamente a cada 20 segundos" })}
                              </p>
                            </>
                          ) : (
                            <LoadingSpinner />
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {instance.number && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" onClick={() => handleConnect(instance.name, true)}>
                            {t("instance.dashboard.button.pairingCode.label")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent onCloseAutoFocus={closeQRCodePopup}>
                          <DialogHeader>
                            <DialogTitle>{t("instance.dashboard.button.pairingCode.label")}</DialogTitle>
                            <DialogDescription>
                              {pairingCode ? (
                                <div className="py-3">
                                  <p className="text-center font-semibold">{t("instance.dashboard.button.pairingCode.title")}</p>
                                  <p className="mt-2 text-center font-mono text-2xl tracking-widest">
                                    {pairingCode.substring(0, 4)}-{pairingCode.substring(4, 8)}
                                  </p>
                                </div>
                              ) : (
                                <LoadingSpinner />
                              )}
                            </DialogDescription>
                          </DialogHeader>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                )}
              </Alert>
            )}
          </CardContent>
          <CardFooter />
        </Card>

        {isGo && <GoSendMessageModal open={goSendOpen} onOpenChange={setGoSendOpen} />}

        {instance.proxyEnabled && (
          <div className="w-full">
            <ProxyStatusPanel instanceName={instance.name} />
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-sidebar-border bg-sidebar">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CircleUser size="18" />
                {t("instance.dashboard.contacts")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{numberFormatter.format(stats.contacts)}</CardContent>
          </Card>
          <Card className="border-sidebar-border bg-sidebar">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UsersRound size="18" />
                {t("instance.dashboard.chats")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{numberFormatter.format(stats.chats)}</CardContent>
          </Card>
          <Card className="border-sidebar-border bg-sidebar">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageCircle size="18" />
                {t("instance.dashboard.messages")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{numberFormatter.format(stats.messages)}</CardContent>
          </Card>
        </section>
        
        {/*
          companionHost/email só existem no zapo-js quando a sessão é Mobile
          Primary registrada via SMS/OTP (registeredPhone preenchido no
          backend — ver instanceType em instance.routes.ts). ownerJid não
          serve de sinal aqui: é preenchido para qualquer sessão autenticada,
          inclusive pareamento QR clássico (companion de outro celular
          primário), que sempre receberá 403 dessas rotas.
        */}
        {instance.instanceType === "primary" && connected && (
          <>
            <div className="border-t pt-6">
              <CompanionsPanel instanceName={instance.name} />
            </div>
            <div className="border-t pt-6">
              <EmailSecurityPanel instanceName={instance.name} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { DashboardInstance };
