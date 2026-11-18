/**
 * Converte o HTML da área de transferência (Word, Google Docs, páginas web)
 * para o Markdown suportado por `renderMarkdown` (src/utils/markdown.tsx).
 *
 * Usa um parser próprio e tolerante (sem DOM), para funcionar no navegador e
 * nos testes em Node. Não executa nada do HTML: apenas lê tags, atributos e texto.
 */

interface HNode {
  tag: string | null; // null = nó de texto
  attrs: Record<string, string>;
  children: HNode[];
  text: string;
}

const VOID_TAGS = new Set(['br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'wbr', 'area', 'base', 'source']);
const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'hr', 'dl', 'dt', 'dd', 'figure',
]);

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", bull: '•', middot: '·',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  copy: '©', reg: '®', trade: '™', deg: '°', ordm: 'º', ordf: 'ª', euro: '€',
};

const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });

const parseAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
};

const parseHtml = (html: string): HNode => {
  const root: HNode = { tag: 'root', attrs: {}, children: [], text: '' };
  const stack: HNode[] = [root];
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/\s*([a-zA-Z][\w:.-]*)\s*>|<([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    const tok = m[0];
    if (tok.startsWith('<!')) continue; // comentários, doctype, <![if ...]> do Word
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const idx = stack.map((n) => n.tag).lastIndexOf(tag);
      if (idx > 0) stack.length = idx;
      continue;
    }
    if (m[2]) {
      const tag = m[2].toLowerCase();
      const rawAttrs = m[3] || '';
      const node: HNode = { tag, attrs: parseAttrs(rawAttrs.replace(/\/\s*$/, '')), children: [], text: '' };
      // Fecha implicitamente <p>/<li> quando outro começa
      if ((tag === 'p' || tag === 'li') && top.tag === tag) stack.pop();
      stack[stack.length - 1].children.push(node);
      if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(rawAttrs)) stack.push(node);
      continue;
    }
    top.children.push({ tag: null, attrs: {}, children: [], text: decodeEntities(tok) });
  }
  return root;
};

// ---------------------------------------------------------------------------

interface Fmt {
  bold: boolean;
  italic: boolean;
  strike: boolean;
}

const styleOf = (n: HNode) => (n.attrs.style || '').toLowerCase();
const classOf = (n: HNode) => (n.attrs.class || '').toLowerCase();

const isWordListMarker = (n: HNode) => /mso-list\s*:\s*ignore/.test(styleOf(n));

const wrap = (s: string, marker: string) => {
  const core = s.trim();
  if (!core) return s;
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  return `${lead}${marker}${core}${marker}${trail}`;
};

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

const inline = (n: HNode, fmt: Fmt): string => {
  if (n.tag === null) return n.text.replace(/\s+/g, ' ');
  const tag = n.tag;
  if (tag === 'br') return '\n';
  if (tag === 'img' || tag === 'style' || tag === 'script' || tag === 'head' || tag === 'xml') return '';
  if (isWordListMarker(n)) return '';

  const style = styleOf(n);
  const weight = /font-weight\s*:\s*(\w+)/.exec(style)?.[1];
  const explicitNormal = weight === 'normal' || weight === '400' || weight === '300';
  const wantsBold =
    !explicitNormal && (tag === 'b' || tag === 'strong' || weight === 'bold' || (!!weight && Number(weight) >= 600));
  const wantsItalic = tag === 'i' || tag === 'em' || /font-style\s*:\s*italic/.test(style);
  const wantsStrike = tag === 's' || tag === 'strike' || tag === 'del' || /line-through/.test(style);

  const next: Fmt = {
    bold: fmt.bold || wantsBold,
    italic: fmt.italic || wantsItalic,
    strike: fmt.strike || wantsStrike,
  };

  if (tag === 'code' && !fmt.bold && !fmt.italic) {
    const t = textOf(n).replace(/\s+/g, ' ');
    return t.trim() ? '`' + t.trim() + '`' : t;
  }

  let s = n.children.map((c) => inline(c, next)).join('');
  if (BLOCK_TAGS.has(tag)) s = s + ' ';

  if (wantsStrike && !fmt.strike) s = wrap(s, '~~');
  if (wantsItalic && !fmt.italic) s = wrap(s, '*');
  if (wantsBold && !fmt.bold) s = wrap(s, '**');

  if (tag === 'a') {
    const href = (n.attrs.href || '').trim();
    const label = s.trim();
    if (SAFE_HREF.test(href) && label) {
      return label === href ? href : `[${label}](${href})`;
    }
  }
  return s;
};

const textOf = (n: HNode): string => (n.tag === null ? n.text : n.tag === 'br' ? '\n' : n.children.map(textOf).join(''));

const cleanInline = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

const hasBlockChild = (n: HNode): boolean => n.children.some((c) => c.tag !== null && BLOCK_TAGS.has(c.tag) && c.tag !== 'br');

// ---------------------------------------------------------------------------

interface Block {
  text: string;
  /** Item de lista do Word (um <p> por item): itens consecutivos ficam na mesma lista. */
  list?: boolean;
}

const NO_FMT: Fmt = { bold: false, italic: false, strike: false };

const wordListItem = (p: HNode): string | null => {
  const style = styleOf(p);
  if (!/mso-list/.test(style) && !classOf(p).includes('msolistparagraph')) return null;

  let marker = '';
  const findMarker = (n: HNode): boolean => {
    for (const c of n.children) {
      if (c.tag && isWordListMarker(c)) {
        marker = textOf(c).replace(/[\s ]+/g, ' ').trim();
        return true;
      }
      if (c.tag && findMarker(c)) return true;
    }
    return false;
  };
  findMarker(p);

  const level = Number(/level(\d+)/.exec(style)?.[1] || 1);
  const indent = '  '.repeat(Math.max(0, level - 1));
  const num = /^(\d+)[.)]$/.exec(marker);
  const prefix = num ? `${num[1]}. ` : /^[a-z][.)]$/i.test(marker) || /^[ivx]+[.)]$/i.test(marker) ? '1. ' : '- ';
  const content = cleanInline(inline({ ...p, tag: 'span', attrs: {} }, NO_FMT)).replace(/\n/g, ' ');
  return content ? indent + prefix + content : null;
};

const headingFor = (n: HNode): string | null => {
  const h = /^h([1-6])$/.exec(n.tag || '');
  if (h) return '#'.repeat(Math.min(3, Number(h[1]))) + ' ';
  const cls = classOf(n);
  if (cls.includes('msotitle')) return '# ';
  if (cls.includes('msosubtitle')) return '## ';
  return null;
};

const listBlock = (list: HNode, depth: number, lines: string[]) => {
  let n = 1;
  for (const li of list.children) {
    if (li.tag === 'ul' || li.tag === 'ol') {
      listBlock(li, depth + 1, lines);
      continue;
    }
    if (li.tag !== 'li') continue;
    const own: HNode = { ...li, tag: 'span', children: li.children.filter((c) => c.tag !== 'ul' && c.tag !== 'ol') };
    let content = cleanInline(inline(own, NO_FMT)).replace(/\n/g, ' ');
    let prefix = list.tag === 'ol' ? `${n++}. ` : '- ';
    const check = /^\[( |x|X)\]\s+/.exec(content);
    if (check && list.tag !== 'ol') {
      prefix = `- [${check[1]}] `;
      content = content.slice(check[0].length);
    }
    if (content) lines.push('  '.repeat(depth) + prefix + content);
    for (const c of li.children) if (c.tag === 'ul' || c.tag === 'ol') listBlock(c, depth + 1, lines);
  }
};

const collectBlocks = (node: HNode, out: Block[]) => {
  let buf: HNode[] = [];
  const flush = () => {
    if (!buf.length) return;
    const text = cleanInline(buf.map((c) => inline(c, NO_FMT)).join(''));
    if (text) out.push({ text });
    buf = [];
  };

  for (const c of node.children) {
    const tag = c.tag;
    if (tag === null || !BLOCK_TAGS.has(tag)) {
      if (tag === 'style' || tag === 'script' || tag === 'head' || tag === 'xml' || tag === 'title') continue;
      buf.push(c);
      continue;
    }
    flush();

    if (tag === 'ul' || tag === 'ol') {
      const lines: string[] = [];
      listBlock(c, 0, lines);
      if (lines.length) out.push({ text: lines.join('\n') });
      continue;
    }
    if (tag === 'hr') {
      out.push({ text: '---' });
      continue;
    }
    if (tag === 'pre') {
      const code = textOf(c).replace(/ /g, ' ').replace(/^\n+|\n+$/g, '');
      if (code.trim()) out.push({ text: '```\n' + code + '\n```' });
      continue;
    }
    if (tag === 'blockquote') {
      const inner: Block[] = [];
      collectBlocks(c, inner);
      const text = joinBlocks(inner)
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n');
      if (text) out.push({ text });
      continue;
    }
    if (tag === 'table') {
      const rows: string[] = [];
      const walkRows = (n: HNode) => {
        for (const r of n.children) {
          if (r.tag === 'tr') {
            const cells = r.children
              .filter((cell) => cell.tag === 'td' || cell.tag === 'th')
              .map((cell) => cleanInline(inline({ ...cell, tag: 'span' }, NO_FMT)).replace(/\n/g, ' '));
            if (cells.some(Boolean)) rows.push(cells.join(' | '));
          } else if (r.tag) walkRows(r);
        }
      };
      walkRows(c);
      if (rows.length) out.push({ text: rows.join('\n') });
      continue;
    }

    const wordItem = tag === 'p' || tag === 'div' ? wordListItem(c) : null;
    if (wordItem !== null) {
      out.push({ text: wordItem, list: true });
      continue;
    }

    const heading = headingFor(c);
    if (heading) {
      const text = cleanInline(inline({ ...c, tag: 'span' }, NO_FMT))
        .replace(/\n/g, ' ')
        .replace(/^\*\*(.*)\*\*$/, '$1');
      if (text) out.push({ text: heading + text });
      continue;
    }

    if (hasBlockChild(c)) {
      collectBlocks(c, out);
      continue;
    }

    const text = cleanInline(inline({ ...c, tag: 'span' }, NO_FMT));
    if (text) out.push({ text });
  }
  flush();
};

const joinBlocks = (blocks: Block[]) =>
  blocks.reduce((acc, b, i) => {
    if (i === 0) return b.text;
    const sep = b.list && blocks[i - 1].list ? '\n' : '\n\n';
    return acc + sep + b.text;
  }, '');

export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  let src = html;
  const frag = /<!--\s*StartFragment\s*-->([\s\S]*?)<!--\s*EndFragment\s*-->/i.exec(src);
  if (frag) src = frag[1];
  else {
    const body = /<body[^>]*>([\s\S]*?)(<\/body>|$)/i.exec(src);
    if (body) src = body[1];
  }
  src = src
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<(style|script|head|xml|title)[^>]*>[\s\S]*?<\/\1>/gi, '');

  const blocks: Block[] = [];
  collectBlocks(parseHtml(src), blocks);
  return joinBlocks(blocks)
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
