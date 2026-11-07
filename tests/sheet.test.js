import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBook, keyIndex, ptFormula } from '../js/sheet.js';

function badComma(formula) {
  let q = false;
  for (const ch of formula) {
    if (ch === '"') q = !q;
    else if (!q && ch === ',') return true;
  }
  return false;
}

const book = buildBook({
  year: 2026,
  businessName: 'Tuks Demo',
  tipsEnabled: true,
  drivers: [
    { id: 'm1', name: 'Nuno', owner: true, since: '2026-01-01', opening: 0, active: true },
    { id: 'm2', name: 'João', owner: false, since: '2026-01-01', opening: -40, active: true }
  ],
  tuks: [
    { id: 't1', number: 1, nickname: 'Azul', plate: 'AT-27-QL', fuel: 'combustão', status: 'ativo' },
    { id: 't2', number: 2, nickname: 'Verde', plate: '', fuel: 'elétrico', status: 'ativo' }
  ],
  objectives: [1500, 1500, 2250, 2250, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 2250],
  pct: [
    { driverId: 'm1', name: 'Nuno', from: '2026-01-01', pct: 0, role: 'patrão' },
    { driverId: 'm2', name: 'João', from: '2026-01-01', pct: 0.5, role: 'motorista' }
  ],
  prizes: [{ from: '2026-01-01', active: true, amount: 80 }]
});

test('separadores v4', () => {
  const titles = book.sheets.map(s => s.title);
  for (const name of ['📊 Painel', '👥 Motoristas', '🛺 Tuks', '💸 Gastos', 'ℹ Ajuda', '⚙ Config', '⚙ Tuks', '⚙ Motoristas', '⚙ Percentagens', '⚙ Tipos de gasto', '⚙ Gastos fixos', '⚙ Objetivos', '⚙ Prémio', '⚙ Consolidado', '⚙ Registo', '⚙ Estrutura', '⚙ Modelo motorista', '⚙ Modelo tuk']) {
    assert.ok(titles.includes(name), name);
  }
  assert.ok(titles.includes('👑 Nuno (patrão)'));
  assert.ok(titles.includes('👤 João'));
  assert.ok(titles.some(t => t.includes('Tuk 01') && t.includes('Azul')));
  assert.equal(book.sheets.filter(s => s.hidden).length > 8, true);
});

test('chaves, fim e dias que não existem', () => {
  const nuno = book.sheets.find(s => s.ref === 'm1');
  const idx = keyIndex(nuno);
  assert.equal(idx.cols.servicos > 0, true);
  assert.equal(idx.cols.gratif > 0, true);
  assert.equal(idx.rows['2026-01-15'] > 0, true);
  assert.equal(idx.rows['2026-02-28'] > 0, true);
  assert.equal(idx.rows['2026-02-29'], undefined);
  assert.ok(nuno.hideRow.includes(73));
  assert.ok(nuno.hideCol.includes('F') === false);
  assert.ok(nuno.hideCol.includes('G'));
  const joao = book.sheets.find(s => s.ref === 'm2');
  assert.ok(joao.hideCol.includes('F'));
  const verde = book.sheets.find(s => s.ref === 't2');
  const tk = keyIndex(verde);
  assert.equal(tk.cols.fim > tk.cols['type-g1'], true);
  assert.ok(verde.hideCol.includes('F'));
  assert.equal(tk.rows['M|2026-10|g3'] > 0, true);
  assert.equal(tk.rows['M|2026-10|-'] > 0, true);
});

test('fórmulas com ponto e vírgula e entradas livres', () => {
  for (const ws of book.sheets) {
    for (const c of ws.cells) {
      if (typeof c.v === 'string' && c.v.startsWith('=')) assert.equal(badComma(c.v), false, ws.title + ' ' + c.v.slice(0, 80));
    }
  }
  const nuno = book.sheets.find(s => s.ref === 'm1');
  const day = nuno.cells.find(c => c.input && c.c === keyIndex(nuno).cols.servicos && c.r === keyIndex(nuno).rows['2026-06-01']);
  assert.ok(day);
  assert.equal(String(day.v || ''), '');
  assert.ok(nuno.protect.some(p => p.startsWith('G1:I')));
  assert.equal(ptFormula('=SUM(A1,B1)'), '=SUM(A1;B1)');
  assert.equal(ptFormula('=TEXT(A1,"#,##0.00")'), '=TEXT(A1;"#,##0.00")');
  const painel = book.sheets.find(s => s.title === '📊 Painel');
  const lucro = painel.cells.find(c => c.r === 10 && c.c === 8);
  assert.match(String(lucro.v), /SUMIFS/);
  assert.match(String(lucro.v), /\$J\$/);
  assert.doesNotMatch(String(lucro.v), /B10-G10/);
  const label = painel.cells.find(c => String(c.v).includes('Lucro'));
  assert.match(String(label.v), /parte da empresa/);
  const tuk = book.sheets.find(s => s.ref === 't1');
  const idx = keyIndex(tuk);
  const header = tuk.cells.find(c => c.r === 5 && c.c === 5);
  assert.match(String(header.v), /SUMIFS/);
  assert.doesNotMatch(String(header.v), /B5-D5/);
  const dayLucro = tuk.cells.find(c => c.r === idx.rows['2026-06-01'] && c.c === tuk.layout.lucroC);
  assert.match(String(dayLucro.v), /\$J\$/);
  assert.doesNotMatch(String(dayLucro.v), /N\(E/);
  const total = tuk.cells.find(c => c.r === idx.rows['T|2026-06'] && c.c === tuk.layout.lucroC);
  assert.match(String(total.v), /SUM\(/);
  const resumo = book.sheets.find(s => s.title === '🛺 Tuks');
  const resumoLucro = resumo.cells.find(c => c.r === 4 && c.c === 6);
  assert.match(String(resumoLucro.v), /SUMIFS/);
  assert.match(String(resumoLucro.v), /\$AE\$/);
});
