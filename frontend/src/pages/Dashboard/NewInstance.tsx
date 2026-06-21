import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Button } from "@evoapi/design-system/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput, FormSelect, FormSwitch } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { getProvider } from "@/lib/queries/token";
import { useManageInstance } from "@/lib/queries/instance/manageInstance";

import { NewInstance as NewInstanceType } from "@/types/evolution.types";

import { GoNewInstance } from "./GoNewInstance";

const stringOrUndefined = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const FormSchema = z.object({
  name: z.string(),
  token: stringOrUndefined,
  number: stringOrUndefined,
  businessId: stringOrUndefined,
  integration: z.enum(["WHATSAPP-BUSINESS", "WHATSAPP-BAILEYS", "EVOLUTION"]),
  mobileTransport: z.boolean().default(false),
  proxyEnabled: z.boolean().default(true),
  proxyProtocol: z.string().default("http"),
  proxyHost: z.string().optional(),
  proxyPort: z.string().optional(),
  proxyUsername: z.string().optional(),
  proxyPassword: z.string().optional(),
});

const PROTOCOL_OPTIONS = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks4", label: "SOCKS4" },
  { value: "socks5", label: "SOCKS5" },
];

function NewInstance({ resetTable, open, onOpenChange }: { resetTable: () => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { createInstance } = useManageInstance();
  const setOpen = onOpenChange;
  const [proxyOpen, setProxyOpen] = useState(false);

  const options = [
    { value: "WHATSAPP-BAILEYS", label: t("instance.form.integration.baileys") },
    { value: "WHATSAPP-BUSINESS", label: t("instance.form.integration.whatsapp") },
    { value: "EVOLUTION", label: t("instance.form.integration.evolution") },
  ];

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      integration: "WHATSAPP-BAILEYS",
      token: uuidv4().replace("-", "").toUpperCase(),
      number: "",
      businessId: "",
      mobileTransport: false,
      proxyEnabled: true,
      proxyProtocol: "http",
      proxyHost: "",
      proxyPort: "",
      proxyUsername: "",
      proxyPassword: "",
    },
  });

  const integrationSelected = form.watch("integration");
  const proxyHost = form.watch("proxyHost");

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    try {
      const proxy = proxyOpen && data.proxyHost && data.proxyPort
        ? {
            enabled: data.proxyEnabled,
            protocol: data.proxyProtocol,
            host: data.proxyHost,
            port: data.proxyPort,
            username: data.proxyUsername || "",
            password: data.proxyPassword || "",
          }
        : undefined;

      const instanceData: NewInstanceType & { mobileTransport?: boolean; proxy?: typeof proxy } = {
        instanceName: data.name,
        integration: data.integration,
        token: data.token === "" ? null : data.token,
        number: data.number === "" ? null : data.number,
        businessId: data.businessId === "" ? null : data.businessId,
        mobileTransport: data.mobileTransport,
        ...(proxy && { proxy }),
      };

      await createInstance(instanceData);

      toast.success(t("toast.instance.created"));
      setOpen(false);
      onReset();
      resetTable();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(`Error : ${error?.response?.data?.response?.message}`);
    }
  };

  const onReset = () => {
    setProxyOpen(false);
    form.reset({
      name: "",
      integration: "WHATSAPP-BAILEYS",
      token: uuidv4().replace("-", "").toLocaleUpperCase(),
      number: "",
      businessId: "",
      mobileTransport: false,
      proxyEnabled: true,
      proxyProtocol: "http",
      proxyHost: "",
      proxyPort: "",
      proxyUsername: "",
      proxyPassword: "",
    });
  };

  if (getProvider() === "go") {
    return <GoNewInstance resetTable={resetTable} open={open} onOpenChange={onOpenChange} />;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[650px]" onCloseAutoFocus={onReset}>
        <DialogHeader>
          <DialogTitle>{t("instance.modal.title")}</DialogTitle>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormInput required name="name" label={t("instance.form.name")}>
              <Input />
            </FormInput>
            <FormSelect name="integration" label={t("instance.form.integration.label")} options={options} />
            <FormInput required name="token" label={t("instance.form.token")}>
              <Input />
            </FormInput>
            <FormInput name="number" label={t("instance.form.number")}>
              <Input type="tel" />
            </FormInput>
            {integrationSelected === "WHATSAPP-BAILEYS" && (
              <div className="flex p-2 items-center justify-between rounded-md border border-sidebar-border bg-sidebar/30">
                <FormSwitch
                  name="mobileTransport"
                  label={t("instance.form.mobileTransport.label", { defaultValue: "Conexão tipo Mobile (Zapo Mobile)" })}
                  helper={t("instance.form.mobileTransport.description", { defaultValue: "Simula um dispositivo Android nativo TCP. Recomendado para maior estabilidade e evitar banimentos." })}
                  className="w-full justify-between"
                />
              </div>
            )}
            {integrationSelected === "WHATSAPP-BUSINESS" && (
              <FormInput required name="businessId" label={t("instance.form.businessId")}>
                <Input />
              </FormInput>
            )}

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
                  <div className="flex p-2 items-center justify-between rounded-md border border-sidebar-border bg-sidebar/30">
                    <FormSwitch
                      name="proxyEnabled"
                      label={t("proxy.form.enabled.label", { defaultValue: "Ativo" })}
                      className="w-full justify-between"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <FormSelect
                        name="proxyProtocol"
                        label={t("proxy.form.protocol.label", { defaultValue: "Protocolo" })}
                        options={PROTOCOL_OPTIONS}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormInput name="proxyHost" label={t("proxy.form.host.label", { defaultValue: "Host" })}>
                        <Input placeholder="proxy.exemplo.com" />
                      </FormInput>
                    </div>
                  </div>
                  <FormInput name="proxyPort" label={t("proxy.form.port.label", { defaultValue: "Porta" })}>
                    <Input placeholder="8080" />
                  </FormInput>
                  <FormInput name="proxyUsername" label={t("proxy.form.username.label", { defaultValue: "Usuário" })}>
                    <Input />
                  </FormInput>
                  <FormInput name="proxyPassword" label={t("proxy.form.password.label", { defaultValue: "Senha" })}>
                    <Input type="password" />
                  </FormInput>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="submit">{t("instance.button.save")}</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

export { NewInstance };
