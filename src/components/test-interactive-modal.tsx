/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@evoapi/design-system/button";
import { Label } from "@evoapi/design-system/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@evoapi/design-system/tabs";
import { Textarea } from "@evoapi/design-system/textarea";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { api } from "@/lib/queries/api";

import { Instance } from "@/types/evolution.types";

type TabKey = "reply" | "cta" | "pix" | "list" | "carousel";

const ENDPOINT: Record<TabKey, string> = {
  reply: "sendButtons",
  cta: "sendButtons",
  pix: "sendButtons",
  list: "sendList",
  carousel: "sendCarousel",
};

const TEMPLATES: Record<TabKey, Record<string, unknown>> = {
  reply: {
    title: "Resposta Rápida",
    description: "Escolha uma das opções abaixo:",
    footer: "Evolution API",
    buttons: [
      { type: "reply", displayText: "✅ Confirmar", id: "opt_confirm" },
      { type: "reply", displayText: "❌ Cancelar", id: "opt_cancel" },
      { type: "reply", displayText: "🤔 Talvez", id: "opt_maybe" },
    ],
  },
  cta: {
    title: "Botões CTA",
    description: "Botões de URL e copia-código (cta_url + cta_copy):",
    footer: "Máx. 2 botões CTA por mensagem",
    buttons: [
      { type: "url", displayText: "🌐 Abrir site", url: "https://example.com" },
      {
        type: "copy",
        displayText: "📋 Copiar PIX",
        copyCode:
          "00020126580014BR.GOV.BCB.PIX0136abc12345-6789-0000-aaaa-bbbbccccdddd5204000053039865802BR5913FULANO DE TAL6009SAO PAULO62070503***6304ABCD",
      },
    ],
  },
  pix: {
    title: "Pagamento via PIX",
    description: "Toque para pagar via PIX (payment_info)",
    footer: "WhatsApp Pay",
    buttons: [
      {
        type: "pix",
        currency: "BRL",
        name: "Empresa Exemplo",
        keyType: "random",
        key: "abc12345-6789-0000-aaaa-bbbbccccdddd",
      },
    ],
  },
  list: {
    title: "Cardápio de Teste",
    description: "Escolha um item abaixo",
    footerText: "Validade hoje",
    buttonText: "Ver opções",
    sections: [
      {
        title: "Bebidas",
        rows: [
          { title: "Coca-Cola", description: "Lata 350ml", rowId: "coca" },
          { title: "Suco de Laranja", description: "300ml natural", rowId: "suco" },
        ],
      },
      {
        title: "Lanches",
        rows: [{ title: "X-Burger", description: "Pão, carne 150g, queijo", rowId: "xburger" }],
      },
    ],
  },
  carousel: {
    body: "Catálogo da semana",
    cards: [
      {
        body: "Produto A",
        footer: "R$ 99,90",
        imageUrl: "https://picsum.photos/seed/a/600/400",
        buttons: [{ type: "url", displayText: "Comprar", url: "https://exemplo.com/a" }],
      },
      {
        body: "Produto B",
        footer: "R$ 149,90",
        imageUrl: "https://picsum.photos/seed/b/600/400",
        buttons: [{ type: "url", displayText: "Comprar", url: "https://exemplo.com/b" }],
      },
      {
        body: "Produto C",
        footer: "R$ 199,90",
        imageUrl: "https://picsum.photos/seed/c/600/400",
        buttons: [{ type: "reply", displayText: "Quero!", id: "prod_c" }],
      },
    ],
  },
};

interface TestInteractiveModalProps {
  instance: Instance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestInteractiveModal({ instance, open, onOpenChange }: TestInteractiveModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("reply");
  const [number, setNumber] = useState("");
  const [payloads, setPayloads] = useState<Record<TabKey, string>>(() => ({
    reply: JSON.stringify(TEMPLATES.reply, null, 2),
    cta: JSON.stringify(TEMPLATES.cta, null, 2),
    pix: JSON.stringify(TEMPLATES.pix, null, 2),
    list: JSON.stringify(TEMPLATES.list, null, 2),
    carousel: JSON.stringify(TEMPLATES.carousel, null, 2),
  }));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSending(false);
    }
  }, [open]);

  const endpoint = useMemo(
    () => `/message/${ENDPOINT[tab]}/${instance.name}`,
    [tab, instance.name],
  );

  const send = async () => {
    const target = number.replace(/\D/g, "");
    if (!target) {
      toast.error(t("testInteractive.errors.missingNumber"));
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloads[tab]);
    } catch (e: any) {
      toast.error(t("testInteractive.errors.invalidJson", { message: e.message }));
      return;
    }
    payload.number = target;

    try {
      setSending(true);
      const res = await api.post(endpoint, payload, {
        headers: { apikey: instance.token },
      });
      const msgId = res.data?.key?.id || res.data?.messageId || "ok";
      toast.success(t("testInteractive.success", { id: msgId }));
      onOpenChange(false);
    } catch (error: any) {
      const msg =
        error?.response?.data?.response?.message ||
        error?.response?.data?.message ||
        error?.message ||
        t("testInteractive.errors.unknown");
      toast.error(Array.isArray(msg) ? msg.join("; ") : msg);
    } finally {
      setSending(false);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "reply", label: t("testInteractive.tabs.reply") },
    { key: "cta", label: t("testInteractive.tabs.cta") },
    { key: "pix", label: t("testInteractive.tabs.pix") },
    { key: "list", label: t("testInteractive.tabs.list") },
    { key: "carousel", label: t("testInteractive.tabs.carousel") },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("testInteractive.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("testInteractive.subtitle", { instance: instance.name })}{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">POST {endpoint}</code>
          </p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="grid w-full grid-cols-5">
              {tabs.map((tb) => (
                <TabsTrigger key={tb.key} value={tb.key}>
                  {tb.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs.map((tb) => (
              <TabsContent key={tb.key} value={tb.key} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="ti-number">{t("testInteractive.number")}</Label>
                  <Input
                    id="ti-number"
                    placeholder="5511999999999"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {t("testInteractive.numberHint")}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ti-payload">{t("testInteractive.payload")}</Label>
                  <Textarea
                    id="ti-payload"
                    rows={12}
                    className="font-mono text-xs"
                    value={payloads[tb.key]}
                    onChange={(e) => setPayloads((p) => ({ ...p, [tb.key]: e.target.value }))}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              {t("button.cancel")}
            </Button>
            <Button onClick={send} disabled={sending}>
              {sending ? t("testInteractive.sending") : t("testInteractive.send")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
