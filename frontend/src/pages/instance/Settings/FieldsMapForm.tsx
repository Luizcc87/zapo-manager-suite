import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@evoapi/design-system/button';
import { Form, FormInput, FormSelect } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@evoapi/design-system/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useInstance } from '@/contexts/InstanceContext';
import { useGetFieldsMap } from '@/lib/queries/instance/findFieldsMap';
import { useUpdateFieldsMap } from '@/lib/queries/instance/manageFieldsMap';

export function FieldsMapForm() {
  const { t } = useTranslation();
  const { instance } = useInstance();

  const { data, isLoading } = useGetFieldsMap(instance?.name);
  const { mutateAsync: updateFieldsMap, isPending } = useUpdateFieldsMap();

  const form = useForm({
    defaultValues: {
      fields: [] as { slotKey: string; label: string; fieldType: 'text' | 'number' | 'date' | 'select' }[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'fields',
  });

  useEffect(() => {
    if (data?.fields) {
      form.reset({ fields: data.fields });
    }
  }, [data, form]);

  const onSubmit = async (values: any) => {
    if (!instance?.name) return;
    await updateFieldsMap({
      instanceName: instance.name,
      fields: values.fields,
    });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="mt-8">
      <h3 className="mb-1 text-lg font-medium">{t('instance.settings.fieldsMap')}</h3>
      <p className="text-sm text-muted-foreground">{t('instance.settings.fieldsMapDescription')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('instance.settings.slotKeyHint')}</p>
      <Separator className="my-4" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mx-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-4 items-start">
              <div className="flex-1">
                <FormInput name={`fields.${index}.slotKey`}>
                  <Input placeholder={t('instance.settings.slotKey')} />
                </FormInput>
              </div>
              <div className="flex-1">
                <FormInput name={`fields.${index}.label`}>
                  <Input placeholder={t('instance.settings.label')} />
                </FormInput>
              </div>
              <div className="w-40">
                <FormSelect
                  name={`fields.${index}.fieldType`}
                  placeholder={t('instance.settings.fieldType')}
                  options={[
                    { label: 'Text', value: 'text' },
                    { label: 'Number', value: 'number' },
                    { label: 'Date', value: 'date' },
                    { label: 'Select', value: 'select' },
                  ]}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="w-full mt-2"
            onClick={() => append({ slotKey: '', label: '', fieldType: 'text' })}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('instance.settings.addField')}
          </Button>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? t('settings.button.saving') : t('settings.button.save')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
