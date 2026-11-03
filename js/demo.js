/* Dados de demonstração alinhados com os ecrãs aprovados (2 de novembro de 2026). */

import { daysInMonth, iso, monthEnd, pad, round2, sum } from './format.js';
import { blankYear, driverMonth, ensureRecurring, isOwnerAt, sharesOf } from './model.js';

export const DEMO_TODAY = '2026-11-02';

const MONTH_FAT = [3900, 4700, 6800, 8600, 10400, 11200, 12300, 12600, 11800, 12420, 1380, 0];
const MONTH_DESP = [620, 640, 780, 860, 1010, 1060, 1150, 1180, 1120, 1175, 490, 0];
const OBJ = [1500, 1500, 2250, 2250, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 2250];
const YEAR_DRIVER = { m1: 29800, m2: 24100, m3: 26300, m4: 15900 };
const YEAR_TUK = { t1: 33900, t2: 32100, t3: 30100 };

function putDay(model, driverId, date, tukId, services, extra = {}) {
  if (!model.days[driverId]) model.days[driverId] = {};
  model.days[driverId][date] = {
    tukId,
    services: services.slice(),
    grat: extra.grat ? extra.grat.slice() : [],
    entregue: extra.entregue ? extra.entregue.slice() : [],
    note: extra.note || '',
    locked: extra.locked !== false
  };
}

function addDaily(model, tukId, date, typeId, amount) {
  if (!amount) return;
  if (!model.tukDays[tukId]) model.tukDays[tukId] = {};
  if (!model.tukDays[tukId][date]) model.tukDays[tukId][date] = { byType: {}, note: '' };
  const cell = model.tukDays[tukId][date];
  if (!cell.byType[typeId]) cell.byType[typeId] = [];
  cell.byType[typeId].push(round2(amount));
}

function setMonthly(model, tukId, year, month, typeId, parts, note) {
  const key = `${year}-${pad(month)}`;
  if (!model.tukMonths[tukId]) model.tukMonths[tukId] = {};
  if (!model.tukMonths[tukId][key]) model.tukMonths[tukId][key] = {};
  model.tukMonths[tukId][key][typeId] = { parts: parts.slice(), auto: false, note: note || '' };
}

function splitInt(total, n) {
  const k = Math.max(1, n);
  const base = Math.floor(total / k);
  let rem = total - base * k;
  const arr = Array(k).fill(base);
  for (let i = 0; i < arr.length && rem > 0; i++, rem--) arr[i] += 1;
  return arr.filter(x => x > 0);
}

function largestRemainder(weights, total) {
  const ids = Object.keys(weights).filter(id => weights[id] > 0);
  const wsum = ids.reduce((s, id) => s + weights[id], 0);
  const out = {};
  for (const id of Object.keys(weights)) out[id] = 0;
  if (wsum <= 0 || total <= 0) return out;
  const raw = ids.map(id => {
    const exact = total * weights[id] / wsum;
    return { id, floor: Math.floor(exact + 1e-9), frac: exact - Math.floor(exact + 1e-9) };
  });
  let used = raw.reduce((s, r) => s + r.floor, 0);
  raw.sort((a, b) => b.frac - a.frac || (a.id < b.id ? -1 : 1));
  let i = 0;
  while (used < total) {
    raw[i % raw.length].floor += 1;
    used += 1;
    i += 1;
  }
  while (used > total) {
    const j = raw.findIndex(r => r.floor > 0);
    if (j < 0) break;
    raw[j].floor -= 1;
    used -= 1;
  }
  for (const r of raw) out[r.id] = r.floor;
  return out;
}

function octDates() {
  const inList = (arr, d) => arr.includes(d);
  const joaoT1 = [2, 9, 16, 30];
  const joaoT3 = [3, 8, 15, 22];
  const joaoT2 = [1, 5, 6, 7, 10, 12, 13, 14, 17, 19, 21, 23];
  const pedroT2 = [4, 8, 11, 15, 18, 20, 22, 24, 25, 27, 28, 29, 31];
  const mariaSkip = [3, 4, 6, 8, 11, 13, 15, 18, 22, 25];
  const t1Off = [4, 6, 11, 13, 18, 20, 25, 27, 29];
  const nuno = [];
  const maria = [];
  for (let d = 1; d <= 31; d++) {
    if (!inList(t1Off, d) && !inList(joaoT1, d)) nuno.push(d);
    if (!inList(mariaSkip, d)) maria.push(d);
  }
  const isoD = (list) => list.map(d => iso(2026, 10, d));
  return {
    nuno: isoD(nuno),
    joaoT1: isoD(joaoT1),
    joaoT2: isoD(joaoT2),
    joaoT3: isoD(joaoT3),
    maria: isoD(maria),
    pedro: isoD(pedroT2)
  };
}

function placeOctober(model) {
  const D = octDates();
  const nunoRest = D.nuno.filter(dt => !dt.endsWith('-28') && !dt.endsWith('-31'));
  const nunoAmts = splitInt(3165, nunoRest.length);
  putDay(model, 'm1', '2026-10-31', 't1', [80, 65, 50, 50], { locked: true });
  putDay(model, 'm1', '2026-10-28', 't1', [70, 70, 70], { locked: true });
  nunoRest.forEach((dt, i) => putDay(model, 'm1', dt, 't1', [nunoAmts[i]], { locked: true }));

  const joaoT1rest = { '2026-10-02': 100, '2026-10-09': 110, '2026-10-16': 100 };
  putDay(model, 'm2', '2026-10-30', 't1', [70, 60, 60], { locked: true, note: 'Nuno a partir das 12h00' });
  for (const [dt, v] of Object.entries(joaoT1rest)) putDay(model, 'm2', dt, 't1', [v], { locked: true });

  splitInt(2150, D.joaoT2.length).forEach((v, i) => putDay(model, 'm2', D.joaoT2[i], 't2', [v], { locked: true }));
  [150, 150, 150, 140].forEach((v, i) => putDay(model, 'm2', D.joaoT3[i], 't3', [v], { locked: true }));
  splitInt(3410, D.maria.length).forEach((v, i) => putDay(model, 'm3', D.maria[i], 't3', [v], { locked: true }));
  splitInt(2150, D.pedro.length).forEach((v, i) => putDay(model, 'm4', D.pedro[i], 't2', [v], { locked: true }));

  const fuelDays = [];
  for (const id of ['m1', 'm2']) {
    for (const [dt, rec] of Object.entries(model.days[id] || {})) {
      if (dt.startsWith('2026-10-') && rec.tukId === 't1') fuelDays.push(dt);
    }
  }
  fuelDays.sort();
  const fuelSpecial = { '2026-10-31': 25, '2026-10-30': 18, '2026-10-28': 20 };
  const rest = fuelDays.filter(dt => !(dt in fuelSpecial));
  const restFuel = splitInt(317, rest.length);
  for (const [dt, v] of Object.entries(fuelSpecial)) addDaily(model, 't1', dt, 'g1', v);
  rest.forEach((dt, i) => addDaily(model, 't1', dt, 'g1', restFuel[i]));
  addDaily(model, 't1', '2026-10-01', 'g2', 8);
  addDaily(model, 't1', '2026-10-03', 'g2', 7);
  addDaily(model, 't1', '2026-10-05', 'g2', 5);
  setMonthly(model, 't1', 2026, 10, 'g4', [80, 50, 10], 'Travões + pneu + lâmpada');
  setMonthly(model, 't2', 2026, 10, 'g4', [140], '');
  setMonthly(model, 't3', 2026, 10, 'g4', [120], '');
  if (!model.tukDays.t1['2026-10-29']) model.tukDays.t1['2026-10-29'] = { byType: {}, note: '' };
  model.tukDays.t1['2026-10-29'].note = 'manutenção 50 €';
}

function placeNovember(model) {
  putDay(model, 'm1', '2026-11-02', 't1', [60, 70, 55], { locked: true, grat: [15] });
  putDay(model, 'm1', '2026-11-01', 't1', [355], { locked: true });
  putDay(model, 'm2', '2026-11-02', 't2', [70, 50, 90, 40], { locked: true, entregue: [100] });
  putDay(model, 'm2', '2026-11-01', 't2', [80, 80], { locked: true });
  putDay(model, 'm3', '2026-11-02', 't3', [70, 60, 60, 60, 60], { locked: true });
  putDay(model, 'm4', '2026-11-01', 't3', [60, 60], { locked: true });
  addDaily(model, 't1', '2026-11-02', 'g1', 25);
  addDaily(model, 't1', '2026-11-02', 'g2', 8);
  addDaily(model, 't1', '2026-11-01', 'g1', 82);
  const rec = model.days.m3['2026-11-02'];
  const sh = sharesOf(model, 'm3', '2026-11-02', rec);
  rec.entregue = [sh.owner];
}

function taken(model, date, driverId, tukId) {
  for (const [id, bag] of Object.entries(model.days)) {
    const rec = bag[date];
    if (!rec) continue;
    if (id === driverId) return true;
    if (rec.tukId === tukId) return true;
  }
  return false;
}

function placeCells(model, year, month, cells) {
  const dim = daysInMonth(year, month);
  const chunks = [];
  for (const cell of cells) {
    const n = Math.max(1, Math.round(cell.amount / 130));
    for (const amount of splitInt(cell.amount, n)) chunks.push({ driverId: cell.driverId, tukId: cell.tukId, amount });
  }
  chunks.sort((a, b) => b.amount - a.amount);
  for (const ch of chunks) {
    let placed = false;
    for (let d = 1; d <= dim; d++) {
      const date = iso(year, month, d);
      if (taken(model, date, ch.driverId, ch.tukId)) continue;
      putDay(model, ch.driverId, date, ch.tukId, [ch.amount], { locked: false });
      placed = true;
      break;
    }
    if (!placed) {
      const bag = model.days[ch.driverId] || {};
      const hit = Object.entries(bag).find(([date, rec]) => !rec.locked && rec.tukId === ch.tukId && date.startsWith(`${year}-${pad(month)}`));
      if (!hit) throw new Error(`Sem dia livre em ${year}-${month} para ${ch.driverId}/${ch.tukId}`);
      hit[1].services[0] += ch.amount;
    }
  }
}

function distributeRest(model) {
  const placedD = { m1: 0, m2: 0, m3: 0, m4: 0 };
  const placedT = { t1: 0, t2: 0, t3: 0 };
  for (const [id, bag] of Object.entries(model.days)) {
    for (const rec of Object.values(bag)) {
      const fat = sum(rec.services);
      if (placedD[id] != null) placedD[id] += fat;
      if (rec.tukId && placedT[rec.tukId] != null) placedT[rec.tukId] += fat;
    }
  }
  const remD = {};
  const remT = {};
  for (const id of Object.keys(YEAR_DRIVER)) remD[id] = YEAR_DRIVER[id] - placedD[id];
  for (const id of Object.keys(YEAR_TUK)) remT[id] = YEAR_TUK[id] - placedT[id];
  for (let m = 1; m <= 9; m++) {
    const dAmt = largestRemainder({ ...remD }, MONTH_FAT[m - 1]);
    const tAmt = largestRemainder({ ...remT }, MONTH_FAT[m - 1]);
    const cells = [];
    const D = Object.entries(dAmt).map(([id, left]) => ({ id, left }));
    const T = Object.entries(tAmt).map(([id, left]) => ({ id, left }));
    for (const d of D) {
      for (const t of T) {
        if (d.left <= 0) break;
        const take = Math.min(d.left, t.left);
        if (take > 0) {
          cells.push({ driverId: d.id, tukId: t.id, amount: take });
          d.left -= take;
          t.left -= take;
        }
      }
      if (d.left !== 0) throw new Error(`Transporte ${m} ${d.id} sobra ${d.left}`);
    }
    placeCells(model, 2026, m, cells);
    for (const id of Object.keys(remD)) remD[id] -= dAmt[id];
    for (const id of Object.keys(remT)) remT[id] -= tAmt[id];
  }
}

function countWorked(model, unlockedOnly) {
  let n = 0;
  for (const bag of Object.values(model.days)) {
    for (const rec of Object.values(bag)) {
      if (unlockedOnly && rec.locked) continue;
      if (rec.tukId && sum(rec.services) > 0) n += 1;
    }
  }
  return n;
}

function freeDate(model, driverId, tukId, year, month) {
  const dim = daysInMonth(year, month);
  for (let d = 1; d <= dim; d++) {
    const date = iso(year, month, d);
    if (!taken(model, date, driverId, tukId)) return date;
  }
  return '';
}

function tuneDays(model, targetUnlocked) {
  let guard = 0;
  while (countWorked(model, true) < targetUnlocked && guard++ < 20000) {
    const cands = [];
    for (const [driverId, bag] of Object.entries(model.days)) {
      for (const [date, rec] of Object.entries(bag)) {
        if (rec.locked || !rec.tukId) continue;
        const fat = sum(rec.services);
        if (fat >= 2) cands.push({ driverId, date, rec, fat });
      }
    }
    cands.sort((a, b) => b.fat - a.fat);
    let found = null;
    for (const c of cands) {
      const y = Number(c.date.slice(0, 4));
      const m = Number(c.date.slice(5, 7));
      const date = freeDate(model, c.driverId, c.tukId, y, m);
      if (date) { found = { ...c, newDate: date }; break; }
    }
    if (!found) break;
    const move = Math.max(1, Math.floor(found.fat / 2));
    found.rec.services = [found.fat - move];
    putDay(model, found.driverId, found.newDate, found.tukId, [move], { locked: false });
  }
  let mergeGuard = 0;
  while (countWorked(model, true) > targetUnlocked && mergeGuard++ < 8000) {
    const groups = {};
    for (const [driverId, bag] of Object.entries(model.days)) {
      for (const [date, rec] of Object.entries(bag)) {
        if (rec.locked || !rec.tukId || !(sum(rec.services) > 0)) continue;
        const k = driverId + '|' + rec.tukId + '|' + date.slice(0, 7);
        (groups[k] = groups[k] || []).push({ driverId, date, rec });
      }
    }
    let pair = null;
    for (const list of Object.values(groups)) {
      if (list.length >= 2) { pair = list; break; }
    }
    if (!pair) break;
    pair.sort((a, b) => sum(a.rec.services) - sum(b.rec.services));
    const drop = pair[0];
    const keep = pair[1];
    keep.rec.services = [sum(keep.rec.services) + sum(drop.rec.services)];
    delete model.days[drop.driverId][drop.date];
  }
}

function garageOf(month) {
  if (month >= 12) return 0;
  if (month <= 6) return 360;
  return 375;
}

function placeOtherExpenses(model) {
  const budgets = [];
  for (let m = 1; m <= 9; m++) budgets.push(MONTH_DESP[m - 1] - garageOf(m));
  let fuelL = 2933, outL = 422, maiL = 1780;
  const plan = [];
  for (let i = 0; i < budgets.length; i++) {
    const last = i === budgets.length - 1;
    const budget = budgets[i];
    let f, o, mm;
    if (last) {
      f = fuelL; o = outL; mm = maiL;
      if (f + o + mm !== budget) {
        mm = budget - f - o;
        maiL = mm;
      }
    } else {
      f = Math.min(fuelL, Math.max(0, Math.round(budget * 2933 / 5135)));
      o = Math.min(outL, Math.max(0, budget - f === 0 ? 0 : Math.round(budget * 422 / 5135)));
      mm = budget - f - o;
      if (mm > maiL) { const over = mm - maiL; mm = maiL; f += over; }
      if (mm < 0) { f = Math.max(0, f + mm); mm = 0; }
      if (f > fuelL) { o += f - fuelL; f = fuelL; }
    }
    fuelL -= f; outL -= o; maiL -= mm;
    plan.push({ m: i + 1, f, o, mm });
  }
  for (const row of plan) {
    if (row.mm) setMonthly(model, 't1', 2026, row.m, 'g4', [row.mm], '');
    const t1days = [];
    for (const bag of Object.values(model.days)) {
      for (const [date, rec] of Object.entries(bag)) {
        if (rec.tukId === 't1' && date.startsWith(`2026-${pad(row.m)}`)) t1days.push(date);
      }
    }
    t1days.sort();
    if (row.f) {
      const parts = splitInt(row.f, Math.min(t1days.length || 1, Math.max(1, Math.round(row.f / 18))));
      if (!t1days.length) addDaily(model, 't1', iso(2026, row.m, 1), 'g1', row.f);
      else parts.forEach((v, i) => addDaily(model, 't1', t1days[i % t1days.length], 'g1', v));
    }
    if (row.o) {
      const host = t1days[0] || iso(2026, row.m, 1);
      addDaily(model, 't2', host, 'g2', row.o);
    }
  }
}

function placeGrat(model) {
  const dates = [];
  for (const [date, rec] of Object.entries(model.days.m1 || {})) {
    if (date === '2026-11-02') continue;
    if (sum(rec.services) > 0) dates.push(date);
  }
  dates.sort();
  let cents = 127980;
  for (const date of dates) {
    if (cents <= 0) break;
    const take = cents >= 1500 ? 1500 : cents;
    model.days.m1[date].grat.push(round2(take / 100));
    cents -= take;
  }
  if (cents > 0) model.days.m1['2026-11-02'].grat.push(round2(cents / 100));
}

function placeHandovers(model) {
  for (const id of ['m2', 'm3', 'm4']) {
    const r = driverMonth(model, id, 2026, 10);
    const target = id === 'm2' ? round2(r.ownerPart - 25) : r.ownerPart;
    const bag = model.days[id];
    const dates = Object.keys(bag).filter(dt => dt.startsWith('2026-10-') && bag[dt].tukId).sort();
    const last = dates[dates.length - 1];
    bag[last].entregue = [target];
  }
}

export function buildDemo() {
  const model = blankYear(2026);
  model.today = DEMO_TODAY;
  model.businessName = 'Tuks Demo';
  model.tipsEnabled = true;
  model.objectives = OBJ.map((amount, i) => ({ month: i + 1, amount }));
  model.prizes = [
    { from: '2026-01-01', active: true, amount: 80 },
    { from: '2026-11-01', active: true, amount: 100 }
  ];
  model.tuks = [
    { id: 't1', number: 1, nickname: 'Azul', plate: 'AT-27-QL', fuel: 'combustão', status: 'ativo', soldOn: '' },
    { id: 't2', number: 2, nickname: 'Verde', plate: 'AB-34-CD', fuel: 'elétrico', status: 'ativo', soldOn: '' },
    { id: 't3', number: 3, nickname: 'Amarelo', plate: '', fuel: 'elétrico', status: 'ativo', soldOn: '' },
    { id: 't4', number: 4, nickname: 'Branco', plate: 'AD-78-EF', fuel: 'combustão', status: 'vendido', soldOn: '2026-05-15' }
  ];
  model.drivers = [
    { id: 'm1', name: 'Nuno', phone: '', since: '2026-01-01', active: true, opening: 0 },
    { id: 'm2', name: 'João', phone: '', since: '2026-01-01', active: true, opening: 0 },
    { id: 'm3', name: 'Maria', phone: '', since: '2026-01-01', active: true, opening: 0 },
    { id: 'm4', name: 'Pedro', phone: '', since: '2026-01-01', active: true, opening: 0 },
    { id: 'm5', name: 'Rui', phone: '', since: '2026-01-01', active: false, opening: 0 }
  ];
  model.pct = [
    { driverId: 'm1', from: '2026-01-01', pct: 0, role: 'patrão' },
    { driverId: 'm2', from: '2026-01-01', pct: 0.5, role: 'motorista' },
    { driverId: 'm3', from: '2026-01-01', pct: 0.5, role: 'motorista' },
    { driverId: 'm3', from: '2026-03-01', pct: 0.55, role: 'motorista' },
    { driverId: 'm4', from: '2026-01-01', pct: 0.35, role: 'motorista' },
    { driverId: 'm4', from: '2026-06-01', pct: 0.4, role: 'motorista' },
    { driverId: 'm5', from: '2026-01-01', pct: 0.45, role: 'motorista' }
  ];
  model.fixed = [
    { typeId: 'g3', tukId: 't1', from: '2026-01-01', amount: 120 },
    { typeId: 'g3', tukId: 't2', from: '2026-01-01', amount: 120 },
    { typeId: 'g3', tukId: 't3', from: '2026-01-01', amount: 120 },
    { typeId: 'g3', tukId: 't3', from: '2026-07-01', amount: 135 }
  ];
  model.prior = [4800, 5200, 6400, 7600, 9800, 10400, 11200, 12000, 10800, 11600, 8600, 7200]
    .map((faturado, i) => ({ faturado, workers: i === 10 ? 3 : 4 }));
  model.notices = [{ id: 'seed-swap', date: '2026-11-02', fromId: 'm4', toId: 'm2', tukId: 't2', time: '9:40' }];

  placeOctober(model);
  placeNovember(model);
  distributeRest(model);
  const unlocked = countWorked(model, true);
  const locked = countWorked(model, false) - unlocked;
  tuneDays(model, 611 - locked);
  placeOtherExpenses(model);
  placeGrat(model);
  placeHandovers(model);
  ensureRecurring(model);
  return model;
}

export function demoReady() {
  const model = buildDemo();
  if (isOwnerAt(model, 'm1', DEMO_TODAY) !== true) throw new Error('demo');
  if (monthEnd(2026, 10) !== '2026-10-31') throw new Error('end');
  return model;
}
