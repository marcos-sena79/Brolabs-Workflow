import { describe, expect, it } from 'vitest';
import {
  BACKOFF_MINUTES,
  MAX_ATTEMPTS,
  nextAttemptDate,
  smtpConfigured,
} from '../src/server/email/sender';

describe('backoff de e-mail', () => {
  it('sequência esperada: 1, 5, 15, 60, 240 minutos com 5 tentativas', () => {
    expect(BACKOFF_MINUTES).toEqual([1, 5, 15, 60, 240]);
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('nextAttemptDate escala por tentativa', () => {
    const now = Date.now();
    const cases: Array<[number, number]> = [
      [0, 1],
      [1, 5],
      [2, 15],
      [3, 60],
      [4, 240],
    ];
    for (const [attempts, minutes] of cases) {
      const diff = nextAttemptDate(attempts).getTime() - now;
      expect(diff).toBeGreaterThanOrEqual(minutes * 60_000 - 5_000);
      expect(diff).toBeLessThanOrEqual(minutes * 60_000 + 5_000);
    }
  });

  it('clamp: acima do último índice usa 240min; negativo usa 1min', () => {
    const now = Date.now();
    expect(nextAttemptDate(99).getTime() - now).toBeGreaterThan(239 * 60_000);
    expect(nextAttemptDate(-5).getTime() - now).toBeLessThan(2 * 60_000);
  });
});

describe('smtpConfigured', () => {
  it('false sem credenciais e true com HOST+USER+PASS', () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    expect(smtpConfigured()).toBe(false);
    process.env.SMTP_HOST = 'smtp.example';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';
    expect(smtpConfigured()).toBe(true);
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });
});
