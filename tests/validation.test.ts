import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  noteAiSchema,
  resetDatabaseSchema,
  shareCreateSchema,
  tagCreateSchema,
  tagUpdateSchema,
  todoCreateSchema,
} from '../src/server/validation';

describe('loginSchema', () => {
  it('aceita email válido', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
  it('rejeita email inválido', () => {
    expect(loginSchema.safeParse({ email: 'nao-e-email', password: 'x' }).success).toBe(false);
  });
  it('rejeita senha vazia', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('resetDatabaseSchema', () => {
  it('exige confirmação literal RESET', () => {
    expect(resetDatabaseSchema.safeParse({ confirm: 'RESET' }).success).toBe(true);
    expect(resetDatabaseSchema.safeParse({ confirm: 'reset' }).success).toBe(false);
    expect(resetDatabaseSchema.safeParse({}).success).toBe(false);
  });
});

describe('tagCreateSchema', () => {
  it('normaliza espaços do nome', () => {
    expect(tagCreateSchema.parse({ name: '  backend  ' }).name).toBe('backend');
  });
  it('rejeita nome vazio após trim', () => {
    expect(tagCreateSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
  it('rejeita nome acima de 60 caracteres', () => {
    expect(tagCreateSchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
  });
  it('aceita cor #RRGGBB e rejeita fora do padrão', () => {
    expect(tagCreateSchema.safeParse({ name: 'a', color: '#AABBCC' }).success).toBe(true);
    expect(tagCreateSchema.safeParse({ name: 'a', color: 'red' }).success).toBe(false);
    expect(tagCreateSchema.safeParse({ name: 'a', color: '#abc' }).success).toBe(false);
  });
});

describe('tagUpdateSchema', () => {
  it('rejeita objeto vazio', () => {
    expect(tagUpdateSchema.safeParse({}).success).toBe(false);
  });
  it('aceita apenas color', () => {
    expect(tagUpdateSchema.safeParse({ color: '#123456' }).success).toBe(true);
  });
});

describe('shareCreateSchema', () => {
  it('aceita expiresInDays entre 1 e 365', () => {
    for (const expiresInDays of [1, 90, 365]) {
      expect(shareCreateSchema.safeParse({ expiresInDays }).success).toBe(true);
    }
  });
  it('rejeita fora dos limites ou não inteiro', () => {
    for (const expiresInDays of [0, 366, 1.5]) {
      expect(shareCreateSchema.safeParse({ expiresInDays }).success).toBe(false);
    }
  });
});

describe('todoCreateSchema', () => {
  it('aceita dueDate ISO YYYY-MM-DD', () => {
    expect(todoCreateSchema.safeParse({ title: 't', dueDate: '2026-10-23' }).success).toBe(true);
  });
  it('rejeita data malformada', () => {
    expect(todoCreateSchema.safeParse({ title: 't', dueDate: '23/10/2026' }).success).toBe(false);
  });
  it('rejeita data fora do intervalo ±2 anos', () => {
    expect(todoCreateSchema.safeParse({ title: 't', dueDate: '1999-01-01' }).success).toBe(false);
  });
});

describe('noteAiSchema', () => {
  it('só aceita as ações conhecidas', () => {
    expect(noteAiSchema.safeParse({ action: 'summarize' }).success).toBe(true);
    expect(noteAiSchema.safeParse({ action: 'action_items' }).success).toBe(true);
    expect(noteAiSchema.safeParse({ action: 'translate' }).success).toBe(false);
  });
});
