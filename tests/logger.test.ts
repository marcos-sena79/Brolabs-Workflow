import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../src/server/logger';

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function parsed(spy: { mock: { calls: any[][] } }): any {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  return JSON.parse(call[0] as string);
}

describe('logger', () => {
  it('info/warn saem em stdout como JSON com ts/level/msg', () => {
    logger.info('hello', { route: '/api/x', status: 200 });
    const line = parsed(logSpy);
    expect(line.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(line.level).toBe('info');
    expect(line.msg).toBe('hello');
    expect(line.route).toBe('/api/x');
    expect(line.status).toBe(200);

    logger.warn('careful');
    expect(parsed(logSpy).level).toBe('warn');
  });

  it('error vai para stderr', () => {
    logger.error('boom', { status: 500 });
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const line = parsed(errSpy);
    expect(line.level).toBe('error');
    expect(line.msg).toBe('boom');
    expect(line.status).toBe(500);
  });
});
