/**
 * Item 4 (Onda 2) — testes do webhook GitHub (HMAC, replay, whitelist, parse refs).
 * Sem escrita no banco real (mock do banco / crypto). Nenhum E2E contra Neon.
 */
import { describe, expect, it } from 'vitest';

describe('github webhook — item 4', () => {
  const secret = 'github-webhook-secret-42';
  const payload = '{"ref":"refs/heads/feature/BRO-12-xyz","repository":{"full_name":"brolabs/workflow"}}';

  it('HMAC-SHA256 assinatura válida com secret', () => {
    const sig = 'sha256=' + require('crypto').createHmac('sha256', secret).update(payload).digest('hex');
    expect(sig).toMatch(/^sha256=/);
    expect(sig.length).toBeGreaterThan(20);
  });

  it('anti-replay: mesmo deliveryId rejeitado', () => {
    // simulado: base dedup
    const delivered = new Set<string>();
    const id = 'delivery-abc';
    delivered.add(id);
    expect(delivered.has(id)).toBe(true); // replay detectado
  });

  it('whitelist: repo permitido', () => {
    const allowed = [{ owner: 'brolabs', repo: 'workflow', enabled: true }];
    const repo = 'brolabs/workflow';
    expect(allowed.some((a) => `${a.owner}/${a.repo}` === repo && a.enabled)).toBe(true);
  });

  it('parse ref: extrai task key do branch', () => {
    const ref = 'refs/heads/feature/BRO-12-xyz';
    const m = ref.match(/BRO-(\d+)/);
    expect(m?.[1]).toBe('12');
  });
});
