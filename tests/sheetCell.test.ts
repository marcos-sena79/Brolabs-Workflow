import { describe, expect, it } from 'vitest';
import { cellText, formatCellValue } from '../src/utils/sheetCell';

describe('formatCellValue (planilhas no visualizador)', () => {
  it('formata números, datas e booleanos em pt-BR', () => {
    expect(formatCellValue(3.5)).toBe('3,5');
    expect(formatCellValue(1234567.25)).toBe('1.234.567,25');
    expect(formatCellValue(new Date(Date.UTC(2026, 10, 20)))).toBe('20/11/2026');
    expect(formatCellValue(new Date(Date.UTC(2026, 10, 20, 14, 30)))).toBe('20/11/2026, 14:30');
    expect(formatCellValue(true)).toBe('VERDADEIRO');
  });

  it('usa o resultado de fórmulas, rich text e hyperlinks', () => {
    expect(formatCellValue({ formula: 'B1*2', result: 7 })).toBe('7');
    expect(formatCellValue({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab');
    expect(formatCellValue({ text: 'site', hyperlink: 'https://a.com' })).toBe('site');
    expect(formatCellValue(null)).toBe('');
  });

  it('não quebra com célula inválida', () => {
    expect(cellText({ get value() { throw new Error('x'); } })).toBe('');
  });
});
