/**
 * Parser CSV simples (RFC 4180): aspas, aspas escapadas ("") e quebras de linha
 * dentro de campos. Detecta o separador (`,` ou `;` — comum no Excel em pt-BR)
 * pela primeira linha.
 */
export const detectDelimiter = (text: string): ',' | ';' | '\t' => {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const candidates: Array<',' | ';' | '\t'> = [';', ',', '\t'];
  return candidates.reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',' as ',' | ';' | '\t');
};

export const parseCsv = (input: string, maxRows = Infinity): string[][] => {
  const text = (input || '').replace(/^﻿/, '');
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (rows.length >= maxRows) return rows;
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};
