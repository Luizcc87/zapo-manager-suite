import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOtpRegistrationError } from '../config/otpErrors';

test('classifyOtpRegistrationError detects blocked OTP responses', () => {
  const error = classifyOtpRegistrationError(
    '{"custom_block_screen":{"title":"Login not available right now"},"login":"555596773757","reason":"blocked","status":"fail"}',
  );

  assert.equal(error.statusCode, 423);
  assert.equal(error.code, 'otp_blocked');
  assert.match(error.message, /bloqueado/i);
});

test('classifyOtpRegistrationError keeps generic OTP failures as 500', () => {
  const error = classifyOtpRegistrationError('{"status":"fail","reason":"temporary"}');

  assert.equal(error.statusCode, 500);
  assert.equal(error.code, 'otp_registration_failed');
  assert.match(error.message, /Falha ao solicitar código de registro/);
});
