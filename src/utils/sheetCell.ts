/** Texto da célula no padrão pt-BR (datas do Excel são gravadas em UTC). */
export const formatCellValue = (v: unknown): string => {
  if (v == null) return '';
  if (v instanceof Date) {
    const hasTime = v.getUTCHours() || v.getUTCMinutes() || v.getUTCSeconds();
    return v.toLocaleString('pt-BR', {
      timeZone: 'UTC',
      dateStyle: 'short',
      ...(hasTime ? { timeStyle: 'short' as const } : {}),
    });
  }
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 10 });
  if (typeof v === 'boolean') return v ? 'VERDADEIRO' : 'FALSO';
  if (typeof v === 'object') {
    const o = v as Record<string, any>;
    if ('result' in o || 'formula' in o || 'sharedFormula' in o) return formatCellValue(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text).join('');
    if ('text' in o) return String(o.text ?? ''); // hyperlink
    if ('error' in o) return String(o.error);
  }
  return String(v);
};

export const cellText = (cell: any): string => {
  try {
    return formatCellValue(cell.value);
  } catch {
    return '';
  }
};
