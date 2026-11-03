import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isoToSerial, rowKey } from '../js/format.js';
import {
  PCT_START, apply, blankYear, isOwnerAt, monthView, normalizePct, pctAt, pctRowsForYear
} from '../js/model.js';
import { cellSame, decideSetup, formatRequests, locateJob } from '../js/remote.js';
import { buildBook } from '../js/sheet.js';
import { diffJobs, rosterNeedsPush } from '../js/store.js';
import { render } from '../js/view.js';
import { buildDemo } from '../js/demo.js';

test('a chave do dia aceita série, fórmula e data escrita', () => {
  const serial = isoToSerial('2026-01-01');
  assert.equal(rowKey(serial), '2026-01-01');
  assert.equal(rowKey(String(serial)), '2026-01-01');
  assert.equal(rowKey('="2026-01-01"'), '2026-01-01');
  assert.equal(rowKey('01/01/2026'), '2026-01-01');
  assert.equal(rowKey('B|2026-01'), 'B|2026-01');
});

test('uma série na coluna A encontra a célula dos serviços', () => {
  const serial = isoToSerial('2026-01-01');
  const keys = { cols: { servicos: 5, tuk: 4 }, rows: { [rowKey(serial)]: 40 } };
  const a1 = locateJob(keys, { title: '👑 Nuno (patrão)', rowKey: '2026-01-01', colKey: 'servicos' });
  assert.equal(a1, "'👑 Nuno (patrão)'!E40");
  assert.equal(locateJob(keys, { title: '👑 Nuno (patrão)', rowKey: '2026-01-02', colKey: 'servicos' }), '');
  assert.equal(locateJob(null, { title: '📊 Painel', direct: 'J10', rowKey: 'obj-1', colKey: 'objetivo' }), "'📊 Painel'!J10");
});

test('célula vazia e zero não bloqueiam a primeira gravação', () => {
  assert.equal(cellSame('', 0), true);
  assert.equal(cellSame('', ''), true);
  assert.equal(cellSame('50', ''), false);
  assert.equal(cellSame('50', 50), true);
});

test('um motorista novo obriga a escrever a folha de pessoas', () => {
  const before = blankYear(2026);
  before.today = '2026-11-03';
  const after = apply(before, { type: 'add-driver', name: 'Paulo', owner: false, pct: 0.5 }).model;
  assert.equal(rosterNeedsPush(before, after), true);
  assert.equal(diffJobs(before, after).some(j => j.title.includes('Motoristas')), false);
});

test('patrão de hoje vale para trás; a mudança começa no dia 1', () => {
  const m = blankYear(2026);
  m.today = '2026-11-03';
  m.drivers.push({ id: 'm1', name: 'Nuno', active: true, since: '2026-11-03', opening: 0 });
  m.pct.push({ driverId: 'm1', from: '2026-11-03', pct: 0, role: 'patrão' });
  assert.equal(pctAt(m, 'm1', '2026-01-01').role, 'patrão');
  assert.equal(pctAt(m, 'm1', '2022-03-04').role, 'patrão');
  normalizePct(m);
  assert.equal(m.pct[0].from, PCT_START);
  const changed = apply(m, { type: 'update-driver', id: 'm1', owner: false, pct: 0.4, from: '2026-11-15' }).model;
  assert.equal(pctAt(changed, 'm1', '2026-10-31').role, 'patrão');
  assert.equal(pctAt(changed, 'm1', '2026-11-01').role, 'motorista');
  assert.equal(pctAt(changed, 'm1', '2026-11-01').pct, 0.4);
  const oldYear = pctRowsForYear(changed, 'm1', 2022);
  assert.equal(oldYear.length, 1);
  assert.equal(oldYear[0].role, 'patrão');
  assert.equal(oldYear[0].from, PCT_START);
  const thisYear = pctRowsForYear(changed, 'm1', 2026);
  assert.equal(thisYear.length, 2);
  assert.equal(thisYear[1].from, '2026-11-01');
  assert.equal(thisYear[1].role, 'motorista');
});

test('vários patrões somam um único ganho', () => {
  let m = blankYear(2026);
  m.today = '2026-11-03';
  m = apply(m, { type: 'add-driver', name: 'Nuno', owner: true }).model;
  m = apply(m, { type: 'add-driver', name: 'Paulo', owner: true }).model;
  const [a, b] = m.drivers;
  assert.equal(isOwnerAt(m, a.id, '2022-01-01'), true);
  assert.equal(isOwnerAt(m, b.id, '2026-11-03'), true);
  m.days[a.id] = { '2026-11-02': { tukId: null, services: [100], grat: [], entregue: [], note: '' } };
  m.days[b.id] = { '2026-11-02': { tukId: null, services: [40], grat: [], entregue: [], note: '' } };
  const mv = monthView(m, 2026, 11);
  assert.equal(mv.drivers.filter(d => d.owner).length, 2);
  assert.equal(mv.ganho, 140);
  assert.equal(m.objectives.every(o => o.amount === 3000), true);
});

test('o aspeto do separador do motorista pede as cores da v4', () => {
  const book = buildBook({
    year: 2026,
    businessName: 'Casa',
    tipsEnabled: true,
    drivers: [{ id: 'm1', name: 'Nuno', owner: true, since: '2026-01-01', active: true }],
    tuks: [{ id: 't1', number: 1, nickname: 'Azul', plate: '', fuel: 'combustão', status: 'ativo' }],
    objectives: Array.from({ length: 12 }, () => 3000)
  });
  const nuno = book.sheets.find(s => s.ref === 'm1');
  const tuk = book.sheets.find(s => s.ref === 't1');
  nuno.sheetId = 7;
  tuk.sheetId = 8;
  const req = formatRequests(nuno);
  const fills = req.filter(r => r.repeatCell && r.repeatCell.cell.userEnteredFormat.backgroundColor);
  const navy = fills.some(r => {
    const c = r.repeatCell.cell.userEnteredFormat.backgroundColor;
    return c.red < 0.2 && c.green > 0.25 && c.green < 0.4 && c.blue > 0.4;
  });
  const input = fills.some(r => {
    const c = r.repeatCell.cell.userEnteredFormat.backgroundColor;
    return c.red > 0.99 && c.green > 0.95 && c.blue > 0.85 && c.blue < 0.95;
  });
  assert.equal(navy, true);
  assert.equal(input, true);
  assert.ok(req.some(r => r.addConditionalFormatRule && String(r.addConditionalFormatRule.rule.booleanRule.condition.values[0].userEnteredValue).includes('$B9=TODAY()')));
  assert.ok(req.some(r => r.repeatCell && r.repeatCell.cell.userEnteredFormat.borders));
  assert.ok(req.some(r => r.updateDimensionProperties && r.updateDimensionProperties.properties.hiddenByUser && r.updateDimensionProperties.range.dimension === 'ROWS'));
  const freeze = req.find(r => r.updateSheetProperties);
  assert.equal(freeze.updateSheetProperties.properties.gridProperties.frozenRowCount, 5);
  assert.equal(freeze.updateSheetProperties.properties.gridProperties.frozenColumnCount, 3);
  const prot = req.find(r => r.addProtectedRange);
  assert.equal(prot.addProtectedRange.protectedRange.description, 'Calculado');
  assert.equal(prot.addProtectedRange.protectedRange.warningOnly, false);
  const tukReq = formatRequests(tuk);
  assert.ok(tukReq.some(r => r.repeatCell && r.repeatCell.cell.userEnteredFormat.backgroundColor && r.repeatCell.cell.userEnteredFormat.backgroundColor.green > 0.35));
});

function screen(route, extra) {
  const model = extra || buildDemo();
  return render({
    ready: true, onboarded: true, mode: 'demo', route, model, date: model.today, month: 11,
    pending: [], toast: '', toastHtml: '', toastOn: false, sheet: null, emailLabel: ''
  });
}

test('a barra de objetivo nunca diz zero e o aviso desaparece', () => {
  const m = blankYear(2026);
  m.businessName = 'Casa';
  m.today = '2026-11-02';
  m.objectives.forEach(o => { o.amount = 0; });
  m.drivers.push({ id: 'm1', name: 'Nuno', active: true, since: '2026-11-02', opening: 0 });
  m.pct.push({ driverId: 'm1', from: PCT_START, pct: 0, role: 'patrão' });
  const html = screen({ name: 'hoje' }, m);
  assert.equal(html.includes('de 0'), false);
  assert.match(html, /3[\s.\u00a0]?000/);
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../js/view.js', import.meta.url), 'utf8');
  assert.equal(app.includes('prompt('), false);
  assert.equal(app.includes('confirm('), false);
  assert.equal(app.includes('alert('), false);
  assert.equal(view.includes('prompt('), false);
  assert.equal(app.includes('Escreve um valor'), false);
  assert.equal(view.includes('Substitui o patrão'), false);
});

test('a preparação reutiliza a folha do ano e não cria uma segunda', () => {
  const tagged = (id, year, role, bytes, created) => ({
    id, name: 'Casa · ' + year, createdTime: created, quotaBytesUsed: String(bytes),
    appProperties: { tmApp: 'tuk-manager', role, year: String(year), ready: '0' }
  });
  const files = [
    tagged('nova', 2026, 'main', 10, '2026-11-03T02:00:00Z'),
    tagged('antiga', 2026, 'main', 8000, '2026-11-01T01:00:00Z'),
    tagged('copia', 2026, 'backup', 8000, '2026-11-01T03:00:00Z'),
    tagged('outro', 2025, 'main', 9000, '2025-01-01T00:00:00Z')
  ];
  assert.equal(decideSetup(files, { role: 'main', year: 2026, title: 'Casa · 2026' }).id, 'antiga');
  assert.equal(decideSetup(files, { role: 'main', year: 2026, preferredId: 'nova', title: 'Casa · 2026' }).id, 'nova');
  assert.equal(decideSetup(files, { role: 'backup', year: 2026 }).action, 'reuse');
  assert.equal(decideSetup(files, { role: 'main', year: 2024, title: 'Casa · 2024' }).action, 'create');
  const orphans = [{ id: 'solta', name: 'Casa · 2026', createdTime: '2026-11-02T00:00:00Z', quotaBytesUsed: '20' }];
  assert.equal(decideSetup(orphans, { role: 'main', year: 2026, title: 'Casa · 2026' }).id, 'solta');
  let creates = 0;
  const box = [];
  const step = () => {
    const d = decideSetup(box, { role: 'main', year: 2026, title: 'Casa · 2026' });
    if (d.action === 'create') {
      creates += 1;
      box.push(tagged('unica', 2026, 'main', 100, '2026-11-03T00:00:00Z'));
      return 'unica';
    }
    return d.id;
  };
  assert.equal(step(), 'unica');
  assert.equal(step(), 'unica');
  assert.equal(creates, 1);
  assert.equal(decideSetup(box, { role: 'backup', year: 2026 }).action, 'create');
  box.push(tagged('copia-1', 2026, 'backup', 10, '2026-11-03T04:00:00Z'));
  assert.equal(decideSetup(box, { role: 'backup', year: 2026 }).id, 'copia-1');
});

test('o ecrã de espera e o tentar outra vez', () => {
  const base = { ready: true, onboarded: false, route: { name: 'inicio' }, mode: null, draft: {}, pending: [], toast: '', toastHtml: '', toastOn: false, sheet: null };
  const wait = render({ ...base, busy: true, busyLabel: 'A criar a folha…' });
  assert.match(wait, /A criar a folha…/);
  assert.match(wait, /class="spin"/);
  assert.match(wait, /disabled/);
  const again = render({ ...base, busy: false, setupError: 'Não consegui acabar a folha.' });
  assert.match(again, /Tentar outra vez/);
  assert.match(again, /Não consegui acabar a folha/);
  assert.equal(again.includes('prompt('), false);
});

test('o ecrã mostra a ficha, o diálogo e o aviso a desaparecer', () => {
  const demo = buildDemo();
  const dia = screen({ name: 'dia', id: 'm2' }, demo);
  assert.match(dia, /data-act="quick"[^>]*>20 €/);
  assert.match(dia, /data-act="add-service"/);
  const pessoas = render({
    ready: true, onboarded: true, mode: 'demo', route: { name: 'pessoas' }, model: (() => {
      let m = blankYear(2026);
      m.businessName = 'Casa';
      m.today = '2026-11-03';
      m = apply(m, { type: 'add-driver', name: 'Nuno', owner: true }).model;
      m = apply(m, { type: 'add-driver', name: 'Paulo', owner: true }).model;
      return m;
    })(),
    date: '2026-11-03', month: 11, pending: [], toast: '', toastHtml: '', toastOn: false, sheet: null
  });
  assert.match(pessoas, /Nuno/);
  assert.match(pessoas, /Paulo/);
  assert.equal((pessoas.match(/Patrão/g) || []).length >= 2, true);
  assert.equal(pessoas.includes('Substitui'), false);
  const dialog = render({
    ready: true, onboarded: true, mode: 'demo', route: { name: 'tipos' }, model: demo,
    date: demo.today, month: 11, pending: [], toast: '', toastHtml: '', toastOn: false,
    sheet: { type: 'rename', id: 'g4', name: 'Manutenção' }
  });
  assert.match(dialog, /Nome do tipo/);
  assert.match(dialog, /value="Manutenção"/);
  assert.equal(dialog.includes('diz'), false);
  const on = render({
    ready: true, onboarded: true, mode: 'demo', route: { name: 'hoje' }, model: demo,
    date: demo.today, month: 11, pending: [], toast: 'Dia a zero', toastHtml: '', toastOn: true, toastErr: false, sheet: null
  });
  const off = render({
    ready: true, onboarded: true, mode: 'demo', route: { name: 'hoje' }, model: demo,
    date: demo.today, month: 11, pending: [], toast: 'Dia a zero', toastHtml: '', toastOn: false, toastErr: false, sheet: null
  });
  assert.match(on, /class="toast show"/);
  assert.match(off, /class="toast"/);
  assert.equal(off.includes('toast show'), false);
});
