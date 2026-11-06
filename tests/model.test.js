import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemo } from '../js/demo.js';
import { apply, blankYear, dayCompany, monthView, yearView, visibleTuks, plateBad } from '../js/model.js';
import { weekday } from '../js/format.js';

const model = buildDemo();

test('2 de novembro de 2026 é segunda-feira', () => {
  assert.equal(weekday('2026-11-02'), 1);
});

test('hoje: empresa, partes e sem tuk', () => {
  const day = dayCompany(model, '2026-11-02');
  assert.equal(day.fat, 745);
  assert.equal(day.desp, 33);
  assert.equal(day.lucro, 416.5);
  assert.equal(day.working, 3);
  const joao = day.people.find(p => p.driver.id === 'm2');
  assert.equal(joao.sh.fat, 250);
  assert.equal(joao.sh.driver, 125);
  assert.equal(joao.sh.owner, 125);
  assert.equal(joao.due, 25);
  assert.deepEqual(joao.rec.services, [70, 50, 90, 40]);
  const maria = day.people.find(p => p.driver.id === 'm3');
  assert.equal(maria.sh.owner, 139.5);
  assert.equal(maria.entregue, 139.5);
  assert.ok(maria.due <= 0.001);
  const pedro = day.people.find(p => p.driver.id === 'm4');
  assert.equal(pedro.semTuk, true);
  const nuno = day.people.find(p => p.driver.id === 'm1');
  assert.equal(nuno.grat, 15);
  assert.equal(nuno.owner, true);
});

test('pedro sem tuk não lança serviços', () => {
  const r = apply(model, { type: 'add-service', driverId: 'm4', date: '2026-11-02', amount: 40 });
  assert.match(r.error, /tuk/i);
  assert.equal(dayCompany(r.model, '2026-11-02').people.find(p => p.driver.id === 'm4').semTuk, true);
});

test('troca de tuk é imediata', () => {
  const r = apply(model, { type: 'assign-tuk', driverId: 'm4', date: '2026-11-02', tukId: 't2', time: '10:05' });
  assert.match(r.toast, /Pedro ficou sem tuk|João ficou sem tuk|passou/);
  const day = dayCompany(r.model, '2026-11-02');
  const pedro = day.people.find(p => p.driver.id === 'm4');
  const joao = day.people.find(p => p.driver.id === 'm2');
  assert.equal(pedro.rec.tukId, 't2');
  assert.equal(joao.semTuk, true);
});

test('outubro do tuk 01 e da empresa', () => {
  const mv = monthView(model, 2026, 10);
  const t1 = mv.tuks.find(t => t.id === 't1');
  assert.equal(t1.fat, 4120);
  assert.equal(t1.desp, 660);
  assert.equal(t1.lucro, 3460);
  assert.equal(t1.serviceDays, 22);
  assert.equal(t1.who.m1, 18);
  assert.equal(t1.who.m2, 4);
  assert.equal(mv.fat, 12420);
  assert.equal(mv.desp, 1175);
  assert.equal(mv.workers, 4);
  assert.equal(mv.companyObj, 12000);
  assert.equal(mv.ganho, 6729.5);
  const by = Object.fromEntries(mv.drivers.map(d => [d.id, d]));
  assert.equal(by.m1.fat, 3620);
  assert.equal(by.m2.fat, 3240);
  assert.equal(by.m3.fat, 3410);
  assert.equal(by.m4.fat, 2150);
  assert.equal(by.m1.reached, true);
  assert.equal(by.m1.prize, 0);
  assert.equal(by.m2.prize, 80);
  assert.equal(by.m3.prize, 80);
  assert.equal(by.m4.prize, 0);
  assert.equal(by.m2.saldo, -25);
  assert.equal(by.m3.saldo, 0);
  assert.equal(by.m4.saldo, 0);
});

test('ano fecha os totais do ecrã', () => {
  const y = yearView(model);
  assert.equal(y.fat, 96100);
  assert.equal(y.desp, 10085);
  assert.equal(y.lucro, 53542.85);
  assert.equal(y.tukDays, 611);
  assert.equal(y.planned, 123000);
  assert.equal(y.grat, 1294.8);
  assert.deepEqual(y.months.map(m => m.fat), [3900, 4700, 6800, 8600, 10400, 11200, 12300, 12600, 11800, 12420, 1380, 0]);
  assert.deepEqual(y.months.map(m => m.desp), [620, 640, 780, 860, 1010, 1060, 1150, 1180, 1120, 1175, 490, 0]);
  assert.equal(y.byDriver.m1, 29800);
  assert.equal(y.byDriver.m2, 24100);
  assert.equal(y.byDriver.m3, 26300);
  assert.equal(y.byDriver.m4, 15900);
  assert.equal(y.byTuk.t1, 33900);
  assert.equal(y.byTuk.t2, 32100);
  assert.equal(y.byTuk.t3, 30100);
  assert.equal(y.cat.g1, 3420);
  assert.equal(y.cat.g2, 450);
  assert.equal(y.cat.g3, 4035);
  assert.equal(y.cat.g4, 2180);
});

test('garagem futura não conta e a mudança não mexe no passado', () => {
  const nov = monthView(model, 2026, 11);
  const dez = monthView(model, 2026, 12);
  assert.equal(nov.desp, 490);
  assert.equal(dez.desp, 0);
  const changed = apply(model, { type: 'set-fixed', typeId: 'g3', tukId: 't1', year: 2026, month: 11, amount: 200 });
  const oct = monthView(changed.model, 2026, 10);
  const nov2 = monthView(changed.model, 2026, 11);
  assert.equal(oct.tuks.find(t => t.id === 't1').monthlyByType.g3.amount, 120);
  assert.equal(nov2.tuks.find(t => t.id === 't1').monthlyByType.g3.amount, 200);
});

test('matrícula só avisa e números usados não entram', () => {
  assert.equal(plateBad('AT-27-QL'), false);
  assert.equal(plateBad('XX'), true);
  assert.equal(plateBad(''), false);
  const r = apply(model, { type: 'add-tuk', number: 1, fuel: 'elétrico', nickname: 'Preto' });
  assert.match(r.error, /usado/);
  assert.equal(visibleTuks(model, '2026-11-02').some(t => t.id === 't4'), false);
});

test('prémio de novembro é 100 e o de outubro é 80', () => {
  assert.equal(monthView(model, 2026, 10).prize.amount, 80);
  assert.equal(monthView(model, 2026, 11).prize.amount, 100);
  assert.equal(monthView(model, 2026, 11).drivers.find(d => d.id === 'm1').prize, 0);
});

test('lucro da empresa desconta a parte do motorista e todas as despesas', () => {
  const m = blankYear(2026);
  m.drivers = [
    { id: 'o', name: 'Patrão', owner: true, active: true, since: '2026-01-01' },
    { id: 'd', name: 'Meio', owner: false, active: true, since: '2026-01-01' }
  ];
  m.pct = [
    { driverId: 'o', from: '1970-01-01', pct: 0, role: 'patrão' },
    { driverId: 'd', from: '1970-01-01', pct: 0.5, role: 'motorista' }
  ];
  m.tuks = [
    { id: 't1', number: 1, status: 'ativo', fuel: 'combustão' },
    { id: 't2', number: 2, status: 'ativo', fuel: 'combustão' }
  ];
  m.days = {
    o: { '2026-11-02': { tukId: 't1', services: [200], grat: [], entregue: [], note: '' } },
    d: { '2026-11-02': { tukId: 't2', services: [200], grat: [], entregue: [], note: '' } }
  };
  m.tukDays = {
    t1: { '2026-11-02': { byType: { g1: [10] }, note: '' } },
    t2: { '2026-11-02': { byType: { g1: [10] }, note: '' } }
  };
  const day = dayCompany(m, '2026-11-02');
  const meio = day.people.find(p => p.driver.id === 'd');
  assert.equal(meio.sh.driver, 100);
  assert.equal(meio.sh.owner, 100);
  assert.equal(day.fat, 400);
  assert.equal(day.desp, 20);
  assert.equal(day.lucro, 280);
  const mv = monthView(m, 2026, 11);
  assert.equal(mv.lucro, 280);
  assert.equal(mv.ganho, 280);
});
