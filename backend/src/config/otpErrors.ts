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

export const classifyOtpRegistrationError = (err: unknown): OtpErrorClassification => {
  const fallbackMessage = err instanceof Error ? err.message : String(err);
  const raw = fallbackMessage.trim();
  const parsed = raw.startsWith('{') ? safeJsonParse(raw) : null;
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
