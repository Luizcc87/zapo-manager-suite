/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { z } from "zod";

import { Button } from "@evoapi/design-system/button";
import { Form, FormControl, FormDescription, FormField, FormInput, FormItem, FormLabel, FormSwitch } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@evoapi/design-system/switch";

import { useInstance } from "@/contexts/InstanceContext";

import { getProvider } from "@/lib/queries/token";
import { useFetchWebhook } from "@/lib/queries/webhook/fetchWebhook";
import { useManageWebhook } from "@/lib/queries/webhook/manageWebhook";
import { cn } from "@/lib/utils";

import { Webhook as WebhookType } from "@/types/evolution.types";

const FormSchema = z.object({
  enabled: z.boolean(),
  url: z.string().url("Invalid URL format"),
  events: z.array(z.string()),
  base64: z.boolean(),
  byEvents: z.boolean(),
});

type FormSchemaType = z.infer<typeof FormSchema>;

const GO_EVENTS = ["ALL", "MESSAGE", "SEND_MESSAGE", "READ_RECEIPT", "PRESENCE", "HISTORY_SYNC", "CHAT_PRESENCE", "CALL", "CONNECTION", "QRCODE", "LABEL", "CONTACT", "GROUP", "NEWSLETTER"];

// Eventos reais emitidos pelo zapo-js (lowercase.dot — correspondem exatamente ao que manager.ts envia)
const ZAPO_EVENTS = [
  "call",
  "chats.update",
  "connection.update",
  "groups.update",
  "history.sync",
  "messages.update",
  "messages.upsert",
  "presence.update",
];

const ZAPO_EVENT_META: Record<string, { title: string; description: string }> = {
  "call":              { title: "Chamada Recebida",           description: "Sinalização de chamada de voz ou vídeo recebida (call)" },
  "chats.update":      { title: "Atualização de Conversa",    description: "Estado de digitação, gravação ou pausa em uma conversa (chats.update)" },
  "connection.update": { title: "Atualização de Conexão",     description: "Sessão conectada, desconectada ou em processo de pareamento (connection.update)" },
  "groups.update":     { title: "Atualização de Grupo",       description: "Criação de grupo, alteração de nome, participantes ou configurações (groups.update)" },
  "history.sync":      { title: "Sincronização de Histórico", description: "Chunk de histórico de mensagens recebido durante sincronização inicial (history.sync)" },
  "messages.update":   { title: "Atualização de Mensagem",    description: "Confirmação de entrega ou leitura de mensagens (messages.update)" },
  "messages.upsert":   { title: "Nova Mensagem",              description: "Mensagem recebida ou enviada, incluindo reações e votos em enquetes (messages.upsert)" },
  "presence.update":   { title: "Presença do Contato",        description: "Disponibilidade ou horário do último acesso de um contato (presence.update)" },
};

function Webhook() {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const [loading, setLoading] = useState(false);
  const isGo = getProvider() === "go";

  const { createWebhook } = useManageWebhook();
  const { data: webhook } = useFetchWebhook({
    instanceName: instance?.name,
    token: instance?.token,
  });

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      enabled: false,
      url: "",
      events: [],
      base64: false,
      byEvents: false,
    },
  });

  useEffect(() => {
    if (webhook) {
      form.reset({
        enabled: webhook.enabled,
        url: webhook.url,
        events: webhook.events,
        base64: webhook.webhookBase64,
        byEvents: webhook.webhookByEvents,
      });
    }
  }, [webhook]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormSchemaType) => {
    if (!instance) return;
    setLoading(true);
    try {
      const webhookData: WebhookType = {
        enabled: data.enabled,
        url: data.url,
        events: data.events,
        base64: data.base64,
        byEvents: data.byEvents,
      };

      await createWebhook({
        instanceName: instance.name,
        token: instance.token,
        data: webhookData,
      });
      toast.success(t("webhook.toast.success"));
    } catch (error: any) {
      console.error(t("webhook.toast.error"), error);
      toast.error(`Error: ${error?.response?.data?.response?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const events = isGo ? GO_EVENTS : ZAPO_EVENTS;

  const handleSelectAll = () => {
    form.setValue("events", events);
  };

  const handleDeselectAll = () => {
    form.setValue("events", []);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          <div>
            <h3 className="mb-1 text-lg font-medium">{t("webhook.title")}</h3>
            <Separator className="my-4" />
            <div className="mx-4 space-y-2 divide-y [&>*]:p-4">
              {!isGo && <FormSwitch name="enabled" label={t("webhook.form.enabled.label")} className="w-full justify-between" helper={t("webhook.form.enabled.description")} />}
              <FormInput name="url" label="URL">
                <Input />
              </FormInput>
              {!isGo && <FormSwitch name="byEvents" label={t("webhook.form.byEvents.label")} className="w-full justify-between" helper={t("webhook.form.byEvents.description")} />}
              {!isGo && <FormSwitch name="base64" label={t("webhook.form.base64.label")} className="w-full justify-between" helper={t("webhook.form.base64.description")} />}
              <div className="mb-4 flex justify-between">
                <Button variant="outline" type="button" onClick={handleSelectAll}>
                  {t("button.markAll")}
                </Button>
                <Button variant="outline" type="button" onClick={handleDeselectAll}>
                  {t("button.unMarkAll")}
                </Button>
              </div>
              <FormField
                control={form.control}
                name="events"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="my-2 text-lg">{t("webhook.form.events.label")}</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-2 space-y-1 divide-y">
                        {events
                          .sort((a, b) => a.localeCompare(b))
                          .map((event) => {
                            const meta = ZAPO_EVENT_META[event];
                            const active = field.value.includes(event);
                            return (
                              <div key={event} className="flex items-center justify-between gap-3 pt-3">
                                <div className="flex flex-col gap-0.5">
                                  <FormLabel className={cn(active ? "text-foreground" : "text-muted-foreground")}>
                                    {meta?.title ?? event}
                                  </FormLabel>
                                  {meta?.description && (
                                    <FormDescription className="text-xs">{meta.description}</FormDescription>
                                  )}
                                </div>
                                <Switch
                                  checked={active}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, event]);
                                    } else {
                                      field.onChange(field.value.filter((e) => e !== event));
                                    }
                                  }}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="mx-4 flex justify-end pt-6">
              <Button type="submit" disabled={loading}>
                {loading ? t("webhook.button.saving") : t("webhook.button.save")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

export { Webhook };
