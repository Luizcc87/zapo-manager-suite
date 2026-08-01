import { Alert, AlertTitle } from "@evoapi/design-system/alert";
import { Button } from "@evoapi/design-system/button";
import { ShieldAlert } from "lucide-react";

type RegistrationCodeAlert = {
  code: string;
  expiryTimestampMs: number;
};

type TakeoverAlert = {
  newDeviceName?: string;
  newDevicePlatform?: string;
};

type Props = {
  registrationCode: RegistrationCodeAlert | null;
  takeover: TakeoverAlert | null;
  onDismissRegistrationCode: () => void;
  onDismissTakeover: () => void;
};

export function MobileSecurityAlerts({
  registrationCode,
  takeover,
  onDismissRegistrationCode,
  onDismissTakeover,
}: Props) {
  return (
    <>
      {takeover && (
        <Alert variant="destructive" className="w-full flex flex-col gap-2 bg-red-950 border-red-800 text-red-200">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-500 animate-bounce" />
            <div>
              <AlertTitle className="text-base font-bold text-red-400">
                ALERTA CRÍTICO: Tentativa de Takeover Detectada!
              </AlertTitle>
              <p className="text-xs text-red-300">
                Outro dispositivo ({takeover.newDeviceName || "desconhecido"} na plataforma {takeover.newDevicePlatform || "?"}) está tentando assumir o controle do seu número de WhatsApp!
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" className="text-red-200 border-red-700 bg-red-900/55 hover:bg-red-800" onClick={onDismissTakeover}>
              Desconsiderar
            </Button>
          </div>
        </Alert>
      )}

      {registrationCode && (
        <Alert variant="destructive" className="w-full flex flex-col gap-2 bg-amber-950 border-amber-800 text-amber-200">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-500 animate-pulse" />
            <div>
              <AlertTitle className="text-base font-bold text-amber-400">
                Aviso de Segurança: Código de Registro Solicitado
              </AlertTitle>
              <p className="text-xs text-amber-300">
                Um código SMS de registro foi solicitado para o seu número! Código recebido: <span className="font-mono font-bold text-sm bg-amber-900 px-2 py-0.5 rounded">{registrationCode.code}</span>. Expira em {new Date(registrationCode.expiryTimestampMs).toLocaleTimeString()}.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" className="text-amber-200 border-amber-700 bg-amber-900/55 hover:bg-amber-800" onClick={onDismissRegistrationCode}>
              Fechar
            </Button>
          </div>
        </Alert>
      )}
    </>
  );
}
