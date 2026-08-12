import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@evoapi/design-system/button';
import { Separator } from '@evoapi/design-system/separator';
import { Form, FormInput } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useInstance } from '@/contexts/InstanceContext';
import { useGetFieldsMap } from '@/lib/queries/instance/findFieldsMap';
import { useGetLeadRaw } from '@/lib/queries/chat/findLead';
import { useUpdateLead } from '@/lib/queries/chat/manageLead';

interface ContactLeadProps {
  remoteJid: string;
}

/**
 * Ficha lateral do contato — campos de CRM dinâmicos conforme o mapa da instância.
 * Usa useGetLeadRaw (valores por slotKey) para edição, não a versão resolvida por
 * label (essa é só leitura/exibição, e labels podem colidir entre slots).
 * O toggle de exibir/recolher fica no header do chat (Messages), não aqui.
 */
export function ContactLead({ remoteJid }: ContactLeadProps) {
  const { t } = useTranslation();
  const { instance } = useInstance();

  const { data: fieldsMap, isLoading: isLoadingFields } = useGetFieldsMap(instance?.name);
  const { data: leadData, isLoading: isLoadingLead } = useGetLeadRaw(instance ?? undefined, remoteJid);
  const updateLead = useUpdateLead();

  const form = useForm<Record<string, string>>({
    defaultValues: {},
  });

  useEffect(() => {
    if (leadData) {
      form.reset(leadData as Record<string, string>);
    }
  }, [leadData, form]);

  const onSubmit = async (values: Record<string, string>) => {
    if (!instance?.name || !remoteJid) return;

    await updateLead.mutateAsync({
      instanceName: instance.name,
      remoteJid,
      fields: values,
      actor: { type: 'human', id: 'painel' },
    });
  };

  if (isLoadingFields || isLoadingLead) {
    return (
      <div className="flex h-full flex-col border-l bg-background p-4">
        <h3 className="mb-2 font-semibold">{t('chat.contactInfo')}</h3>
        <LoadingSpinner />
      </div>
    );
  }

  if (!fieldsMap?.fields?.length) {
    return (
      <div className="flex h-full flex-col border-l bg-background p-4">
        <h3 className="mb-2 font-semibold">{t('chat.contactInfo')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('instance.settings.fieldsMapDescription')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l bg-background p-4">
      <h3 className="mb-2 font-semibold">{t('chat.contactInfo')}</h3>
      <Separator className="mb-4" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto pr-2">
          {fieldsMap.fields.map((field) => (
            <FormInput key={field.slotKey} name={field.slotKey} label={field.label}>
              <Input
                type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
              />
            </FormInput>
          ))}

          <Button type="submit" className="mt-4 w-full" disabled={updateLead.isPending}>
            {t('chat.save')}
          </Button>
        </form>
      </Form>
    </div>
  );
}
