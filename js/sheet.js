/* Estrutura da folha v4. As células de dados encontram-se pela chave da linha e da coluna. */

import { MESES, daysInMonth, pad, rowKey, tukTitle as titleOf } from './format.js';
import { isOwnerAt } from './model.js';

export const APP_MARK = 'tuk-manager';

const NAVY = '1F4E79';
const RED = 'A61C1C';
const REDL = 'FCE4E4';
const GREEN = '1E6B3A';
const GREENL = 'E6F4EA';
const TOT = 'BDD7EE';
const LIGHT = 'DDEBF7';
const INP = 'FFF9E5';
const GOLD = 'BF9000';
const GOLDL = 'FFF2CC';
const GREY = '808080';
const HDRI = 'FFE699';
const EUR = '#,##0.00 "€"';
const EURN = '#,##0.00 "€";[Red]-#,##0.00 "€"';
const PCT = '0%';

export function colLetter(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Fórmula escrita para a API com separador «;» (locale pt_PT). Aspas ficam intactas. */
export function ptFormula(src) {
  if (typeof src !== 'string' || !src.startsWith('=')) return src;
  let out = '';
  let q = false;
  for (const ch of src) {
    if (ch === '"') q = !q;
    out += !q && ch === ',' ? ';' : ch;
  }
  return out;
}

export function quoteSheet(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function driverTitle(d) {
  return d.owner ? `👑 ${d.name} (patrão)` : `👤 ${d.name}`;
}
function tukTitle(t) {
  const nick = t.nickname ? ` · ${t.nickname}` : '';
  return `🛺 Tuk ${pad(t.number)}${nick}`;
}

export function sheetPlan(ctx) {
  const year = ctx.year;
  const drivers = ctx.drivers.map(d => ({ ...d, title: d.title || driverTitle(d) }));
  const tuks = ctx.tuks.map(t => ({ ...t, title: t.title || tukTitle(t) }));
  const daily = (ctx.dailyTypes || [
    { id: 'g1', name: 'Combustível' },
    { id: 'g2', name: 'Outros' }
  ]).filter(t => t.active !== false && t.freq !== 'Mensal');
  const monthly = (ctx.monthlyTypes || [
    { id: 'g3', name: 'Garagem', repeat: true },
    { id: 'g4', name: 'Manutenção', repeat: false }
  ]).filter(t => t.active !== false && t.freq !== 'Diário');
  return {
    year, business: ctx.businessName || '', tips: ctx.tipsEnabled !== false, drivers, tuks, daily, monthly,
    objectives: ctx.objectives || Array(12).fill(0),
    pct: ctx.pct || [],
    fixed: ctx.fixed || [],
    prizes: ctx.prizes || [],
    previousId: ctx.previousId || '',
    created: ctx.created || ''
  };
}

class WS {
  constructor(title, opt = {}) {
    this.title = title;
    this.hidden = !!opt.hidden;
    this.color = opt.color || GREY;
    this.cells = [];
    this.merges = [];
    this.colW = {};
    this.hideCol = [];
    this.hideRow = [];
    this.rowH = {};
    this.freeze = opt.freeze || null;
    this.checks = [];
    this.protect = [];
    this.cf = [];
  }
  put(r, c, v, o = {}) {
    const value = typeof v === 'string' && v.startsWith('=') ? ptFormula(v) : v;
    this.cells.push({ r, c, v: value, ...o });
  }
  merge(r1, c1, r2, c2) { this.merges.push([r1, c1, r2, c2]); }
  width(pairs) { for (const [c, w] of pairs) this.colW[c] = w; }
  protectRange(a1) { this.protect.push(a1); }
}

function fillHeader(ws, r, headers, fill) {
  headers.forEach((h, i) => ws.put(r, i + 1, h, { bold: true, color: 'FFFFFF', bg: fill, border: true, wrap: true, size: 9 }));
  ws.rowH[r] = 30;
}

const DB = 36;
const D0 = 7;
const TB = 45;
function dStart(m) { return D0 + (m - 1) * DB; }
function tStart(m) { return 7 + (m - 1) * TB; }

function driverSheet(plan, d, template) {
  const ws = new WS(template ? '⚙ Modelo motorista' : d.title, { hidden: !!template, color: d && d.owner ? GOLD : '2E75B6', freeze: 'D6' });
  const year = plan.year;
  const Q = quoteSheet('⚙ Percentagens');
  const QM = quoteSheet('⚙ Motoristas');
  const QT = quoteSheet('⚙ Tuks');
  const QO = quoteSheet('⚙ Objetivos');
  const QCFG = quoteSheet('⚙ Config');
  const keys = ['', 'data', '-', 'tuk', 'servicos', 'gratif', 'pct_motorista', 'pmot', 'ppat', 'entregas', 'saldo', 'nota', 'nserv'];
  keys.forEach((k, i) => ws.put(1, i + 1, k, { color: GREY, size: 8 }));
  ws.hideRow.push(1);
  ws.width([[1, 10], [2, 9], [3, 9], [4, 16], [5, 14], [6, 16], [7, 12], [8, 14], [9, 14], [10, 14], [11, 14], [12, 52], [13, 8]]);
  const gratOn = `IFERROR(INDEX(${QCFG}!$B$2:$B$50,MATCH("gratificacoes_ativas",${QCFG}!$A$2:$A$50,0)),"SIM")`;
  ws.put(2, 1, 'INFO', { color: GREY, size: 8 });
  ws.put(3, 1, 'NAV', { color: GREY, size: 8 });
  ws.put(4, 1, template ? 'MODELO' : d.id, { color: GREY, size: 8 });
  ws.put(5, 1, 'SALDO|2025', { color: GREY, size: 8 });
  ws.put(6, 1, `=IF(COUNTIFS(${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,"<="&MIN(TODAY(),DATE(${year},12,31))),${Q}!$E$2:$E$500,"patrão")>0,"patrão","motorista")`, { color: GREY, size: 8 });
  const who = template ? '👤 (modelo)' : (d.owner ? '👑 ' : '👤 ') + d.name;
  ws.put(2, 2, who, { bold: true, size: 16, color: NAVY });
  ws.merge(2, 2, 2, 5);
  const sub = template
    ? 'Separador modelo: a app copia-o para cada motorista novo'
    : (d.owner
      ? 'Patrão · conta para o objetivo do negócio · gratificações à parte (não entram no Faturado) · sem %, entregas, saldo ou prémio'
      : `Motorista · ativo desde ${d.since || ''} · a % é a parte do motorista`);
  ws.put(2, 12, sub, { color: '595959', size: 9, italic: true, wrap: true });
  ws.rowH[2] = 36;
  ws.put(3, 2, '=HYPERLINK("#gid={{gid:painel}}","← Painel")', { color: '1155CC' });
  ws.put(3, 4, '=IFERROR(HYPERLINK("#gid={{gid:self}}&range=B"&MATCH(TEXT(TODAY(),"yyyy-mm-dd"),$A$1:$A$500,0),"↓ Ir para hoje"),"")', { color: '1155CC' });
  ws.merge(3, 4, 3, 5);
  const T = '$A$9:$A$500';
  const kpis = [
    [2, 3, 'Faturado', NAVY, LIGHT, `=SUMIFS($E$9:$E$500,${T},"T|*")`, EURN],
    [4, 5, 'Dias trabalhados', NAVY, LIGHT, `=SUMIFS($M$9:$M$500,${T},"K|*")`, '0'],
    [6, 6, `=IF(${gratOn}="NÃO","Gratificações (desligadas)","Gratificações (à parte)")`, GOLD, GOLDL, `=SUMIFS($F$9:$F$500,${T},"T|*")`, EURN],
    [7, 8, 'Parte motorista', GREEN, GREENL, `=SUMIFS($H$9:$H$500,${T},"T|*")`, EURN],
    [9, 9, 'Parte patrão', NAVY, LIGHT, `=SUMIFS($I$9:$I$500,${T},"T|*")`, EURN],
    [10, 10, 'Entregue', NAVY, LIGHT, `=SUMIFS($J$9:$J$500,${T},"T|*")`, EURN],
    [11, 11, 'Saldo em falta', RED, REDL, `=IF($A$6="patrão","",N(L5)+SUMIFS($K$9:$K$500,${T},"T|*"))`, EURN],
    [12, 12, '=IF($A$6="patrão","Total recebido (faturado + gratificações)","Saldo transitado do ano anterior (já incluído no saldo em falta)")', GREY, 'F3F3F3', `=IF($A$6="patrão",B5+F5,IFERROR(INDEX(${QM}!$I$2:$I$80,MATCH($A$4,${QM}!$A$2:$A$80,0)),0))`, EURN]
  ];
  for (const [c1, c2, lab, hc, vc, f, nf] of kpis) {
    ws.put(4, c1, lab, { bold: true, color: 'FFFFFF', bg: hc, align: 'center', border: true, wrap: true, size: 9 });
    ws.put(5, c1, f, { bold: true, size: 12, bg: vc, align: 'center', nf, border: true });
    if (c2 !== c1) { ws.merge(4, c1, 4, c2); ws.merge(5, c1, 5, c2); }
  }
  ws.rowH[4] = 30;
  ws.rowH[5] = 24;
  const hdr = ['Dia', 'Dia sem.', '✎ Tuk', '✎ Serviços (€)', '✎ Gratificações (€)', '% do motorista', 'Parte motorista (€)', 'Parte patrão (€)', '✎ Entregue (€)', 'Saldo (€)', '✎ Notas (uma por dia)'];
  const inputCols = new Set([4, 5, 6, 10, 12]);
  for (let m = 1; m <= 12; m++) {
    const r0 = dStart(m);
    const ym = `${year}-${pad(m)}`;
    const dim = daysInMonth(year, m);
    const endm = `DATE(${year},${m},${dim})`;
    ws.put(r0, 1, 'B|' + ym, { color: GREY, size: 8 });
    for (let c = 2; c <= 12; c++) ws.put(r0, c, c === 2 ? `${MESES[m - 1].toUpperCase()} ${year}` : '', { bold: true, color: 'FFFFFF', bg: NAVY, size: 11 });
    ws.merge(r0, 2, r0, 4);
    const obj = `${QO}!$C$${m + 1}`;
    const own = `(COUNTIFS(${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,"<="&${endm}),${Q}!$E$2:$E$500,"patrão")>0)`;
    const p1 = `IFERROR(SUMIFS(${Q}!$D$2:$D$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,"<="&DATE(${year},${m},1))),0)`;
    const dch = `MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,"<="&${endm})`;
    const p2 = `IFERROR(SUMIFS(${Q}!$D$2:$D$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,${dch}),0)`;
    const bon = `${QO}!$G$${m + 1}`;
    const act = `${QO}!$F$${m + 1}`;
    ws.put(r0, 5, `="Objetivo "&TEXT(${obj},"0")&" €"&IF(${own},"  ·  patrão: conta para o objetivo, sem prémio nem %",IF(${act}="SIM","  ·  Prémio "&TEXT(${bon},"0")&" € se atingir","  ·  prémio desligado")&"  ·  % do motorista "&TEXT(${p1},"0%")&IF(${p2}<>${p1}," → "&TEXT(${p2},"0%")&" desde "&TEXT(${dch},"dd/mm"),""))`, { color: 'FFFFFF', bg: NAVY, align: 'right', size: 9 });
    ws.merge(r0, 5, r0, 12);
    ws.rowH[r0] = 20;
    ws.put(r0 + 1, 1, 'H', { color: GREY, size: 8 });
    hdr.forEach((h, i) => {
      const c = i + 2;
      const inp = inputCols.has(c);
      ws.put(r0 + 1, c, h, { bold: true, color: inp ? '000000' : 'FFFFFF', bg: inp ? HDRI : NAVY, align: 'center', wrap: true, border: true, size: 9 });
    });
    ws.rowH[r0 + 1] = 30;
    for (let dd = 1; dd <= 31; dd++) {
      const r = r0 + 1 + dd;
      if (dd > dim) { ws.hideRow.push(r); ws.put(r, 1, '', { color: GREY, size: 8 }); continue; }
      const key = `${year}-${pad(m)}-${pad(dd)}`;
      ws.put(r, 1, `="${key}"`, { color: GREY, size: 8 });
      ws.put(r, 2, `=DATE(${year},${m},${dd})`, { nf: 'dd/mm', align: 'center', border: true });
      ws.put(r, 3, `=CHOOSE(WEEKDAY(B${r}),"Dom","Seg","Ter","Qua","Qui","Sex","Sáb")`, { align: 'center', border: true });
      for (const c of inputCols) ws.put(r, c, '', { bg: INP, border: true, nf: (c === 5 || c === 6 || c === 10) ? EUR : undefined, align: c === 4 ? 'center' : undefined, input: true });
      ws.put(r, 7, `=IF(E${r}="","",IFERROR(SUMIFS(${Q}!$D$2:$D$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,$A$4,${Q}!$C$2:$C$500,"<="&B${r})),0))`, { nf: PCT, align: 'center', border: true, color: '595959' });
      ws.put(r, 8, `=IF(E${r}="","",ROUND(N(E${r})*G${r},2))`, { nf: EUR, bg: GREENL, border: true });
      ws.put(r, 9, `=IF(E${r}="","",N(E${r})-H${r})`, { nf: EUR, border: true });
      ws.put(r, 11, `=IF(AND(E${r}="",J${r}=""),"",IF($A$6="patrão","",N(J${r})-N(I${r})))`, { nf: EURN, border: true });
      ws.put(r, 13, `=IF(E${r}="",0,IF(ISFORMULA(E${r}),LEN(FORMULATEXT(E${r}))-LEN(SUBSTITUTE(FORMULATEXT(E${r}),"+",""))+1,IF(N(E${r})>0,1,0)))`, { color: GREY, size: 8 });
    }
    const a = r0 + 2;
    const b = r0 + 32;
    const rt = r0 + 33;
    const rk = r0 + 34;
    ws.put(rt, 1, 'T|' + ym, { color: GREY, size: 8 });
    ws.put(rt, 2, `TOTAL ${MESES[m - 1].toUpperCase()}`, { bold: true, bg: TOT, border: true });
    ws.merge(rt, 2, rt, 4);
    for (const [c, col] of [[5, 'E'], [6, 'F'], [8, 'H'], [9, 'I'], [10, 'J'], [11, 'K']]) {
      ws.put(rt, c, `=SUM(${col}${a}:${col}${b})`, { bold: true, bg: TOT, nf: EURN, border: true });
    }
    ws.put(rt, 13, `=SUM(M${a}:M${b})`, { color: GREY, size: 8 });
    ws.put(rk, 1, 'K|' + ym, { color: GREY, size: 8 });
    ws.put(rk, 2, `=M${rk}&" dias · "&M${rt}&" serviços"`, { bg: LIGHT, size: 9, bold: true });
    ws.merge(rk, 2, rk, 4);
    ws.put(rk, 13, `=COUNT(E${a}:E${b})`, { color: GREY, size: 8 });
    ws.put(rk, 5, `=IFERROR(E${rt}/${obj},0)`, { bg: LIGHT, nf: '"Obj. "0%', bold: true, align: 'center', border: true });
    ws.put(rk, 10, `=IF(${own},0,IF(AND(E${rt}>0,E${rt}>=${obj},${act}="SIM"),${bon},0))`, { bg: LIGHT, nf: '"Prémio "#,##0.00 "€"', bold: true, align: 'right', border: true });
    ws.merge(rk, 10, rk, 11);
    ws.put(rk, 12, `="Média diária: "&TEXT(IFERROR(E${rt}/M${rk},0),"#,##0.00")&" €"&IF(AND(E${rt}>0,E${rt}>=${obj}),"  ·  ✓ objetivo cumprido"&IF(${own},"",IF(${act}="SIM",""," (prémio desligado)")),"")`, { bg: LIGHT, size: 9 });
    const last = m === 12;
    ws.protectRange(`D${rt}:L${last ? 1000 : r0 + 37}`);
  }
  ws.hideCol.push('A', 'M');
  const owner = !!(d && d.owner);
  if (owner) ['G', 'H', 'I', 'J', 'K'].forEach(c => ws.hideCol.push(c));
  else ws.hideCol.push('F');
  if (owner && !plan.tips) ws.hideCol.push('F');
  ['A1:C1000', 'G1:I1000', 'K1:K1000', 'M1:Z1000', 'D1:L8'].forEach(r => ws.protectRange(r));
  ws.checks.push({ range: 'D9:D500', kind: 'list-range', formula: `=${QT}!$B$2:$B$51` });
  ws.checks.push({ range: 'E9:E500', kind: 'number>=0' });
  ws.checks.push({ range: 'F9:F500', kind: 'number>=0' });
  ws.checks.push({ range: 'J9:J500', kind: 'number>=0' });
  const gratOff = ptFormula(`=${gratOn}="NÃO"`);
  ws.cf.push(
    { range: 'B9:C450', formula: '=AND(ISNUMBER($B9);OR(WEEKDAY($B9)=1;WEEKDAY($B9)=7))', bg: 'E2EFDA' },
    { range: 'E9:E450', formula: '=LEFT($A9;2)="K|"', bg: 'F4C7C3' },
    { range: 'E9:E450', formula: '=AND(LEFT($A9;2)="K|";$E9>=0,75)', bg: 'FFE699' },
    { range: 'E9:E450', formula: '=AND(LEFT($A9;2)="K|";$E9>=1)', bg: 'B7E1C1' },
    { range: 'B9:C450', formula: '=AND(ISNUMBER($B9);$B9<TODAY();$E9="")', bg: 'D9D9D9', color: '808080' },
    { range: 'D9:D450', formula: '=AND(ISNUMBER($B9);$E9<>"";$D9="")', bg: 'F4C7C3' },
    { range: 'B9:L450', formula: '=$B9=TODAY()', bg: 'FFF2CC', bold: true },
    { range: 'F9:F450', formula: gratOff, bg: 'EFEFEF', color: 'A6A6A6' }
  );
  ws.role = template ? 'modelo-motorista' : 'motorista';
  ws.ref = template ? 'modelo-motorista' : d.id;
  return ws;
}

function tukSheet(plan, t, template) {
  const ws = new WS(template ? '⚙ Modelo tuk' : t.title, { hidden: !!template, color: GREEN, freeze: 'D6' });
  const year = plan.year;
  const QT = quoteSheet('⚙ Tuks');
  const QTI = quoteSheet('⚙ Tipos de gasto');
  const QO = quoteSheet('⚙ Objetivos');
  const FX = quoteSheet('⚙ Gastos fixos');
  const CN = quoteSheet('⚙ Consolidado');
  const daily = plan.daily;
  /* colunas: A key, B data, C -, D motorista, E faturado, depois um tipo diário, depois fim, aux, desp, lucro, nota, dias */
  const typeCols = daily.map((tp, i) => ({ key: 'type-' + tp.id, name: tp.name, index: 6 + i }));
  const fimC = 6 + daily.length;
  const auxC = fimC + 1;
  const despC = auxC + 1;
  const lucroC = despC + 1;
  const notaC = lucroC + 1;
  const diasC = notaC + 1;
  const lastC = diasC;
  const keys = ['', 'data', '-', 'motorista', 'faturado'];
  daily.forEach(tp => keys.push('type-' + tp.id));
  keys.push('fim', 'aux', 'desp', 'lucro', 'nota', 'dias');
  keys.forEach((k, i) => ws.put(1, i + 1, k, { color: GREY, size: 8 }));
  ws.hideRow.push(1);
  const widths = [10, 9, 9, 18, 14];
  daily.forEach(() => widths.push(14));
  widths.push(6, 6, 14, 14, 52, 8);
  widths.forEach((w, i) => { ws.colW[i + 1] = w; });
  ws.put(2, 1, 'INFO', { color: GREY, size: 8 });
  ws.put(3, 1, 'NAV', { color: GREY, size: 8 });
  ws.put(4, 1, template ? 'MODELO' : t.id, { color: GREY, size: 8 });
  ws.put(5, 1, 'TOT|ano', { color: GREY, size: 8 });
  ws.put(6, 1, `=IFERROR(INDEX(${QT}!$B$2:$B$80,MATCH($A$4,${QT}!$A$2:$A$80,0)),"")`, { color: GREY, size: 8 });
  const ix = (col) => `INDEX(${QT}!$${col}$2:$${col}$80,MATCH($A$4,${QT}!$A$2:$A$80,0))`;
  ws.put(2, 2, `=IFERROR("🛺 "&${ix('B')}&IF(${ix('E')}&""<>""," · "&${ix('E')},"")&IF(${ix('K')}&""<>"","  ·  "&${ix('K')},""),"🛺 Tuk (modelo)")`, { bold: true, size: 14, color: GREEN, wrap: true });
  ws.merge(2, 2, 2, 5);
  ws.put(2, fimC, `=IFERROR(${ix('F')}&IF(${ix('K')}&""<>""," · matrícula "&${ix('K')}," · sem matrícula")&" · 1 motorista por dia · gastos aqui"&IF(${ix('F')}="elétrico"," · sem combustível (elétrico)",""),"modelo")`, { color: '595959', size: 9, italic: true, wrap: true });
  ws.merge(2, fimC, 2, notaC);
  ws.rowH[2] = 36;
  ws.put(3, 2, '=HYPERLINK("#gid={{gid:painel}}","← Painel")', { color: '1155CC' });
  const fLetter = colLetter(6);
  const fimLetter = colLetter(fimC);
  const auxLetter = colLetter(auxC);
  const despLetter = colLetter(despC);
  const lucroLetter = colLetter(lucroC);
  const notaLetter = colLetter(notaC);
  const diasLetter = colLetter(diasC);
  const sumDaily = `SUM(${fLetter}9:${fimLetter}600)`;
  ws.put(4, 2, 'Faturado', { bold: true, color: 'FFFFFF', bg: NAVY, align: 'center', border: true, size: 9 });
  ws.put(5, 2, `=SUMIFS($E$9:$E$600,$A$9:$A$600,"T|*")`, { bold: true, size: 12, bg: LIGHT, align: 'center', nf: EURN, border: true });
  ws.merge(4, 2, 4, 3); ws.merge(5, 2, 5, 3);
  ws.put(4, 4, 'Despesas', { bold: true, color: 'FFFFFF', bg: RED, align: 'center', border: true, size: 9 });
  ws.put(5, 4, `=SUMIFS($${despLetter}$9:$${despLetter}$600,$A$9:$A$600,"T|*")`, { bold: true, size: 12, bg: REDL, align: 'center', nf: EURN, border: true });
  ws.put(4, 5, 'Lucro', { bold: true, color: 'FFFFFF', bg: GREEN, align: 'center', border: true, size: 9 });
  ws.put(5, 5, '=B5-D5', { bold: true, size: 12, bg: GREENL, align: 'center', nf: EURN, border: true });
  ws.rowH[4] = 30;
  ws.rowH[5] = 24;
  for (let m = 1; m <= 12; m++) {
    const r0 = tStart(m);
    const ym = `${year}-${pad(m)}`;
    const dim = daysInMonth(year, m);
    ws.put(r0, 1, 'B|' + ym, { color: GREY, size: 8 });
    for (let c = 2; c <= lastC; c++) ws.put(r0, c, '', { bg: GREEN });
    ws.put(r0, 2, `${MESES[m - 1].toUpperCase()} ${year}`, { bold: true, color: 'FFFFFF', bg: GREEN, size: 11 });
    ws.merge(r0, 2, r0, 4);
    ws.put(r0, 7, `="Objetivo por motorista: "&TEXT(${QO}!$C$${m + 1},"0")&" €"`, { color: 'FFFFFF', bg: GREEN, align: 'right', size: 9 });
    ws.merge(r0, 7, r0, notaC);
    ws.rowH[r0] = 20;
    ws.put(r0 + 1, 1, 'H', { color: GREY, size: 8 });
    const heads = ['Dia', 'Dia sem.', 'Motorista', 'Faturado (€)'];
    daily.forEach((tp, i) => heads.push(`="✎ "&${QTI}!$B$${i + 2}&" (€)"`));
    heads.push('fim', 'aux', 'Despesa total (€)', 'Lucro (€)', '✎ Notas (uma por dia)');
    heads.forEach((h, i) => {
      const c = i + 2;
      const input = c >= 6 && c <= fimC || c === notaC;
      const bg = input ? HDRI : (c === despC ? RED : (c === lucroC ? GREEN : NAVY));
      ws.put(r0 + 1, c, h, { bold: true, color: input ? '000000' : 'FFFFFF', bg, align: 'center', wrap: true, border: true, size: 9 });
    });
    ws.rowH[r0 + 1] = 30;
    for (let dd = 1; dd <= 31; dd++) {
      const r = r0 + 1 + dd;
      if (dd > dim) { ws.hideRow.push(r); continue; }
      const key = `${year}-${pad(m)}-${pad(dd)}`;
      ws.put(r, 1, `="${key}"`, { color: GREY, size: 8 });
      ws.put(r, 2, `=DATE(${year},${m},${dd})`, { nf: 'dd/mm', align: 'center', border: true });
      ws.put(r, 3, `=CHOOSE(WEEKDAY(B${r}),"Dom","Seg","Ter","Qua","Qui","Sex","Sáb")`, { align: 'center', border: true });
      const flt = `FILTER(${CN}!$D$2:$D$4000,${CN}!$A$2:$A$4000=$A${r},${CN}!$E$2:$E$4000=$A$6)`;
      ws.put(r, 4, `=IFERROR(IF(COUNTIFS(${CN}!$A$2:$A$4000,$A${r},${CN}!$E$2:$E$4000,$A$6)>1,"⚠ "&TEXTJOIN(" + ",TRUE,${flt}),TEXTJOIN(" + ",TRUE,${flt})),"")`, { border: true, align: 'center' });
      ws.put(r, 5, `=IFERROR(IF(ROWS(FILTER(${CN}!$F$2:$F$4000,${CN}!$A$2:$A$4000=$A${r},${CN}!$E$2:$E$4000=$A$6,${CN}!$F$2:$F$4000<>""))>0,SUMIFS(${CN}!$F$2:$F$4000,${CN}!$A$2:$A$4000,$A${r},${CN}!$E$2:$E$4000,$A$6),""),"")`, { nf: EUR, bg: LIGHT, border: true });
      for (let c = 6; c <= fimC; c++) ws.put(r, c, '', { bg: INP, border: true, nf: EUR, input: true });
      ws.put(r, auxC, `=IF(LEFT(D${r},1)="⚠",1,0)`, { color: GREY, size: 8 });
      ws.put(r, despC, `=IF(COUNT(${fLetter}${r}:${fimLetter}${r})=0,"",SUM(${fLetter}${r}:${fimLetter}${r}))`, { nf: EUR, bg: REDL, border: true });
      ws.put(r, lucroC, `=IF(AND(E${r}="",${despLetter}${r}=""),"",N(E${r})-N(${despLetter}${r}))`, { nf: EURN, bg: GREENL, border: true });
      ws.put(r, notaC, '', { bg: INP, border: true, input: true });
    }
    const a = r0 + 2;
    const b = r0 + 32;
    const rh = r0 + 33;
    ws.put(rh, 1, 'MH|' + ym, { color: GREY, size: 8 });
    ws.put(rh, 2, 'GASTOS MENSAIS', { bold: true, color: 'FFFFFF', bg: RED, size: 9 });
    ws.merge(rh, 2, rh, 3);
    ws.put(rh, 4, '✎ Valor (€)', { bold: true, bg: HDRI, align: 'center', size: 9, border: true });
    ws.put(rh, 5, '✎ Observações', { bold: true, bg: HDRI, size: 9, border: true });
    ws.merge(rh, 5, rh, Math.max(5, fimC));
    const slots = Math.max(8, plan.monthly.length);
    for (let s = 0; s < slots; s++) {
      const r = rh + 1 + s;
      const tp = plan.monthly[s];
      if (tp) {
        const ti = s + 2 + daily.length;
        ws.put(r, 1, `M|${ym}|${tp.id}`, { color: GREY, size: 8 });
        ws.put(r, 2, `=${QTI}!$B$${ti}`, { bold: true, border: true, align: 'right' });
        ws.merge(r, 2, r, 3);
        ws.put(r, 4, '', { bg: INP, border: true, nf: EUR, input: true });
        ws.put(r, 5, '', { bg: INP, border: true, input: true, size: 9 });
        const start = `DATE(${year},${m},1)`;
        const endm = `DATE(${year},${m},${dim})`;
        const mx = `MAXIFS(${FX}!$E$2:$E$500,${FX}!$C$2:$C$500,$A$4,${FX}!$A$2:$A$500,${QTI}!$A$${ti},${FX}!$E$2:$E$500,"<="&${endm})`;
        const exp = `IFERROR(SUMIFS(${FX}!$F$2:$F$500,${FX}!$C$2:$C$500,$A$4,${FX}!$A$2:$A$500,${QTI}!$A$${ti},${FX}!$E$2:$E$500,${mx}),0)`;
        const rep = `${QTI}!$D$${ti}="sim"`;
        ws.put(r, despC, `=IF(${rep},IF(${start}>TODAY(),"",IF(D${r}<>"",N(D${r}),IF(${exp}>0,${exp},""))),IF(D${r}="","",N(D${r})))`, { nf: EUR, bg: REDL, border: true });
        ws.put(r, lucroC, `=IF(${despLetter}${r}="","",-${despLetter}${r})`, { nf: EURN, border: true });
        ws.put(r, notaC, `=IF(${rep},IF(${start}>TODAY(),"fixo · só conta a partir de "&TEXT(${start},"dd/mm"),IF(D${r}="","",IF(ROUND(N(D${r})-${exp},2)<>0,"⚠ diferente do fixo","✓ fixo"))),"")`, { color: GREY, italic: true, size: 8 });
      } else {
        ws.put(r, 1, `M|${ym}|-`, { color: GREY, size: 8 });
        ws.put(r, 2, '(reserva)', { italic: true, color: GREY, size: 8 });
        ws.put(r, 4, '', { bg: INP, input: true, nf: EUR });
        ws.put(r, despC, `=IF(D${r}="","",D${r})`, { nf: EUR });
        ws.hideRow.push(r);
      }
    }
    const m1 = rh + 1;
    const m2 = rh + slots;
    const rt = rh + slots + 1;
    const rk = rt + 1;
    ws.put(rt, 1, 'T|' + ym, { color: GREY, size: 8 });
    ws.put(rt, 2, `TOTAL ${MESES[m - 1].toUpperCase()}`, { bold: true, bg: TOT, border: true });
    ws.merge(rt, 2, rt, 4);
    ws.put(rt, 5, `=SUM(E${a}:E${b})`, { bold: true, bg: TOT, nf: EURN, border: true });
    for (let c = 6; c <= fimC; c++) {
      const L = colLetter(c);
      ws.put(rt, c, `=SUM(${L}${a}:${L}${b})`, { bold: true, bg: TOT, nf: EURN, border: true });
    }
    ws.put(rt, despC, `=SUM(${despLetter}${a}:${despLetter}${b})+SUM(${despLetter}${m1}:${despLetter}${m2})`, { bold: true, bg: TOT, nf: EURN, border: true });
    ws.put(rt, lucroC, `=E${rt}-${despLetter}${rt}`, { bold: true, bg: TOT, nf: EURN, border: true });
    ws.put(rk, 1, 'K|' + ym, { color: GREY, size: 8 });
    ws.put(rk, 2, `="Dias com serviço: "&${diasLetter}${rk}&"   ·   Média diária: "&TEXT(IFERROR(E${rt}/${diasLetter}${rk},0),"#,##0.00")&" €"`, { bg: LIGHT, size: 9 });
    ws.merge(rk, 2, rk, notaC);
    ws.put(rk, diasC, `=COUNT(E${a}:E${b})`, { color: GREY, size: 8 });
    ws.protectRange(`D${a}:E${b}`);
    ws.protectRange(`D${rh}:H${rh}`);
    const next = m === 12 ? 1000 : tStart(m + 1);
    ws.protectRange(`${notaLetter}${rh}:${notaLetter}${next}`);
    ws.protectRange(`D${rt}:${colLetter(fimC)}${next}`);
  }
  ws.hideCol.push('A', colLetter(fimC), colLetter(auxC), colLetter(diasC));
  if (t && t.fuel === 'elétrico') {
    const fuel = daily.findIndex(tp => tp.scope === 'combustão' || tp.id === 'g1');
    if (fuel >= 0) ws.hideCol.push(colLetter(6 + fuel));
  }
  ['A1:C1000', `${colLetter(auxC)}1:${colLetter(lucroC)}1000`, `${colLetter(diasC)}1:Z1000`, 'D1:L8'].forEach(r => ws.protectRange(r));
  ws.checks.push({ range: `${fLetter}9:${fimLetter}700`, kind: 'number>=0' });
  ws.cf.push(
    { range: `B9:${notaLetter}700`, formula: '=AND(ISNUMBER($B9);OR(WEEKDAY($B9)=1;WEEKDAY($B9)=7))', bg: 'E2EFDA' },
    { range: `B9:C700`, formula: `=AND(ISNUMBER($B9);$B9<TODAY();$E9="";COUNT($F9:$H9)=0)`, bg: 'D9D9D9', color: '808080' },
    { range: `B9:${notaLetter}700`, formula: '=$B9=TODAY()', bg: 'FFF2CC', bold: true },
    { range: 'D9:D700', formula: '=LEFT($D9;1)="⚠"', bg: 'E06666', color: 'FFFFFF', bold: true }
  );
  ws.role = template ? 'modelo-tuk' : 'tuk';
  ws.ref = template ? 'modelo-tuk' : t.id;
  ws.layout = { fimC, auxC, despC, lucroC, notaC, typeCols };
  return ws;
}

function tableSheet(title, headers, rows, opt = {}) {
  const ws = new WS(title, { hidden: !!opt.hidden, color: opt.color || GREY, freeze: 'A2' });
  fillHeader(ws, 1, headers, opt.fill || NAVY);
  rows.forEach((row, i) => {
    row.forEach((v, j) => {
      if (v == null || v === '') return;
      const o = { border: true };
      if (typeof v === 'object' && v && 'f' in v) ws.put(i + 2, j + 1, v.f, { ...o, ...(v.o || {}) });
      else ws.put(i + 2, j + 1, v, o);
    });
  });
  (opt.widths || []).forEach((w, i) => { ws.colW[i + 1] = w; });
  if (opt.protectAll) ws.protectRange('A1:Z1000');
  ws.role = opt.role || 'config';
  return ws;
}

function configSheet(plan) {
  const rows = [
    ['schema_version', 5, 'estrutura v4; a app lê as células pelas chaves'],
    ['ano', plan.year, 'um ficheiro por ano'],
    ['negocio', plan.business, 'nome escolhido na configuração e nas Definições'],
    ['moeda', 'EUR', ''],
    ['ficheiro_anterior', plan.previousId || '', 'id da folha do ano anterior'],
    ['ficheiro_seguinte', '', 'preenchido quando se cria o ano seguinte'],
    ['criado_em', plan.created || '', ''],
    ['app_versao_minima', '4.0', ''],
    ['objetivo_modo', 'por motorista', 'objetivo do negócio = objetivo × motoristas que trabalharam pelo menos 1 dia'],
    ['regra_tuk', '1 motorista por tuk por dia', 'trocar de tuk passa o outro motorista a sem tuk'],
    ['regra_sem_tuk', 'sem serviços', 'sem tuk não se lançam serviços nem gastos'],
    ['gastos_fixos', 'todos os meses até hoje', 'a app escreve o valor no dia 1; meses futuros ainda não contam'],
    ['fuso_horario', 'Portugal continental', 'UTC+0; UTC+1 no verão'],
    ['gratificacoes_ativas', plan.tips ? 'SIM' : 'NÃO', 'NÃO esconde a coluna no separador do patrão; os valores ficam'],
    ['percentagem', 'do motorista', '55% = o motorista fica com 55% e o patrão com 45%'],
    ['premio_regra', 'histórico em ⚙ Prémio', 'a linha mais recente até ao fim do mês é a que vale']
  ];
  const ws = tableSheet('⚙ Config', ['Chave', 'Valor', 'Notas'], rows, { hidden: true, widths: [24, 28, 90], protectAll: true, role: 'config' });
  ws.checks.push({ range: 'B14', kind: 'list', values: ['SIM', 'NÃO'] });
  return ws;
}

function registrySheets(plan) {
  const out = [];
  const tukRows = [];
  for (let i = 0; i < 50; i++) {
    const t = plan.tuks[i];
    const r = i + 2;
    if (!t) {
      tukRows.push([
        '', { f: `=IF(J${r}="","","Tuk "&TEXT(J${r},"00"))` }, '', '', '', '', { f: `=IF(A${r}="","",0)` }, '', '', '', '',
        { f: `=IF(A${r}="","",IF(J${r}="","⚠ falta o número",IF(COUNTIF($J$2:$J$51,J${r})>1,"⚠ número repetido",IF(F${r}="","⚠ falta o tipo",IF(AND(K${r}<>"",NOT(REGEXMATCH(UPPER(K${r}&""),"^([A-Z]{2}|[0-9]{2})-([A-Z]{2}|[0-9]{2})-([A-Z]{2}|[0-9]{2})$"))),"⚠ matrícula fora do formato AA-00-AA","✓")))))` }
      ]);
    } else {
      tukRows.push([
        t.id,
        { f: `=IF(J${r}="","","Tuk "&TEXT(J${r},"00"))` },
        t.title,
        `{{gid:${t.id}}}`,
        t.nickname || '',
        t.fuel,
        { f: `=IF(A${r}="","",0)`, o: { nf: EUR } },
        t.status || 'ativo',
        t.soldOn || '',
        t.number,
        t.plate || '',
        { f: `=IF(A${r}="","",IF(J${r}="","⚠ falta o número",IF(COUNTIF($J$2:$J$51,J${r})>1,"⚠ número repetido",IF(F${r}="","⚠ falta o tipo",IF(AND(K${r}<>"",NOT(REGEXMATCH(UPPER(K${r}&""),"^([A-Z]{2}|[0-9]{2})-([A-Z]{2}|[0-9]{2})-([A-Z]{2}|[0-9]{2})$"))),"⚠ matrícula fora do formato AA-00-AA","✓")))))` }
      ]);
    }
  }
  const tukWs = tableSheet('⚙ Tuks', ['ID', 'Nome', 'Separador', 'sheetId', 'Alcunha', 'Tipo', 'Garagem/mês atual (€)', 'Estado', 'Data venda', 'Número', 'Matrícula', 'Verificação'], tukRows, {
    hidden: true, widths: [8, 16, 28, 14, 14, 14, 18, 12, 14, 12, 16, 36], protectAll: true, role: 'tuks-reg'
  });
  tukWs.checks.push({ range: 'J2:J51', kind: 'list', values: Array.from({ length: 50 }, (_, i) => String(i + 1)) });
  tukWs.checks.push({ range: 'F2:F51', kind: 'list', values: ['combustão', 'elétrico'] });
  out.push(tukWs);

  const Q = quoteSheet('⚙ Percentagens');
  const motRows = [];
  for (let i = 0; i < 50; i++) {
    const d = plan.drivers[i];
    const r = i + 2;
    const papel = { f: `=IF(A${r}="","",IF(COUNTIFS(${Q}!$A$2:$A$500,A${r},${Q}!$C$2:$C$500,MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,A${r},${Q}!$C$2:$C$500,"<="&DATE(${plan.year},12,31)),${Q}!$E$2:$E$500,"patrão")>0,"patrão","motorista"))` };
    if (!d) motRows.push(['', '', '', '', '', '', papel, '', { f: '', o: { nf: EURN } }]);
    else motRows.push([d.id, d.name, d.title, `{{gid:${d.id}}}`, d.phone || '', d.since || '', papel, d.active === false ? 'inativo' : 'ativo', { f: d.opening || 0, o: { nf: EURN } }]);
  }
  out.push(tableSheet('⚙ Motoristas', ['ID', 'Nome', 'Separador', 'sheetId', 'Telefone', 'Desde', 'Papel atual', 'Estado', 'Saldo transitado'], motRows, {
    hidden: true, widths: [8, 16, 28, 14, 14, 14, 14, 12, 18], protectAll: true, role: 'drivers-reg'
  }));

  const pctRows = (plan.pct || []).map(p => [p.driverId, p.name || '', p.from, p.pct, p.role, p.note || '']);
  const pct = tableSheet('⚙ Percentagens', ['ID motorista', 'Nome', 'Desde', '% do motorista', 'Papel', 'Notas'], pctRows, {
    hidden: true, widths: [14, 16, 14, 18, 14, 60], protectAll: true, role: 'pct'
  });
  pct.cells.forEach(c => { if (c.r > 1 && c.c === 4 && typeof c.v === 'number') c.nf = PCT; });
  out.push(pct);

  const typeRows = [];
  plan.daily.forEach((tp, i) => typeRows.push([tp.id, tp.name, 'Diário', 'não', tp.scope === 'combustão' ? 'só tuks a combustão' : 'todos os tuks', 'ativo', 'coluna ' + colLetter(6 + i), tp.id === 'g1' ? 'valor do dia (oculto nos elétricos)' : 'valor do dia']));
  plan.monthly.forEach((tp, i) => typeRows.push([tp.id, tp.name, 'Mensal', tp.repeat ? 'sim' : 'não', 'por tuk', 'ativo', 'linha ' + (i + 1), tp.repeat ? 'repete; a app escreve no dia 1' : 'soma do mês, ex.: =80+50+10']));
  out.push(tableSheet('⚙ Tipos de gasto', ['ID', 'Nome', 'Frequência', 'Repete todos os meses', 'Aplica-se a', 'Estado', 'Posição', 'Como se lança'], typeRows, {
    hidden: true, widths: [8, 16, 12, 18, 28, 12, 14, 50], protectAll: true, role: 'types'
  }));

  const fixRows = (plan.fixed || []).map(f => [f.typeId, f.typeName || '', f.tukId, f.tukName || '', f.from, f.amount, f.note || '']);
  const fix = tableSheet('⚙ Gastos fixos', ['ID tipo', 'Tipo', 'ID tuk', 'Tuk', 'Desde', 'Valor (€)', 'Notas'], fixRows, {
    hidden: true, widths: [10, 14, 10, 16, 14, 14, 60], protectAll: true, role: 'fixed'
  });
  fix.cells.forEach(c => { if (c.r > 1 && c.c === 6 && typeof c.v === 'number') c.nf = EUR; });
  out.push(fix);

  const QP = quoteSheet('⚙ Prémio');
  const objRows = [];
  for (let m = 1; m <= 12; m++) {
    const endm = `DATE(${plan.year},${m},${daysInMonth(plan.year, m)})`;
    objRows.push([
      m,
      MESES[m - 1],
      { f: `='📊 Painel'!J${9 + m}`, o: { nf: EUR } },
      'editável no Painel (coluna ✎ Objetivo)',
      { f: `=IF(MAXIFS(${QP}!$A$2:$A$200,${QP}!$A$2:$A$200,"<="&${endm})=0,"",MAXIFS(${QP}!$A$2:$A$200,${QP}!$A$2:$A$200,"<="&${endm}))`, o: { nf: 'dd/mm/yyyy' } },
      { f: `=IF(E${m + 1}="","NÃO",IFERROR(INDEX(FILTER(${QP}!$B$2:$B$200,${QP}!$A$2:$A$200=E${m + 1}),COUNTIF(${QP}!$A$2:$A$200,E${m + 1})),"NÃO"))` },
      { f: `=IF(F${m + 1}<>"SIM",0,IFERROR(INDEX(FILTER(${QP}!$C$2:$C$200,${QP}!$A$2:$A$200=E${m + 1}),COUNTIF(${QP}!$A$2:$A$200,E${m + 1})),0))`, o: { nf: EUR } }
    ]);
  }
  out.push(tableSheet('⚙ Objetivos', ['Mês', 'Nome', 'Objetivo por motorista (€)', 'Origem', 'Prémio: linha em vigor', 'Prémio ativo', 'Prémio do mês (€)'], objRows, {
    hidden: true, widths: [8, 14, 22, 36, 18, 14, 16], protectAll: true, role: 'objectives'
  }));

  const preRows = (plan.prizes || [{ from: `${plan.year}-01-01`, active: false, amount: 0 }]).map(p => [
    p.from, p.active ? 'SIM' : 'NÃO', p.amount, 'faturado do motorista no mês ≥ objetivo do mês', p.note || 'vale deste mês em diante'
  ]);
  const pre = tableSheet('⚙ Prémio', ['Desde (mês)', 'Prémio ativo', 'Valor (€)', 'Condição', 'Notas'], preRows, {
    hidden: true, widths: [16, 16, 14, 46, 60], protectAll: true, role: 'prize'
  });
  pre.checks.push({ range: 'B2:B200', kind: 'list', values: ['SIM', 'NÃO'] });
  out.push(pre);
  out.push(tableSheet('⚙ Registo', ['Data/hora', 'Origem', 'Quem', 'Separador', 'Chave', 'Antes', 'Depois', 'Nota'], [], {
    hidden: true, widths: [18, 12, 20, 20, 20, 14, 14, 50], protectAll: true, role: 'log'
  }));
  return out;
}

function consolidado(plan) {
  const ws = new WS('⚙ Consolidado', { hidden: true, color: GREY });
  const heads = ['key', 'data', 'mot_id', 'motorista', 'tuk', 'faturado', 'gratif', 'pct_motorista', 'pmot', 'ppat', 'entregue', 'saldo', 'nserv', 'mes'];
  heads.forEach((h, i) => ws.put(1, i + 1, h, { bold: true, size: 9 }));
  ['key', 'mot_id', 'mes', 'premio', 'pct_obj'].forEach((h, i) => ws.put(1, 16 + i, h, { bold: true, size: 9 }));
  const wHeads = ['key', 'tuk_id', 'mes', 'faturado'];
  plan.daily.forEach(tp => wHeads.push(tp.id));
  wHeads.push('fim', 'desp_total', 'lucro', 'conflitos');
  wHeads.forEach((h, i) => ws.put(1, 23 + i, h, { bold: true, size: 9 }));
  ['key', 'tuk_id', 'mes', 'tipo', 'valor'].forEach((h, i) => ws.put(1, 34 + i, h, { bold: true, size: 9 }));
  const QM = quoteSheet('⚙ Motoristas');
  const QT = quoteSheet('⚙ Tuks');
  const partsD = [];
  const partsP = [];
  plan.drivers.forEach((d, k) => {
    const A = `${quoteSheet(d.title)}!A9:A500`;
    const R = (col) => `${quoteSheet(d.title)}!${col}9:${col}500`;
    const mi = `${QM}!$A$${k + 2}`;
    const mn = `${QM}!$B$${k + 2}`;
    const hs = [A, R('B'), `IF(LEN(${A})=10,${mi},"")`, `IF(LEN(${A})=10,${mn},"")`, R('D'), R('E'), R('F'), R('G'), R('H'), R('I'), R('J'), R('K'), R('M'), `IF(LEN(${A})=10,MONTH(${R('B')}),"")`].join(',');
    partsD.push(`IFERROR(FILTER(HSTACK(${hs}),LEN(${A})=10),"")`);
    partsP.push(`IFERROR(FILTER(HSTACK(${A},IF(LEFT(${A},2)="K|",${mi},""),IFERROR(VALUE(MID(${A},8,2)),""),${R('J')},${R('E')}),LEFT(${A},2)="K|"),"")`);
  });
  const partsW = [];
  const partsG = [];
  plan.tuks.forEach((t, k) => {
    const A = `${quoteSheet(t.title)}!A9:A700`;
    const R = (col) => `${quoteSheet(t.title)}!${col}9:${col}700`;
    const ti = `${QT}!$A$${k + 2}`;
    const dailyLetters = plan.daily.map((_, i) => colLetter(6 + i));
    const fim = colLetter(6 + plan.daily.length);
    const desp = colLetter(6 + plan.daily.length + 2);
    const lucro = colLetter(6 + plan.daily.length + 3);
    const aux = colLetter(6 + plan.daily.length + 1);
    const cols = ['E', ...dailyLetters, fim, desp, lucro, aux].map(c => R(c)).join(',');
    partsW.push(`IFERROR(FILTER(HSTACK(${A},IF(LEFT(${A},2)="T|",${ti},""),IFERROR(VALUE(MID(${A},8,2)),""),${cols}),LEFT(${A},2)="T|"),"")`);
    partsG.push(`IFERROR(FILTER(HSTACK(${A},IF(LEFT(${A},2)="M|",${ti},""),IFERROR(VALUE(MID(${A},8,2)),""),${R('B')},${R(desp)}),LEFT(${A},2)="M|",${R(desp)}<>""),"")`);
  });
  if (partsD.length) ws.put(2, 1, `=ARRAYFORMULA(VSTACK(${partsD.join(',')}))`);
  if (partsP.length) ws.put(2, 16, `=ARRAYFORMULA(VSTACK(${partsP.join(',')}))`);
  if (partsW.length) ws.put(2, 23, `=ARRAYFORMULA(VSTACK(${partsW.join(',')}))`);
  if (partsG.length) ws.put(2, 34, `=ARRAYFORMULA(VSTACK(${partsG.join(',')}))`);
  ws.protectRange('A1:AZ5000');
  ws.role = 'consolidado';
  return ws;
}

function painel(plan) {
  const ws = new WS('📊 Painel', { color: NAVY, freeze: 'A4' });
  const year = plan.year;
  const CN = quoteSheet('⚙ Consolidado');
  const QCFG = quoteSheet('⚙ Config');
  const QTI = quoteSheet('⚙ Tipos de gasto');
  const QO = quoteSheet('⚙ Objetivos');
  const QM = quoteSheet('⚙ Motoristas');
  const QT = quoteSheet('⚙ Tuks');
  const CC = (col) => `${CN}!$${col}$2:$${col}$5000`;
  const grat = `IFERROR(INDEX(${QCFG}!$B$2:$B$50,MATCH("gratificacoes_ativas",${QCFG}!$A$2:$A$50,0)),"SIM")`;
  ws.put(1, 1, `="📊 "&${QCFG}!B3&" — Painel de Gestão "&${QCFG}!B2`, { bold: true, size: 16, color: NAVY });
  ws.merge(1, 1, 1, 8);
  ws.rowH[1] = 32;
  const bands = [
    [1, 2, 'Faturado', NAVY, LIGHT, '=B22', EURN],
    [3, 4, 'Total de despesas', RED, 'FCE4E4', '=G22', EURN],
    [5, 7, 'Lucro (faturado − despesas)', GREEN, GREENL, '=H22', EURN],
    [8, 9, 'Dias com serviço', NAVY, LIGHT, '=I22', '0'],
    [10, 11, 'Média por dia', NAVY, LIGHT, '=IFERROR(B22/I22,0)', EURN],
    [12, 13, '% Objetivo', NAVY, LIGHT, '=M22', PCT],
    [14, 16, `=IF(${grat}="NÃO","Gratificações (desligadas)","Gratificações (patrão, à parte)")`, GOLD, GOLDL, '=P22', EURN]
  ];
  for (const [c1, c2, lab, hc, vc, f, nf] of bands) {
    ws.put(2, c1, lab, { bold: true, color: 'FFFFFF', bg: hc, align: 'center', border: true });
    ws.put(3, c1, f, { bold: true, size: 13, bg: vc, align: 'center', nf, border: true });
    if (c2 !== c1) { ws.merge(2, c1, 2, c2); ws.merge(3, c1, 3, c2); }
  }
  ws.put(8, 1, 'RESUMO MENSAL', { bold: true, color: 'FFFFFF', bg: NAVY });
  ws.merge(8, 1, 8, 16);
  const H = ['Mês', 'Faturado', `=${QTI}!$B$2`, `=${QTI}!$B$3`, `=${QTI}!$B$4`, `=${QTI}!$B$5&" e outros mensais"`, 'Total despesas', 'Lucro', 'Dias com serviço', '✎ Objetivo por motorista', 'Motoristas que trabalharam', 'Objetivo do negócio', '% Objetivo', 'Prémios', 'Ganho do patrão', 'Gratificações'];
  H.forEach((h, i) => {
    const input = i === 9;
    ws.put(9, i + 1, h, { bold: true, color: input ? '000000' : 'FFFFFF', bg: input ? HDRI : NAVY, align: 'center', wrap: true, border: true, size: 9 });
  });
  ws.rowH[9] = 32;
  for (let m = 1; m <= 12; m++) {
    const r = 9 + m;
    const vals = [
      MESES[m - 1],
      `=SUMIFS(${CC('F')},${CC('N')},${m})`,
      `=SUMIFS(${CC('AA')},${CC('Y')},${m})`,
      `=SUMIFS(${CC('AB')},${CC('Y')},${m})+SUMIFS(${CC('AC')},${CC('Y')},${m})`,
      `=SUMIFS(${CC('AL')},${CC('AJ')},${m},${CC('AK')},${QTI}!$B$4)`,
      `=SUMIFS(${CC('AL')},${CC('AJ')},${m})-E${r}`,
      `=SUM(C${r}:F${r})`,
      `=B${r}-G${r}`,
      `=IFERROR(ROWS(UNIQUE(FILTER(${CC('B')},${CC('N')}=${m},${CC('F')}<>""))),0)`,
      plan.objectives ? (plan.objectives[m - 1] || 0) : 0,
      `=IFERROR(ROWS(UNIQUE(FILTER(${CC('C')},${CC('N')}=${m},${CC('F')}<>""))),0)`,
      `=J${r}*K${r}`,
      `=IFERROR(B${r}/L${r},0)`,
      `=SUMIFS(${CC('S')},${CC('R')},${m})`,
      `=SUMIFS(${CC('J')},${CC('N')},${m})-G${r}-N${r}`,
      `=SUMIFS(${CC('G')},${CC('N')},${m})`
    ];
    vals.forEach((v, i) => {
      const input = i === 9;
      ws.put(r, i + 1, v, { border: true, bg: input ? INP : (i === 1 ? LIGHT : i === 7 ? GREENL : undefined), nf: i === 0 || i === 15 ? undefined : (i === 8 || i === 10 ? '0' : i === 12 ? PCT : EURN), align: 'center', input, bold: i === 0 });
    });
  }
  ws.put(22, 1, 'TOTAL', { bold: true, bg: TOT, border: true });
  for (let c = 2; c <= 16; c++) {
    const L = colLetter(c);
    const f = c === 11 ? `=IFERROR(ROWS(UNIQUE(FILTER(${CC('C')},${CC('F')}<>""))),0)` : c === 13 ? '=IFERROR(B22/L22,0)' : `=SUM(${L}10:${L}21)`;
    ws.put(22, c, f, { bold: true, bg: TOT, border: true, nf: c === 9 || c === 11 ? '0' : c === 13 ? PCT : EURN });
  }
  ws.protectRange('A1:I1000');
  ws.protectRange('J1:J9');
  ws.protectRange('J22:J1000');
  ws.protectRange('K1:Z1000');
  ws.checks.push({ range: 'J10:J21', kind: 'number>=0' });
  ws.put(24, 1, 'MOTORISTAS — ANO', { bold: true, color: 'FFFFFF', bg: NAVY });
  ws.merge(24, 1, 24, 7);
  ['Motorista', 'Faturado', 'Parte motorista', 'Prémios', 'Entregue', 'Saldo', 'Dias'].forEach((h, i) => ws.put(25, i + 1, h, { bold: true, color: 'FFFFFF', bg: NAVY, border: true, size: 9 }));
  for (let i = 0; i < 50; i++) {
    const r = 26 + i;
    const k = i + 2;
    const mid = `${QM}!$A$${k}`;
    ws.put(r, 1, `=IF(${QM}!$B$${k}="","",${QM}!$B$${k}&IF(${QM}!$G$${k}="patrão"," · patrão","")&IF(${QM}!$H$${k}<>"ativo"," ("&${QM}!$H$${k}&")",""))`, { border: true, bold: true });
    ws.put(r, 2, `=IF($A${r}="","",SUMIFS(${CC('F')},${CC('C')},${mid}))`, { nf: EURN, border: true });
    ws.put(r, 3, `=IF($A${r}="","",SUMIFS(${CC('I')},${CC('C')},${mid}))`, { nf: EURN, border: true });
    ws.put(r, 4, `=IF($A${r}="","",SUMIFS(${CC('S')},${CC('Q')},${mid}))`, { nf: EURN, border: true });
    ws.put(r, 5, `=IF($A${r}="","",SUMIFS(${CC('K')},${CC('C')},${mid}))`, { nf: EURN, border: true });
    ws.put(r, 6, `=IF($A${r}="","",IF(${QM}!$G$${k}="patrão","—",N(${QM}!$I$${k})+SUMIFS(${CC('L')},${CC('C')},${mid})))`, { nf: EURN, border: true });
    ws.put(r, 7, `=IF($A${r}="","",SUMPRODUCT((${CC('C')}=${mid})*(LEN(${CC('F')})>0)))`, { nf: '0', border: true });
  }
  ws.role = 'painel';
  ws.ref = 'painel';
  /* QT, QO referenciados para o índice humano não ficar vazio de dependências de nomes */
  ws.put(80, 1, `=COUNTA(${QT}!$A$2:$A$51)+COUNTA(${QO}!$A$2:$A$13)`, { color: GREY, size: 8 });
  return ws;
}

function ajuda() {
  const ws = new WS('ℹ Ajuda', { color: GREY });
  ws.colW[1] = 4;
  ws.colW[2] = 120;
  const lines = [
    'Como funciona esta folha',
    'Um ficheiro por ano. A app escreve nas células amarelas (✎), que também podes editar à mão. O título do Painel mostra o nome do negócio.',
    'Onde se escreve',
    '• Separador de cada motorista: Tuk do dia, Serviços (ex.: =60+80), Entregue e uma nota por dia. No separador do patrão também Gratificações, que ficam à parte e não entram no Faturado.',
    '• Separador de cada tuk: gastos diários e, por baixo de cada mês, os gastos mensais (Garagem e Manutenção como soma).',
    '• Painel: coluna ✎ Objetivo por motorista, um valor por mês.',
    'Tuks',
    '• Obrigatórios: Número (1 a 50, sem repetir) e Tipo (combustão ou elétrico). Opcionais: Alcunha e Matrícula. Fora do formato AA-00-AA só aparece um aviso.',
    '• Um tuk vendido ou um motorista inativo fica oculto na app e nunca é apagado.',
    'Gastos de fábrica',
    '• Combustível: diário, só nos tuks a combustão.',
    '• Outros: diário.',
    '• Garagem: mensal e fixa. Conta a partir do dia 1 de cada mês, só quando esse mês já chegou. Mudar o valor vale desse mês em diante.',
    '• Manutenção: mensal, escrita como soma (=80+50+10), mesmo com o tuk parado. Não se repete sozinha.',
    'Regras do dia',
    '• Um tuk só tem um motorista por dia. Na app, escolher um tuk ocupado troca logo e o outro fica sem tuk.',
    '• Sem tuk não se registam serviços nem gastos.',
    '• A % é sempre a parte do motorista. O patrão conta para o objetivo e não recebe prémio.',
    '• Faturado = soma dos serviços. Saldo = entregue − parte do patrão.',
    'Não fazer',
    '• Não apagues separadores, a coluna A nem a linha 1: são as chaves da app. Para desativar, usa a app.',
    '• Repor aspeto da folha refaz colunas, larguras, fórmulas, cores e proteções sem mexer nos valores escritos. Se um separador foi apagado, a app pergunta antes de o criar outra vez.'
  ];
  lines.forEach((t, i) => ws.put(i + 1, 2, t, { bold: i === 0 || ['Onde se escreve', 'Tuks', 'Gastos de fábrica', 'Regras do dia', 'Não fazer'].includes(t), wrap: true, size: i === 0 ? 14 : 10, color: NAVY }));
  ws.role = 'ajuda';
  return ws;
}

function estrutura(plan) {
  const ws = new WS('⚙ Estrutura', { hidden: true, color: GREY, freeze: 'A2' });
  fillHeader(ws, 1, ['Tipo', 'Elemento', 'Chave', 'Coluna', 'Notas'], NAVY);
  const rows = [
    ['geral', 'versão', '5', '', 'v4: chaves na coluna A e na linha 1; a app não grava posições fixas'],
    ['geral', 'bloco', 'motorista', '', '36 linhas por mês a partir da linha 7. Dias 1–31, TOTAL, resumo K. Dias que não existem ficam ocultos.'],
    ['geral', 'bloco', 'tuk', '', '45 linhas por mês. Gastos mensais nas chaves M|AAAA-MM|tipo. Linhas livres: M|AAAA-MM|-'],
    ['motorista', 'chaves', 'linha 1', '', 'data, tuk, servicos, gratif, pct_motorista, pmot, ppat, entregas, saldo, nota, nserv'],
    ['motorista', 'entrada', 'servicos', 'E', 'soma (=70+50+90) ou número. Só com tuk.'],
    ['motorista', 'ocultas', 'motorista', 'A, F, M', 'Gratificações só no patrão'],
    ['motorista', 'ocultas', 'patrão', 'A, G, H, I, J, K, M', 'F também se as gratificações estiverem desligadas'],
    ['tuk', 'chaves', 'linha 1', '', 'data, motorista, faturado, type-<id>, fim, aux, desp, lucro, nota, dias'],
    ['tuk', 'entrada', 'fim', 'antes de fim', 'tipo diário novo: coluna nova imediatamente antes da coluna oculta fim'],
    ['tuk', 'entrada', 'mensal', 'D', 'valor na linha M|mês|tipo; linhas M|mês|- são a reserva'],
    ['tuk', 'ocultas', 'elétrico', 'type-g1', 'combustível oculto'],
    ['painel', 'entrada', 'objetivo', 'J10:J21', 'um objetivo por mês, igual para todos os motoristas'],
    ['proteção', 'descrição', 'Calculado', '', 'só as células de entrada ficam livres; o dono da folha continua a poder editar']
  ];
  rows.forEach((row, i) => row.forEach((v, j) => ws.put(i + 2, j + 1, v, { border: true, wrap: true })));
  ws.colW[1] = 16; ws.colW[2] = 16; ws.colW[3] = 22; ws.colW[4] = 18; ws.colW[5] = 90;
  ws.protectRange('A1:E200');
  ws.role = 'estrutura';
  void plan;
  return ws;
}

function resumos(plan) {
  const mot = new WS('👥 Motoristas', { color: NAVY, freeze: 'B4' });
  mot.put(1, 1, `👥 Motoristas — ${plan.year}`, { bold: true, size: 16, color: NAVY });
  mot.put(1, 5, 'A % é a parte que o motorista ganha. O patrão não tem %, entregas, saldo nem prémio.', { italic: true, color: GREY, size: 9 });
  const QM = quoteSheet('⚙ Motoristas');
  const Q = quoteSheet('⚙ Percentagens');
  const CN = quoteSheet('⚙ Consolidado');
  const CC = (col) => `${CN}!$${col}$2:$${col}$5000`;
  ['Motorista', 'Papel', '% do motorista', 'Estado', 'Faturado', 'Abrir'].forEach((h, i) => mot.put(3, i + 1, h, { bold: true, color: 'FFFFFF', bg: NAVY, border: true, size: 9 }));
  for (let i = 0; i < 50; i++) {
    const r = 4 + i;
    const k = i + 2;
    const mid = `${QM}!$A$${k}`;
    mot.put(r, 1, `=IF(${QM}!$B$${k}="","",${QM}!$B$${k})`, { border: true, bold: true });
    mot.put(r, 2, `=IF(A${r}="","",${QM}!$G$${k})`, { border: true });
    mot.put(r, 3, `=IF(A${r}="","",IFERROR(SUMIFS(${Q}!$D$2:$D$500,${Q}!$A$2:$A$500,${mid},${Q}!$C$2:$C$500,MAXIFS(${Q}!$C$2:$C$500,${Q}!$A$2:$A$500,${mid},${Q}!$C$2:$C$500,"<="&TODAY())),""))`, { border: true, nf: PCT });
    mot.put(r, 4, `=IF(A${r}="","",${QM}!$H$${k})`, { border: true });
    mot.put(r, 5, `=IF(A${r}="","",SUMIFS(${CC('F')},${CC('C')},${mid}))`, { border: true, nf: EURN });
    const d = plan.drivers[i];
    mot.put(r, 6, d ? `=HYPERLINK("#gid={{gid:${d.id}}}","abrir →")` : '', { color: '1155CC' });
  }
  mot.protectRange('A1:Z200');
  mot.role = 'resumo-motoristas';

  const tuks = new WS('🛺 Tuks', { color: GREEN, freeze: 'B4' });
  tuks.put(1, 1, `🛺 Tuks — ${plan.year}`, { bold: true, size: 16, color: GREEN });
  const QT = quoteSheet('⚙ Tuks');
  ['Tuk', 'Tipo', 'Estado', 'Faturado', 'Despesas', 'Lucro', 'Abrir'].forEach((h, i) => tuks.put(3, i + 1, h, { bold: true, color: 'FFFFFF', bg: GREEN, border: true, size: 9 }));
  for (let i = 0; i < 50; i++) {
    const r = 4 + i;
    const k = i + 2;
    tuks.put(r, 1, `=IF(${QT}!$A$${k}="","",${QT}!$B$${k}&IF(${QT}!$E$${k}<>""," · "&${QT}!$E$${k},""))`, { border: true, bold: true });
    tuks.put(r, 2, `=IF(A${r}="","",${QT}!$F$${k})`, { border: true });
    tuks.put(r, 3, `=IF(A${r}="","",${QT}!$H$${k})`, { border: true });
    tuks.put(r, 7, plan.tuks[i] ? `=HYPERLINK("#gid={{gid:${plan.tuks[i].id}}}","abrir →")` : '', { color: '1155CC' });
  }
  tuks.protectRange('A1:Z200');
  tuks.role = 'resumo-tuks';

  const gas = new WS('💸 Gastos', { color: RED, freeze: 'C4' });
  gas.put(1, 1, `💸 Gastos — ${plan.year}`, { bold: true, size: 16, color: RED });
  gas.put(1, 4, 'Diários nas colunas dos tuks. Mensais nas linhas de cada mês. A garagem conta quando o mês chega.', { italic: true, color: GREY, size: 9 });
  const QTI = quoteSheet('⚙ Tipos de gasto');
  gas.put(3, 1, 'Tipo', { bold: true, color: 'FFFFFF', bg: RED, border: true });
  gas.put(3, 2, 'Frequência', { bold: true, color: 'FFFFFF', bg: RED, border: true });
  MESES.forEach((nome, i) => gas.put(3, 3 + i, nome.slice(0, 3), { bold: true, color: 'FFFFFF', bg: RED, border: true }));
  for (let i = 0; i < 12; i++) {
    const r = 4 + i;
    gas.put(r, 1, `=IF(${QTI}!$B$${i + 2}="","",${QTI}!$B$${i + 2})`, { border: true, bold: true });
    gas.put(r, 2, `=IF(A${r}="","",${QTI}!$C$${i + 2})`, { border: true });
  }
  gas.protectRange('A1:Z40');
  gas.role = 'resumo-gastos';
  return [mot, tuks, gas];
}

export function buildBook(ctx) {
  const plan = sheetPlan(ctx);
  const sheets = [
    painel(plan),
    ...resumos(plan),
    ...plan.drivers.map(d => driverSheet(plan, d, false)),
    ...plan.tuks.map(t => tukSheet(plan, t, false)),
    ajuda(),
    configSheet(plan),
    ...registrySheets(plan),
    consolidado(plan),
    estrutura(plan),
    driverSheet(plan, { id: 'MODELO', name: '(modelo)', owner: false, title: '⚙ Modelo motorista' }, true),
    tukSheet(plan, { id: 'MODELO', number: 0, nickname: '', fuel: 'combustão', title: '⚙ Modelo tuk' }, true)
  ];
  return { locale: 'pt_PT', year: plan.year, sheets };
}

export function cellMap(ws) {
  const map = new Map();
  for (const c of ws.cells) map.set(c.r + ',' + c.c, c);
  return map;
}

/** Chaves da linha 1 e da coluna A, para gravar sem posições fixas. */
export function keyIndex(ws) {
  const cols = {};
  const rows = {};
  for (const c of ws.cells) {
    if (c.r === 1 && c.c > 1 && c.v) cols[String(c.v)] = c.c;
    if (c.c === 1 && c.r > 1 && c.v) rows[rowKey(c.v)] = c.r;
  }
  return { cols, rows };
}

export function inputCells(ws) {
  return ws.cells.filter(c => c.input);
}

export function contextFromModel(model) {
  const today = model.today || `${model.year}-12-31`;
  return {
    year: model.year,
    businessName: model.businessName,
    tipsEnabled: model.tipsEnabled,
    previousId: model.previousId || '',
    drivers: model.drivers.map(d => ({
      id: d.id, name: d.name, phone: d.phone || '', since: d.since || '', opening: d.opening || 0,
      active: d.active !== false, owner: isOwnerAt(model, d.id, today)
    })),
    tuks: model.tuks.map(t => ({
      id: t.id, number: t.number, nickname: t.nickname || '', plate: t.plate || '',
      fuel: t.fuel, status: t.status || 'ativo', soldOn: t.soldOn || ''
    })),
    dailyTypes: model.types.filter(t => t.active && t.freq === 'Diário'),
    monthlyTypes: model.types.filter(t => t.active && t.freq === 'Mensal'),
    objectives: (model.objectives || []).map(o => o.amount || 0),
    pct: model.pct.map(p => ({ ...p, name: (model.drivers.find(d => d.id === p.driverId) || {}).name || '' })),
    fixed: model.fixed.map(f => ({
      ...f,
      typeName: (model.types.find(t => t.id === f.typeId) || {}).name || '',
      tukName: titleOf(model.tuks.find(t => t.id === f.tukId) || { number: 0 })
    })),
    prizes: model.prizes || []
  };
}

export { driverTitle, tukTitle };
