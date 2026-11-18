import React from 'react';
import { HNode, parseHtml } from './htmlToMarkdown';

/**
 * Converte HTML não confiável (ex.: saída do mammoth para .docx) em elementos React
 * usando uma lista fechada de tags e atributos. Nunca usa innerHTML: scripts,
 * estilos, handlers `on*`, iframes e URLs `javascript:` são descartados por construção.
 */

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub',
  'br', 'hr', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'a', 'img', 'blockquote', 'pre', 'code', 'span', 'div',
]);

/** Conteúdo destas tags é descartado por inteiro. */
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'head', 'title', 'meta', 'link', 'form', 'svg', 'math']);

const VOID = new Set(['br', 'hr', 'img']);

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
const SAFE_IMG = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i;

const toReact = (n: HNode, key: string): React.ReactNode => {
  if (n.tag === null) return n.text;
  const tag = n.tag;
  if (DROP_TAGS.has(tag)) return null;

  const children = n.children.map((c, i) => toReact(c, `${key}-${i}`));
  if (!ALLOWED_TAGS.has(tag)) return <React.Fragment key={key}>{children}</React.Fragment>;

  const props: Record<string, unknown> = { key };
  if (tag === 'a') {
    const href = (n.attrs.href || '').trim();
    if (!SAFE_HREF.test(href)) return <React.Fragment key={key}>{children}</React.Fragment>;
    props.href = href;
    props.target = '_blank';
    props.rel = 'noopener noreferrer';
  }
  if (tag === 'img') {
    const src = (n.attrs.src || '').trim();
    if (!SAFE_IMG.test(src)) return null;
    props.src = src;
    props.alt = n.attrs.alt || '';
  }
  if (tag === 'td' || tag === 'th') {
    const colSpan = Number(n.attrs.colspan);
    const rowSpan = Number(n.attrs.rowspan);
    if (colSpan > 1 && colSpan <= 100) props.colSpan = colSpan;
    if (rowSpan > 1 && rowSpan <= 1000) props.rowSpan = rowSpan;
  }

  return React.createElement(tag, props, VOID.has(tag) ? undefined : children);
};

export const safeHtmlToReact = (html: string): React.ReactNode[] =>
  parseHtml(html || '').children.map((c, i) => toReact(c, `h${i}`));
