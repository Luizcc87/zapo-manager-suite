export type OtpErrorClassification = {
  statusCode: number;
  code: string;
  message: string;
  details?: string;
};

const safeJsonParse = (value: string): any | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const stringifyError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export const classifyOtpRegistrationError = (err: unknown): OtpErrorClassification => {
  const fallbackMessage = stringifyError(err);
  const raw = fallbackMessage.trim();
  const parsed = typeof err === 'object' && err !== null && !(err instanceof Error)
    ? err as any
    : raw.startsWith('{')
      ? safeJsonParse(raw)
      : null;
  const reason = typeof parsed?.reason === 'string' ? parsed.reason : '';
  const status = typeof parsed?.status === 'string' ? parsed.status : '';

  if (reason === 'blocked' || status === 'fail' && raw.includes('"custom_block_screen"')) {
    return {
      statusCode: 423,
      code: 'otp_blocked',
      message: 'Login bloqueado pelo WhatsApp para esta conta/telefone.',
      details: raw,
    };
  }

  return {
    statusCode: 500,
    code: 'otp_registration_failed',
    message: 'Falha ao solicitar código de registro.',
    details: raw,
  };
};
