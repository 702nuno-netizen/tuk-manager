import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBook } from '../js/sheet.js';
import { decideSetup, formatRequests } from '../js/remote.js';
import {
  STEP_GAP_MS, auditRequests, explainError, orderSheets, planRun, progressText, reconcileIndex, runStages, stepLabel
} from '../js/stages.js';

function book() {
  return buildBook({
    year: 2026,
    businessName: 'Casa',
    tipsEnabled: true,
    drivers: [
      { id: 'm1', name: 'Nuno', owner: true, since: '2026-01-01', active: true },
      { id: 'm2', name: 'Paulo', owner: false, since: '2026-01-01', active: true }
    ],
    tuks: [{ id: 't1', number: 1, nickname: 'Azul', fuel: 'combustão', status: 'ativo' }]
  });
}

test('os separadores escondidos vêm primeiro e o nome do motorista fica limpo', () => {
  const steps = orderSheets(book().sheets);
  assert.equal(steps[0].title.startsWith('⚙'), true);
  assert.ok(steps.findIndex(s => s.role === 'painel') < steps.findIndex(s => s.role === 'motorista'));
  assert.ok(steps.findIndex(s => s.role === 'motorista') < steps.findIndex(s => s.role === 'tuk'));
  const paulo = steps.find(s => s.role === 'motorista' && s.title.includes('Paulo'));
  assert.equal(stepLabel(paulo), 'Paulo');
  assert.equal(progressText(2, 12, 'Paulo'), 'A criar separador 3 de 12: Paulo');
});

test('a retoma salta os separadores prontos e espera entre os outros', async () => {
  const steps = ['cfg', 'painel', 'nuno', 'paulo'];
  const worked = [];
  const sleeps = [];
  const done = await runStages({
    steps,
    doneCount: 2,
    gapMs: STEP_GAP_MS,
    sleep: async (ms) => { sleeps.push(ms); },
    work: async (step) => { worked.push(step); }
  });
  assert.deepEqual(worked, ['nuno', 'paulo']);
  assert.deepEqual(sleeps, [STEP_GAP_MS]);
  assert.equal(done, 4);
  assert.equal(STEP_GAP_MS >= 5000, true);
  const again = [];
  await runStages({
    steps,
    doneCount: done,
    gapMs: STEP_GAP_MS,
    sleep: async () => { throw new Error('não devia esperar'); },
    work: async (step) => { again.push(step); }
  });
  assert.deepEqual(again, []);
  const titles = new Set(['cfg', 'painel']);
  assert.equal(reconcileIndex(steps.map(title => ({ title })), titles, 4), 2);
  assert.equal(planRun(steps, 2).pending.length, 2);
});

test('nenhuma união cruza o congelamento, a linha 1 ou a coluna A', () => {
  const sheets = book().sheets;
  assert.ok(sheets.some(s => s.title === '⚙ Modelo motorista'));
  assert.ok(sheets.some(s => s.title === '⚙ Modelo tuk'));
  for (const ws of sheets) {
    ws.sheetId = 3;
    const faults = auditRequests(ws, formatRequests(ws));
    assert.deepEqual(faults, [], ws.title + ': ' + faults.join(' | '));
  }
});

test('não se cria uma segunda folha e o erro explica a causa', () => {
  const files = [{
    id: 'folha-1',
    name: 'Casa · 2026',
    createdTime: '2026-11-03T00:00:00Z',
    quotaBytesUsed: '100',
    appProperties: { tmApp: 'tuk-manager', role: 'main', year: '2026', ready: '0', setupIndex: '4' }
  }];
  assert.equal(decideSetup(files, { role: 'main', year: 2026, title: 'Casa · 2026' }).action, 'reuse');
  assert.equal(decideSetup(files, { role: 'main', year: 2026, title: 'Casa · 2026' }).id, 'folha-1');
  let creates = 0;
  const step = () => {
    const d = decideSetup(files, { role: 'main', year: 2026, title: 'Casa · 2026' });
    if (d.action === 'create') creates += 1;
    return d.action;
  };
  assert.equal(step(), 'reuse');
  assert.equal(step(), 'reuse');
  assert.equal(creates, 0);
  assert.equal(explainError({ offline: true }), 'sem ligação');
  assert.equal(explainError({ status: 429 }), 'limite do Google (429)');
  const full = 'Não é possível unir células congeladas e não congeladas neste intervalo longo que não pode ser cortado.';
  const body = JSON.stringify({ error: { code: 400, message: full } });
  assert.equal(explainError({ status: 400, body }), full);
});
