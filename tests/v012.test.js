import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apply, blankYear, companyOf, dayCompany, monthView, tukMonth, tukOf } from '../js/model.js';
import { accountsDiffer, authCall } from '../js/google.js';
import { renamePlan, yearFileName } from '../js/remote.js';

function day(tukId, services) {
  return { tukId, services, grat: [], entregue: [], note: '' };
}

test('lucro do tuk é a parte da empresa, e o faturado bruto fica à parte', () => {
  const m = blankYear(2026);
  m.today = '2026-11-03';
  m.drivers = [
    { id: 'o', name: 'Patrão', active: true },
    { id: 'e', name: 'Empregado', active: true },
    { id: 'a', name: 'Antigo', active: true }
  ];
  m.pct = [
    { driverId: 'o', from: '1970-01-01', pct: 0, role: 'patrão' },
    { driverId: 'e', from: '1970-01-01', pct: 0.5, role: 'motorista' },
    { driverId: 'e', from: '2026-06-01', pct: 0.4, role: 'motorista' },
    { driverId: 'a', from: '1970-01-01', pct: 0, role: 'patrão' }
  ];
  m.tuks = [
    { id: 't1', number: 1, status: 'ativo', fuel: 'combustão', soldOn: '' },
    { id: 't2', number: 2, status: 'ativo', fuel: 'combustão', soldOn: '' }
  ];
  m.days = {
    e: {
      '2026-05-02': day('t1', [100]),
      '2026-06-02': day('t1', [100])
    },
    o: { '2026-06-03': day('t2', [80]) },
    a: { '2026-06-03': day('t1', [50]) }
  };
  m.tukDays = { t1: { '2026-06-02': { byType: { g1: [10] }, note: '' } } };
  assert.equal(companyOf(m, 'e', '2026-05-02', m.days.e['2026-05-02']), 50);
  assert.equal(companyOf(m, 'e', '2026-06-02', m.days.e['2026-06-02']), 60);
  const junho = tukMonth(m, 't1', 2026, 6);
  assert.equal(junho.fat, 150);
  assert.equal(junho.empresa, 110);
  assert.equal(junho.desp, 10);
  assert.equal(junho.lucro, 100);
  const dono = tukMonth(m, 't2', 2026, 6);
  assert.equal(dono.fat, 80);
  assert.equal(dono.empresa, 80);
  assert.equal(dono.lucro, 80);
  const mv = monthView(m, 2026, 6);
  const soma = Math.round(mv.tuks.reduce((s, t) => s + t.lucro, 0) * 100) / 100;
  assert.equal(soma, mv.lucro);
  assert.equal(mv.fat, 230);
});

test('o tuk de ontem mantém-se, sem serviços fantasma nem conflitos', () => {
  const m = blankYear(2026);
  m.today = '2026-11-04';
  m.drivers = [
    { id: 'a', name: 'Ana', active: true },
    { id: 'b', name: 'Bruno', active: true },
    { id: 'c', name: 'Carlos', active: false }
  ];
  m.pct = [
    { driverId: 'a', from: '1970-01-01', pct: 0, role: 'patrão' },
    { driverId: 'b', from: '1970-01-01', pct: 0.4, role: 'motorista' },
    { driverId: 'c', from: '1970-01-01', pct: 0.5, role: 'motorista' }
  ];
  m.tuks = [
    { id: 't1', number: 1, status: 'ativo', fuel: 'combustão', soldOn: '' },
    { id: 't2', number: 2, status: 'ativo', fuel: 'elétrico', soldOn: '' },
    { id: 't3', number: 3, status: 'vendido', fuel: 'combustão', soldOn: '2026-11-03' }
  ];
  m.days = {
    a: { '2026-11-02': day('t1', [40]) },
    b: { '2026-11-02': day('t2', [100]) },
    c: { '2026-11-02': day('t1', [80]) }
  };
  const next = dayCompany(m, '2026-11-03');
  assert.equal(next.people.find(p => p.driver.id === 'a').tuk.id, 't1');
  assert.equal(next.people.find(p => p.driver.id === 'b').tuk.id, 't2');
  assert.equal(next.people.find(p => p.driver.id === 'c'), undefined);
  assert.equal(next.working, 0);
  assert.equal(next.fat, 0);
  assert.equal(next.people.every(p => p.services === 0), true);
  const added = apply(m, { type: 'add-service', driverId: 'b', date: '2026-11-03', amount: 25 });
  assert.equal(added.error, '');
  assert.equal(added.model.days.b['2026-11-03'].tukId, 't2');
  assert.deepEqual(added.model.days.b['2026-11-03'].services, [25]);
  assert.equal(dayCompany(added.model, '2026-11-03').working, 1);
  assert.equal(added.model.days.b['2026-11-02'].services.length, 1);
  const swap = apply(m, { type: 'assign-tuk', driverId: 'b', date: '2026-11-03', tukId: 't1', time: '9:00' });
  assert.match(swap.toast, /Ana ficou sem tuk/);
  assert.equal(swap.model.days.b['2026-11-03'].tukId, 't1');
  assert.equal(swap.model.days.a['2026-11-02'].tukId, 't1');
  assert.equal(tukOf(swap.model, 'a', '2026-11-03'), '');
  assert.equal(tukOf(swap.model, 'b', '2026-11-04'), 't1');
  assert.equal(tukOf(swap.model, 'a', '2026-11-04'), '');
  assert.equal(dayCompany(swap.model, '2026-11-04').working, 0);
  m.days.b['2026-11-01'] = day('t3', [15]);
  assert.equal(tukOf(m, 'b', '2026-11-04'), 't2');
  delete m.days.b['2026-11-02'];
  assert.equal(tukOf(m, 'b', '2026-11-04'), '');
});

test('mudar o nome só renomeia a folha e a cópia deste ano', () => {
  assert.equal(yearFileName('Casa Nova', 2026, 'main'), 'Casa Nova · 2026');
  assert.equal(yearFileName('Casa Nova', 2026, 'backup'), 'Casa Nova · 2026 (cópia)');
  const files = [
    { id: 'main-1', name: 'Casa Velha · 2026', createdTime: '2026-01-01', appProperties: { tmApp: 'tuk-manager', role: 'main', year: '2026' } },
    { id: 'copia-1', name: 'Casa Velha · 2026 (cópia)', createdTime: '2026-01-02', appProperties: { tmApp: 'tuk-manager', role: 'backup', year: '2026' } },
    { id: 'outro', name: 'Casa Velha · 2025', createdTime: '2025-01-01', appProperties: { tmApp: 'tuk-manager', role: 'main', year: '2025' } }
  ];
  const plan = renamePlan(files, { name: 'Casa Nova', year: 2026, mainId: 'main-1' });
  assert.deepEqual(plan.ops, [
    { id: 'main-1', role: 'main', name: 'Casa Nova · 2026' },
    { id: 'copia-1', role: 'backup', name: 'Casa Nova · 2026 (cópia)' }
  ]);
  assert.equal(renamePlan(files, { name: 'Casa Velha', year: 2026, mainId: 'main-1' }).ops.length, 0);
  const outra = renamePlan(files, { name: 'Casa Nova', year: 2026, mainId: 'nao-existe' });
  assert.equal(outra.mainFound, false);
  assert.equal(outra.ops.length, 0);
  const vazio = renamePlan([], { name: 'Casa Nova', year: 2026, mainId: 'main-1' });
  assert.equal(vazio.ops.length, 0);
  assert.equal(vazio.mainFound, false);
  assert.equal(vazio.backupFound, false);
});

test('a conta guardada entra sem lista; Trocar deixa escolher', () => {
  assert.deepEqual(authCall('choose', 'a@example.com'), { prompt: 'select_account' });
  assert.deepEqual(authCall('silent', 'a@example.com'), { prompt: '', hint: 'a@example.com' });
  assert.deepEqual(authCall('silent', ''), { prompt: '' });
  assert.deepEqual(authCall('first', ''), { prompt: 'select_account' });
  assert.equal(accountsDiffer('conta-a', 'conta-b'), true);
  assert.equal(accountsDiffer('conta-a', 'conta-a'), false);
  assert.equal(accountsDiffer('', 'conta-b'), false);
  assert.equal(accountsDiffer('conta-a', ''), false);
});

test('o texto normal não se seleciona e os campos continuam editáveis', () => {
  const css = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
  assert.match(css, /-webkit-user-select:\s*none/);
  assert.match(css, /user-select:\s*none/);
  assert.match(css, /input,\s*textarea,\s*select,\s*\[contenteditable="true"\],\s*\[contenteditable=""\]\{[^}]*user-select:\s*text/);
  assert.doesNotMatch(css, /touch-action:\s*none/);
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /selectstart/);
  assert.match(app, /contextmenu/);
  assert.match(app, /nativeTextTarget/);
});
