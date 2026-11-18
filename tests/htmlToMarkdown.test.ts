import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/utils/htmlToMarkdown';

describe('htmlToMarkdown', () => {
  it('converte negrito, itálico, tachado e links', () => {
    const html = '<p>Texto <b>forte</b>, <i>leve</i>, <s>velho</s> e <a href="https://ex.com">site</a>.</p>';
    expect(htmlToMarkdown(html)).toBe('Texto **forte**, *leve*, ~~velho~~ e [site](https://ex.com).');
  });

  it('não duplica marcadores em formatação aninhada e ignora links inseguros', () => {
    const html = '<p><strong>a <span style="font-weight:700">b</span> <em>c</em></strong> <a href="javascript:alert(1)">x</a></p>';
    expect(htmlToMarkdown(html)).toBe('**a b *c*** x');
  });

  it('converte títulos e parágrafos separados', () => {
    const html = '<h1>Título</h1><h2>Sub</h2><p>um</p><p>dois<br>linha</p>';
    expect(htmlToMarkdown(html)).toBe('# Título\n\n## Sub\n\num\n\ndois\nlinha');
  });

  it('converte listas HTML (Google Docs / web)', () => {
    const html =
      '<ul><li><p>item 1</p></li><li>item 2<ul><li>filho</li></ul></li></ul><ol><li>um</li><li>dois</li></ol>';
    expect(htmlToMarkdown(html)).toBe('- item 1\n- item 2\n  - filho\n\n1. um\n2. dois');
  });

  it('respeita font-weight:normal do wrapper do Google Docs', () => {
    const html =
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700;">Forte</span><span style="font-style:italic;"> itálico</span></p></b>';
    expect(htmlToMarkdown(html)).toBe('**Forte** *itálico*');
  });

  it('converte listas do Word (mso-list) e limpa o lixo do Word', () => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head>
<body lang=PT-BR>
<!--StartFragment-->
<p class=MsoNormal><b><span style='font-size:12.0pt'>Critérios de aceite</span></b><o:p></o:p></p>
<p class=MsoListParagraphCxSpFirst style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span
style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;
</span></span></span><![endif]>Usuário pode <i>salvar</i><o:p></o:p></p>
<p class=MsoListParagraphCxSpLast style='text-indent:-18.0pt;mso-list:l0 level2 lfo1'><![if !supportLists]><span
style='font-family:"Courier New"'><span style='mso-list:Ignore'>o<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;
</span></span></span><![endif]>Sub-item<o:p></o:p></p>
<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>1.<span>&nbsp;&nbsp;</span></span><![endif]>Primeiro passo</p>
<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><![if !supportLists]><span style='mso-list:Ignore'>2.<span>&nbsp;&nbsp;</span></span><![endif]>Segundo passo</p>
<p class=MsoNormal>Fim&nbsp;do texto</p>
<!--EndFragment-->
</body></html>`;
    expect(htmlToMarkdown(html)).toBe(
      '**Critérios de aceite**\n\n- Usuário pode *salvar*\n  - Sub-item\n1. Primeiro passo\n2. Segundo passo\n\nFim do texto',
    );
  });

  it('converte tabelas em tabela GFM com cabeçalho', () => {
    const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td><b>2</b></td></tr></table>';
    expect(htmlToMarkdown(html)).toBe('| A | B |\n| --- | --- |\n| 1 | **2** |');
  });

  it('converte tabela do Word (negrito no cabeçalho, colspan, rowspan, pipe, alinhamento)', () => {
    const html = `<!--StartFragment-->
<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0>
 <tr>
  <td width=200 style='border:solid windowtext 1.0pt'><p class=MsoNormal><b><span>Campo</span></b><o:p></o:p></p></td>
  <td width=200><p class=MsoNormal><b>Regra</b></p></td>
  <td width=100><p class=MsoNormal align=center style='text-align:center'><b>Obrig.</b></p></td>
 </tr>
 <tr>
  <td rowspan=2><p class=MsoNormal>Nome</p></td>
  <td><p class=MsoNormal>Até 80 chars</p><p class=MsoNormal>sem <i>emoji</i></p></td>
  <td><p class=MsoNormal align=center style='text-align:center'>Sim</p></td>
 </tr>
 <tr>
  <td><p class=MsoNormal>a | b</p></td>
  <td><p class=MsoNormal align=center style='text-align:center'>Não</p></td>
 </tr>
 <tr>
  <td colspan=3><p class=MsoNormal>Observação geral</p></td>
 </tr>
 <tr><td><p class=MsoNormal>&nbsp;</p></td><td></td><td></td></tr>
</table>
<!--EndFragment-->`;
    expect(htmlToMarkdown(html)).toBe(
      [
        '| Campo | Regra | Obrig. |',
        '| --- | --- | :---: |',
        '| Nome | Até 80 chars sem *emoji* | Sim |',
        '|   | a \\| b | Não |',
        '| Observação geral |   |   |',
      ].join('\n'),
    );
  });

  it('tabela de uma coluna vira parágrafos', () => {
    const html = '<table><tr><td><p>Aviso <b>importante</b></p></td></tr><tr><td>Segunda</td></tr></table>';
    expect(htmlToMarkdown(html)).toBe('Aviso **importante**\n\nSegunda');
  });

  it('retorna vazio para HTML sem texto', () => {
    expect(htmlToMarkdown('<p>&nbsp;</p><style>x{}</style>')).toBe('');
  });
});
