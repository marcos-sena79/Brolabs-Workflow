import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv } from '../src/utils/csv';

describe('parseCsv', () => {
  it('lê campos simples com vírgula', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('detecta ponto e vírgula (Excel pt-BR) e lida com CRLF e BOM', () => {
    expect(detectDelimiter('nome;valor\r\nx;1,5')).toBe(';');
    expect(parseCsv('﻿nome;valor\r\nx;1,5\r\n')).toEqual([
      ['nome', 'valor'],
      ['x', '1,5'],
    ]);
  });

  it('respeita aspas, aspas escapadas e quebra de linha dentro do campo', () => {
    expect(parseCsv('id,texto\n1,"olá, ""mundo""\nlinha 2"\n2,fim')).toEqual([
      ['id', 'texto'],
      ['1', 'olá, "mundo"\nlinha 2'],
      ['2', 'fim'],
    ]);
  });

  it('limita o número de linhas', () => {
    expect(parseCsv('a\nb\nc\nd', 2)).toEqual([['a'], ['b']]);
  });
});
