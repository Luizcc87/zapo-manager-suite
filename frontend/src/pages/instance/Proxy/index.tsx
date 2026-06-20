/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { Clock, Globe, RefreshCw, Server, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { z } from "zod";

import { Badge } from "@evoapi/design-system/badge";
import { Button } from "@evoapi/design-system/button";
import { Form, FormInput, FormSwitch } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useInstance } from "@/contexts/InstanceContext";

import { getProvider } from "@/lib/queries/token";
import { useFetchProxy } from "@/lib/queries/proxy/fetchProxy";
import { useManageProxy } from "@/lib/queries/proxy/manageProxy";
import { useFetchProxyStatus, ProxyStatusResponse } from "@/lib/queries/proxy/fetchProxyStatus";

import { Proxy as ProxyType } from "@/types/evolution.types";

const formSchema = z.object({
  enabled: z.boolean(),
  host: z.string(),
  port: z.string(),
  protocol: z.string(),
  username: z.string(),
  password: z.string(),
});

type FormSchemaType = z.infer<typeof formSchema>;

function ProxyStatusPanel({ instanceName }: { instanceName: string }) {
  const { t } = useTranslation();
  const { data: status, isFetching, refetch } = useFetchProxyStatus({ instanceName });

  if (!status?.enabled) return null;

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple-500" />
          {t("proxy.status.title")}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-2 text-sm">
        <StatusRow label={t("proxy.status.connection")}>
          {(status as ProxyStatusResponse).connected ? (
            <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
              {t("proxy.status.connected")}
            </Badge>
          ) : (
            <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">
              {t("proxy.status.failed")}
            </Badge>
          )}
        </StatusRow>

        {status.externalIp && (
          <StatusRow icon={<Globe className="h-3 w-3" />} label={t("proxy.status.ip")}>
            <span className="font-mono text-xs">{status.externalIp}</span>
          </StatusRow>
        )}

        {status.latencyMs !== undefined && (
          <StatusRow icon={<Clock className="h-3 w-3" />} label={t("proxy.status.latency")}>
            <span className="font-mono text-xs">{status.latencyMs}ms</span>
          </StatusRow>
        )}

        {status.proxyUrl && (
          <StatusRow icon={<Server className="h-3 w-3" />} label={t("proxy.status.server")}>
            <span className="font-mono text-xs truncate max-w-48">{status.proxyUrl}</span>
          </StatusRow>
        )}

        {status.error && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500 break-all">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function Proxy() {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const [loading, setLoading] = useState(false);
  const isGo = getProvider() === "go";

  const { createProxy } = useManageProxy();
  const { data: proxy } = useFetchProxy({
    instanceName: instance?.name,
  });

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: false,
      host: "",
      port: "",
      protocol: "http",
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (proxy) {
      form.reset({
        enabled: proxy.enabled,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        username: proxy.username,
        password: proxy.password,
      });
    }
  }, [proxy]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormSchemaType) => {
    if (!instance) return;

    setLoading(true);
    try {
      const proxyData: ProxyType = {
        enabled: data.enabled,
        host: data.host,
        port: data.port,
        protocol: data.protocol,
        username: data.username,
        password: data.password,
      };

      await createProxy({
        instanceName: instance.name,
        token: instance.token,
        data: proxyData,
      });
      toast.success(t("proxy.toast.success"));
    } catch (error: any) {
      console.error(t("proxy.toast.error"), error);
      toast.error(`Error : ${error?.response?.data?.response?.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          <div>
            <h3 className="mb-1 text-lg font-medium">{t("proxy.title")}</h3>
            <Separator className="my-4" />
            <div className="mx-4 space-y-4">
              {instance?.name && <ProxyStatusPanel instanceName={instance.name} />}

              <div className="space-y-2 divide-y [&>*]:p-4">
                {!isGo && (
                  <FormSwitch
                    name="enabled"
                    label={t("proxy.form.enabled.label")}
                    className="w-full justify-between"
                    helper={t("proxy.form.enabled.description")}
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr_10rem] md:gap-8">
                  <FormInput name="protocol" label={t("proxy.form.protocol.label")}>
                    <Input />
                  </FormInput>
                  <FormInput name="host" label={t("proxy.form.host.label")}>
                    <Input />
                  </FormInput>
                  <FormInput name="port" label={t("proxy.form.port.label")}>
                    <Input type="number" />
                  </FormInput>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:gap-8">
                  <FormInput name="username" label={t("proxy.form.username.label")}>
                    <Input />
                  </FormInput>
                  <FormInput name="password" label={t("proxy.form.password.label")}>
                    <Input type="password" />
                  </FormInput>
                </div>
                <div className="flex justify-end px-4 pt-6">
                  <Button type="submit" disabled={loading}>
                    {loading ? t("proxy.button.saving") : t("proxy.button.save")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

export { Proxy };
