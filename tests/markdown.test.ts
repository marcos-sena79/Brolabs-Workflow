import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView, splitTableRow } from '../src/utils/markdown';

const html = (src: string) => renderToStaticMarkup(MarkdownView({ source: src }) as any).replace(/ class="[^"]*"/g, '');

describe('markdown: tabelas', () => {
  it('divide células respeitando \\|', () => {
    expect(splitTableRow('| a | b \\| c |  |')).toEqual(['a', 'b | c', '']);
  });

  it('renderiza tabela GFM com cabeçalho, alinhamento e formatação nas células', () => {
    const out = html('Intro\n| Campo | Obrig. |\n| --- | :---: |\n| **Nome** | [doc](https://a.com) |\n| a \\| b |\n\nFim');
    expect(out).toContain('<p>Intro</p>');
    expect(out).toContain('<thead><tr><th>Campo</th><th>Obrig.</th></tr></thead>');
    expect(out).toContain('<td><strong>Nome</strong></td>');
    expect(out).toContain('<a href="https://a.com" target="_blank" rel="noopener noreferrer">doc</a>');
    expect(out).toContain('<tr><td>a | b</td><td></td></tr>');
    expect(out).toContain('<p>Fim</p>');
  });

  it('alinha a coluna conforme a linha separadora', () => {
    const out = renderToStaticMarkup(MarkdownView({ source: '| A | B |\n| ---: | :---: |\n| 1 | 2 |' }) as any);
    expect(out).toContain('text-right');
    expect(out).toContain('text-center');
  });

  it('não confunde linha horizontal com tabela', () => {
    const out = html('texto a | b\n---\nfim');
    expect(out).not.toContain('<table');
    expect(out).toContain('<hr/>');
  });
});
