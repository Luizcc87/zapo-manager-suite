import { CheckCircle2, KeyRound, QrCode, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@evoapi/design-system/label";

import { useInstance } from "@/contexts/InstanceContext";

import { useManageInstance } from "@/lib/queries/instance/manageInstance";
import { api } from "@/lib/queries/api";

const LOG = (...args: unknown[]) => console.log("[GoQrCodeModal]", ...args);
const ERR = (...args: unknown[]) => console.error("[GoQrCodeModal]", ...args);

interface GoQrCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoQrCodeModal({ open, onOpenChange }: GoQrCodeModalProps) {
  const { t } = useTranslation();
  const { instance, reloadInstance } = useInstance();
  const { connect } = useManageInstance();

  const [base64, setBase64] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);

  // Prevent fullConnect from being called more than once per modal-open session
  const connectCalledRef = useRef(false);

  const connected = instance?.connectionStatus === "open";

  const fullConnect = useCallback(async () => {
    if (!instance) return;
    LOG("fullConnect() start — instanceName:", instance.name);
    setLoading(true);
    try {
      const data = await connect({ instanceName: instance.name, token: instance.token });
      LOG("fullConnect() response:", data);
      setBase64((data as { base64?: string })?.base64 ?? "");
      setPairingCode((data as { pairingCode?: string })?.pairingCode ?? "");
      await reloadInstance();
    } catch (err) {
      ERR("fullConnect() error:", err);
      // Silent — UI shows "Aguardando QR Code..." and user can click refresh or use pairing
    } finally {
      setLoading(false);
      LOG("fullConnect() done");
    }
  }, [connect, instance, reloadInstance]);

  const requestPairing = useCallback(async () => {
    if (!instance || !phone.trim()) {
      ERR("requestPairing() aborted — instance:", !!instance, "phone:", JSON.stringify(phone));
      return;
    }
    const phoneClean = phone.trim();
    LOG("requestPairing() start — phone:", phoneClean, "instanceName:", instance.name);
    setPairingLoading(true);
    try {
      // Use axios directly (bypass React Query mutation) to avoid race conditions
      // with the ongoing fullConnect mutation state, and to set a longer timeout.
      const url = `/instance/connect/${instance.name}`;
      const params = { number: phoneClean };
      LOG("requestPairing() → GET", url, "params:", JSON.stringify(params), "token:", instance.token?.slice(0, 8) + "...");
      const response = await api.get(url, {
        headers: { apikey: instance.token },
        params,
        timeout: 35000,
      });
      const data = response.data;
      LOG("requestPairing() response status:", response.status, "data:", JSON.stringify(data));
      const code = (data as { pairingCode?: string })?.pairingCode ?? "";
      const b64 = (data as { base64?: string })?.base64 ?? "";
      LOG("requestPairing() parsed — pairingCode:", code, "base64 present:", !!b64);
      if (code) {
        setPairingCode(code);
        setBase64("");
        toast.success(t("qrCode.toast.pairingSuccess"));
      } else {
        ERR("requestPairing() — backend returned no pairingCode. Full response:", JSON.stringify(data));
        toast.error(t("qrCode.toast.pairingError"));
      }
      await reloadInstance();
    } catch (error: unknown) {
      ERR("requestPairing() error:", error);
      toast.error(t("qrCode.toast.pairingError"));
    } finally {
      setPairingLoading(false);
      LOG("requestPairing() done");
    }
  }, [instance, phone, reloadInstance, t]);

  const pollRefresh = useCallback(async () => {
    await reloadInstance();
  }, [reloadInstance]);

  // Trigger fullConnect exactly once when modal opens (not on reconnected instances)
  useEffect(() => {
    LOG("Modal mounted/updated. Open status:", open, "Connected status:", connected);
    if (!open || connected) {
      connectCalledRef.current = false;
      return;
    }
    if (connectCalledRef.current) {
      LOG("fullConnect already invoked for this session, skipping duplicate execution.");
      return;
    }
    connectCalledRef.current = true;
    LOG("useEffect[open=true] — calling fullConnect()");
    fullConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Poll connection status every 3s while modal is open and not connected
  useEffect(() => {
    if (!open || connected) return;
    LOG("Starting 3s status polling interval...");
    const timer = setInterval(() => {
      pollRefresh().catch((err) => ERR("Poll failed:", err));
    }, 3000);
    return () => clearInterval(timer);
  }, [open, connected, pollRefresh]);

  const handleRefresh = async () => {
    LOG("handleRefresh() triggered manual refresh");
    try {
      await fullConnect();
      toast.success(t("qrCode.toast.refreshSuccess"));
    } catch {
      toast.error(t("qrCode.toast.refreshError"));
    }
  };

  const handleClose = () => {
    LOG("handleClose() — resetting state");
    setBase64("");
    setPairingCode("");
    setPhone("");
    connectCalledRef.current = false;
    onOpenChange(false);
  };

  if (!instance) {
    LOG("No instance loaded in context, rendering null");
    return null;
  }

  if (connected) {
    LOG("Instance is connected! Showing success dialog screen.");
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              {t("qrCode.connected.title")}
            </DialogTitle>
            <DialogDescription>
              {t("qrCode.connected.description", { instanceName: instance.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-6">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            {instance.profileName && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{t("qrCode.connected.connectedAs")}</p>
                <p className="text-lg font-semibold">{instance.profileName}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleClose} className="w-full sm:w-auto">
              {t("qrCode.button.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  LOG("Rendering active setup modal (QR / Pairing Code screen). Base64 exists:", !!base64, "Pairing code:", pairingCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md gap-0 p-6"
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
          height: "auto",
          overflow: "hidden"
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            {t("qrCode.title")}
          </DialogTitle>
          <DialogDescription>
            {t("qrCode.description")} <strong>{instance.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {/* QR Code area — hidden once pairing code is received */}
          {!pairingCode && (
            <div className="flex justify-center">
              {base64 ? (
                <div className="rounded-lg border-2 border-border bg-white p-3">
                  <img src={base64} alt="QR Code" className="h-56 w-56" />
                </div>
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-lg border-2 border-dashed border-border">
                  <div className="text-center">
                    <QrCode className="mx-auto h-12 w-12 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {loading ? t("qrCode.generating") : t("qrCode.waiting")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pairing code result box */}
          {pairingCode && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-full rounded-lg bg-muted p-4 text-center">
                <p className="text-xs text-muted-foreground">{t("qrCode.pairingCode.label")}</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em]">{pairingCode}</p>
              </div>
            </div>
          )}

          {/* Instructions — collapsible to reduce default height */}
          <details className="rounded-lg bg-muted p-3">
            <summary className="cursor-pointer text-sm font-medium select-none">
              {t("qrCode.howTo.title")}
            </summary>
            <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>1. {t("qrCode.howTo.step1")}</li>
              <li>2. {t("qrCode.howTo.step2")}</li>
              <li>3. {t("qrCode.howTo.step3")}</li>
              <li>4. {t("qrCode.howTo.step4")}</li>
              <li>5. {t("qrCode.howTo.step5")}</li>
            </ol>
          </details>

          {/* Phone number input for pairing code */}
          <div className="space-y-2 border-t border-border pt-3">
            <Label htmlFor="pairing-phone" className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4" />
              {t("qrCode.pairingCode.title")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="pairing-phone"
                type="tel"
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => {
                  LOG("phone input →", e.target.value);
                  setPhone(e.target.value);
                }}
                disabled={pairingLoading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  LOG("Gerar Código clicked — phone:", JSON.stringify(phone), "trimmed:", JSON.stringify(phone.trim()));
                  requestPairing();
                }}
                disabled={!phone.trim() || pairingLoading}
              >
                {pairingLoading ? t("qrCode.pairingCode.generating") : t("qrCode.pairingCode.generate")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("qrCode.pairingCode.hint")}</p>
          </div>
        </div>

        {/* Bottom buttons — always visible, never scrolled away */}
        <div className="flex-shrink-0 flex gap-2 pt-3 border-t border-border">
          <Button variant="outline" onClick={handleRefresh} disabled={loading} className="flex-1">
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t("qrCode.button.refreshing")}
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("qrCode.button.refresh")}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
