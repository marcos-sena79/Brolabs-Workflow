import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { safeHtmlToReact } from '../src/utils/safeHtml';

const render = (html: string) => renderToStaticMarkup(React.createElement('div', null, safeHtmlToReact(html)));

describe('safeHtmlToReact', () => {
  it('mantém a formatação permitida do Word', () => {
    expect(render('<h1>Título</h1><p>Um <strong>forte</strong> e <em>leve</em></p><ul><li>a</li></ul>')).toBe(
      '<div><h1>Título</h1><p>Um <strong>forte</strong> e <em>leve</em></p><ul><li>a</li></ul></div>',
    );
  });

  it('preserva tabelas com colspan', () => {
    expect(render('<table><tr><td colspan="2">x</td></tr></table>')).toBe(
      '<div><table><tr><td colSpan="2">x</td></tr></table></div>',
    );
  });

  it('remove scripts, handlers, estilos e URLs perigosas', () => {
    const out = render(
      '<p onclick="alert(1)" style="color:red">ok</p><script>alert(1)</script><iframe src="https://x"></iframe>' +
        '<a href="javascript:alert(1)">link</a><img src="https://evil/x.png" onerror="alert(1)"><img src="data:image/png;base64,AAAA">',
    );
    expect(out).toBe('<div><p>ok</p>link<img src="data:image/png;base64,AAAA" alt=""/></div>');
  });

  it('links seguros abrem em nova aba sem opener', () => {
    expect(render('<a href="https://ex.com">x</a>')).toBe(
      '<div><a href="https://ex.com" target="_blank" rel="noopener noreferrer">x</a></div>',
    );
  });
});
