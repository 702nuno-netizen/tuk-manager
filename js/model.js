/* Regras do negócio. O mesmo modelo serve a demonstração e a folha. */

import {
  MESES, addDays, cellFromParts, daysInMonth, iso, monthEnd, monthStart, pad, parseISO,
  partsFromCell, plateBad, plateText, round2, sum, tukTitle, ym
} from './format.js';

export function factoryTypes() {
  return [
    { id: 'g1', name: 'Combustível', freq: 'Diário', repeat: false, scope: 'combustão', active: true },
    { id: 'g2', name: 'Outros', freq: 'Diário', repeat: false, scope: 'todos', active: true },
    { id: 'g3', name: 'Garagem', freq: 'Mensal', repeat: true, scope: 'todos', active: true },
    { id: 'g4', name: 'Manutenção', freq: 'Mensal', repeat: false, scope: 'todos', active: true }
  ];
}

export function blankYear(year) {
  return {
    year,
    businessName: '',
    tipsEnabled: true,
    tuks: [],
    drivers: [],
    pct: [],
    types: factoryTypes(),
    fixed: [],
    objectives: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 3000 })),
    prizes: [{ from: iso(year, 1, 1), active: false, amount: 0 }],
    days: {},
    tukDays: {},
    tukMonths: {},
    notices: [],
    prior: null
  };
}

export function driver(model, id) { return model.drivers.find(d => d.id === id) || null; }
export function tuk(model, id) { return model.tuks.find(t => t.id === id) || null; }
export function typeById(model, id) { return model.types.find(t => t.id === id) || null; }

export function activeDrivers(model) {
  return model.drivers.filter(d => d.active);
}

export function visibleTuks(model, date) {
  return model.tuks.filter(t => t.status !== 'vendido' && !(t.soldOn && date && t.soldOn <= date));
}

export const PCT_START = '1970-01-01';

function monthStartOf(date) {
  if (!date || String(date).length < 7) return date || PCT_START;
  return String(date).slice(0, 7) + '-01';
}

/** A primeira linha vale para todo o passado. Uma mudança vale desde o dia 1 desse mês. */
export function pctAt(model, driverId, date) {
  const rows = model.pct.filter(p => p.driverId === driverId).slice().sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
  if (!rows.length) return { driverId, from: '', pct: 0, role: 'motorista' };
  let best = rows[0];
  for (let i = 0; i < rows.length; i++) {
    const start = i === 0 ? '0000-01-01' : monthStartOf(rows[i].from);
    if (start <= date) best = rows[i];
  }
  return best;
}

export function normalizePct(model) {
  const by = {};
  for (const p of model.pct) (by[p.driverId] = by[p.driverId] || []).push(p);
  for (const rows of Object.values(by)) {
    rows.sort((a, b) => a.from < b.from ? -1 : 1);
    if (rows[0].from > PCT_START) rows[0].from = PCT_START;
    for (let i = 1; i < rows.length; i++) rows[i].from = monthStartOf(rows[i].from);
  }
  return model;
}

/** Linhas de % que uma folha desse ano tem de ter. A primeira vale desde sempre; as seguintes, desde o dia 1 do mês. */
export function pctRowsForYear(model, driverId, year) {
  const rows = model.pct.filter(p => p.driverId === driverId).slice().sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
  if (!rows.length) return [];
  const yearStart = iso(year, 1, 1);
  const yearEnd = monthEnd(year, 12);
  const effective = rows.map((p, i) => ({ ...p, start: i === 0 ? PCT_START : monthStartOf(p.from) }));
  const out = [];
  for (let i = 0; i < effective.length; i++) {
    const next = i + 1 < effective.length ? effective[i + 1].start : '9999-12-31';
    if (effective[i].start <= yearEnd && next > yearStart) {
      const role = effective[i].role;
      out.push({
        driverId,
        from: out.length ? effective[i].start : PCT_START,
        pct: role === 'patrão' ? 0 : round2(effective[i].pct),
        role
      });
    }
  }
  return out;
}

export function isOwnerAt(model, driverId, date) {
  return pctAt(model, driverId, date).role === 'patrão';
}

export function currentOwner(model, date) {
  return model.drivers.find(d => isOwnerAt(model, d.id, date)) || null;
}

export function prizeAt(model, year, month) {
  const end = monthEnd(year, month);
  let best = null;
  for (const p of model.prizes) {
    if (p.from <= end && (!best || p.from >= best.from)) best = p;
  }
  if (!best) return { active: false, amount: 0, from: '' };
  return { active: !!best.active, amount: best.active ? round2(best.amount) : 0, from: best.from, raw: round2(best.amount) };
}

export function fixedAt(model, typeId, tukId, year, month) {
  const end = monthEnd(year, month);
  let best = null;
  for (const f of model.fixed) {
    if (f.typeId === typeId && f.tukId === tukId && f.from <= end && (!best || f.from >= best.from)) best = f;
  }
  return best ? round2(best.amount) : 0;
}

export function dayRec(model, driverId, date) {
  return (model.days[driverId] || {})[date] || null;
}

function tukUsable(model, tukId, date) {
  const t = tuk(model, tukId);
  if (!t) return false;
  if (t.soldOn && date >= t.soldOn) return false;
  if (t.status === 'vendido' && !t.soldOn) return false;
  return true;
}

function lastRecordBefore(model, driverId, date) {
  const bag = model.days[driverId] || {};
  let bestDate = '';
  let best = null;
  for (const key of Object.keys(bag)) {
    if (key >= date) continue;
    if (key > bestDate) { bestDate = key; best = bag[key]; }
  }
  if (!best) return null;
  return { date: bestDate, tukId: best.tukId || '' };
}

/** Tuk de cada motorista ativo neste dia: o que está escrito, ou o último que teve, sem criar conflitos. */
export function dayAssignments(model, date) {
  const map = {};
  const taken = new Set();
  const active = activeDrivers(model);
  for (const d of active) {
    const rec = dayRec(model, d.id, date);
    if (!rec) continue;
    const id = rec.tukId && tukUsable(model, rec.tukId, date) ? rec.tukId : '';
    map[d.id] = id;
    if (id) taken.add(id);
  }
  const candidates = [];
  for (const d of active) {
    if (Object.prototype.hasOwnProperty.call(map, d.id)) continue;
    const last = lastRecordBefore(model, d.id, date);
    if (!last || !last.tukId || !tukUsable(model, last.tukId, date)) continue;
    candidates.push({ id: d.id, tukId: last.tukId, since: last.date, order: active.indexOf(d) });
  }
  candidates.sort((a, b) => (a.since < b.since ? 1 : a.since > b.since ? -1 : a.order - b.order));
  for (const c of candidates) {
    if (taken.has(c.tukId)) { map[c.id] = ''; continue; }
    taken.add(c.tukId);
    map[c.id] = c.tukId;
  }
  for (const d of active) if (!Object.prototype.hasOwnProperty.call(map, d.id)) map[d.id] = '';
  return map;
}

export function tukOf(model, driverId, date) {
  return dayAssignments(model, date)[driverId] || '';
}

function ensureDay(model, driverId, date) {
  if (!model.days[driverId]) model.days[driverId] = {};
  if (!model.days[driverId][date]) {
    model.days[driverId][date] = { tukId: null, services: [], grat: [], entregue: [], note: '', locked: false };
  }
  return model.days[driverId][date];
}

export function tukDay(model, tukId, date) {
  return (model.tukDays[tukId] || {})[date] || null;
}

function ensureTukDay(model, tukId, date) {
  if (!model.tukDays[tukId]) model.tukDays[tukId] = {};
  if (!model.tukDays[tukId][date]) model.tukDays[tukId][date] = { byType: {}, note: '' };
  return model.tukDays[tukId][date];
}

export function monthCell(model, tukId, year, month, typeId) {
  const key = ym(year, month);
  return (((model.tukMonths[tukId] || {})[key] || {})[typeId]) || null;
}

function ensureMonthCell(model, tukId, year, month, typeId) {
  const key = ym(year, month);
  if (!model.tukMonths[tukId]) model.tukMonths[tukId] = {};
  if (!model.tukMonths[tukId][key]) model.tukMonths[tukId][key] = {};
  if (!model.tukMonths[tukId][key][typeId]) model.tukMonths[tukId][key][typeId] = { parts: [], auto: false, note: '' };
  return model.tukMonths[tukId][key][typeId];
}

export function monthReached(model, year, month) {
  return monthStart(year, month) <= model.today;
}

export function appliesToTuk(tp, t) {
  if (!tp || !t) return false;
  if (tp.scope === 'combustão' && t.fuel !== 'combustão') return false;
  return true;
}

export function dailyTypes(model, tuk) {
  return model.types.filter(t => t.active && t.freq === 'Diário' && (!tuk || appliesToTuk(t, tuk)));
}

export function monthlyTypes(model) {
  return model.types.filter(t => t.active && t.freq === 'Mensal');
}

function nextId(list, prefix) {
  let n = 0;
  const re = new RegExp('^' + prefix + '(\\d+)$');
  for (const x of list) {
    const m = re.exec(x.id || '');
    if (m) n = Math.max(n, Number(m[1]));
  }
  return prefix + (n + 1);
}

export function driverDays(model, driverId, year, month) {
  const bag = model.days[driverId] || {};
  const prefix = month ? `${year}-${pad(month)}-` : `${year}-`;
  const out = [];
  for (const date of Object.keys(bag)) {
    if (date.startsWith(prefix)) out.push({ date, rec: bag[date] });
  }
  out.sort((a, b) => a.date < b.date ? -1 : 1);
  return out;
}

export function faturadoOf(rec) {
  if (!rec || !rec.services || !rec.services.length) return 0;
  return sum(rec.services);
}

export function workedDay(rec) {
  return !!(rec && rec.services && rec.services.length && faturadoOf(rec) > 0);
}

export function sharesOf(model, driverId, date, rec) {
  const fat = faturadoOf(rec);
  if (!rec || !rec.services.length) return { fat: 0, pct: 0, driver: 0, owner: 0, ownerRole: isOwnerAt(model, driverId, date) };
  const row = pctAt(model, driverId, date);
  const ownerRole = row.role === 'patrão';
  if (ownerRole) return { fat, pct: 0, driver: 0, owner: 0, ownerRole: true };
  const driverPart = round2(fat * row.pct);
  return { fat, pct: row.pct, driver: driverPart, owner: round2(fat - driverPart), ownerRole: false };
}

/** Parte da empresa neste dia: o patrão entra por inteiro; o motorista, com o que sobra da %. */
export function companyOf(model, driverId, date, rec) {
  const sh = sharesOf(model, driverId, date, rec);
  if (!(sh.fat > 0)) return 0;
  return sh.ownerRole ? sh.fat : sh.owner;
}

export function dayExpense(model, tukId, date) {
  const rec = tukDay(model, tukId, date);
  if (!rec) return { total: 0, byType: {} };
  const byType = {};
  let total = 0;
  for (const [id, parts] of Object.entries(rec.byType || {})) {
    const v = sum(parts);
    if (v) { byType[id] = v; total += v; }
  }
  return { total: round2(total), byType };
}

/** Valor mensal que conta: mês já chegou; célula escrita ganha; senão o fixo, se repetir. */
export function monthlyAmount(model, tukId, year, month, typeId) {
  const tp = typeById(model, typeId);
  if (!tp || tp.freq !== 'Mensal') return { amount: 0, parts: [], auto: false, counts: false, note: '' };
  const t = tuk(model, tukId);
  if (t && t.soldOn && monthStart(year, month) > t.soldOn) return { amount: 0, parts: [], auto: false, counts: false, note: '' };
  if (!appliesToTuk(tp, t)) return { amount: 0, parts: [], auto: false, counts: false, note: '' };
  const cell = monthCell(model, tukId, year, month, typeId);
  const parts = cell && cell.parts && cell.parts.length ? cell.parts.slice() : [];
  const written = parts.length ? sum(parts) : null;
  const reached = monthReached(model, year, month);
  if (!reached) return { amount: 0, parts, auto: !!(cell && cell.auto), counts: false, note: cell ? cell.note : '' };
  if (written != null) return { amount: written, parts, auto: !!(cell && cell.auto), counts: true, note: cell ? cell.note : '' };
  if (tp.repeat) {
    const exp = fixedAt(model, typeId, tukId, year, month);
    if (exp > 0) return { amount: exp, parts: [exp], auto: true, counts: true, note: '' };
  }
  return { amount: 0, parts: [], auto: false, counts: false, note: '' };
}

export function whoDrives(model, tukId, date) {
  const map = dayAssignments(model, date);
  const found = [];
  for (const d of model.drivers) {
    if (map[d.id] === tukId) found.push(d);
  }
  return found;
}

export function driverMonth(model, driverId, year, month) {
  const rows = driverDays(model, driverId, year, month);
  let fat = 0, driverPart = 0, ownerPart = 0, entregue = 0, grat = 0, days = 0;
  const end = monthEnd(year, month);
  const ownerNow = isOwnerAt(model, driverId, end);
  for (const { date, rec } of rows) {
    const sh = sharesOf(model, driverId, date, rec);
    fat = round2(fat + sh.fat);
    driverPart = round2(driverPart + sh.driver);
    ownerPart = round2(ownerPart + sh.owner);
    entregue = round2(entregue + sum(rec.entregue));
    grat = round2(grat + sum(rec.grat));
    if (workedDay(rec)) days += 1;
  }
  const opening = driver(model, driverId)?.opening || 0;
  return {
    fat, driverPart, ownerPart, entregue, grat, days, ownerNow,
    saldo: ownerNow ? 0 : round2(entregue - ownerPart),
    saldoAno: ownerNow ? 0 : round2(opening + yearBalance(model, driverId, year))
  };
}

function yearBalance(model, driverId, year) {
  let s = 0;
  for (const { date, rec } of driverDays(model, driverId, year)) {
    const sh = sharesOf(model, driverId, date, rec);
    if (sh.ownerRole) continue;
    s = round2(s + sum(rec.entregue) - sh.owner);
  }
  return s;
}

export function saldoAte(model, driverId, year) {
  const d = driver(model, driverId);
  if (!d) return 0;
  return round2((d.opening || 0) + yearBalance(model, driverId, year));
}

export function tukMonth(model, tukId, year, month) {
  const prefix = `${year}-${pad(month)}-`;
  const bag = model.tukDays[tukId] || {};
  let daily = 0;
  const dailyByType = {};
  const dailyDays = {};
  const who = {};
  let serviceDays = 0;
  let fat = 0;
  let empresa = 0;
  for (const d of model.drivers) {
    for (const { date, rec } of driverDays(model, d.id, year, month)) {
      if (rec.tukId !== tukId) continue;
      const f = faturadoOf(rec);
      const part = companyOf(model, d.id, date, rec);
      if (f > 0) {
        fat = round2(fat + f);
        serviceDays += 1;
        who[d.id] = (who[d.id] || 0) + 1;
      }
      if (part) empresa = round2(empresa + part);
    }
  }
  for (const date of Object.keys(bag)) {
    if (!date.startsWith(prefix)) continue;
    const ex = dayExpense(model, tukId, date);
    daily = round2(daily + ex.total);
    for (const [id, v] of Object.entries(ex.byType)) {
      dailyByType[id] = round2((dailyByType[id] || 0) + v);
      if (!dailyDays[id]) dailyDays[id] = 0;
      if (v > 0) dailyDays[id] += 1;
    }
  }
  let monthly = 0;
  const monthlyByType = {};
  for (const tp of model.types) {
    if (tp.freq !== 'Mensal') continue;
    const info = monthlyAmount(model, tukId, year, month, tp.id);
    if (info.counts && info.amount) {
      monthly = round2(monthly + info.amount);
      monthlyByType[tp.id] = info;
    } else {
      monthlyByType[tp.id] = info;
    }
  }
  const desp = round2(daily + monthly);
  return { fat, empresa, daily, monthly, desp, lucro: round2(empresa - desp), serviceDays, who, dailyByType, dailyDays, monthlyByType };
}

export function monthView(model, year, month) {
  const drivers = [];
  let fat = 0, grat = 0, workers = 0, prizes = 0, ownerFat = 0, ownerParts = 0;
  const obj = (model.objectives.find(o => o.month === month) || {}).amount || 0;
  const prize = prizeAt(model, year, month);
  for (const d of model.drivers) {
    const r = driverMonth(model, d.id, year, month);
    const owner = isOwnerAt(model, d.id, monthEnd(year, month));
    const reached = r.fat > 0 && r.fat + 1e-9 >= obj;
    const gets = !owner && prize.active && reached;
    if (gets) prizes = round2(prizes + prize.amount);
    if (r.days > 0) workers += 1;
    fat = round2(fat + r.fat);
    grat = round2(grat + r.grat);
    if (owner) ownerFat = round2(ownerFat + r.fat);
    else ownerParts = round2(ownerParts + r.ownerPart);
    drivers.push({
      id: d.id, name: d.name, active: d.active, owner, pct: pctAt(model, d.id, monthEnd(year, month)).pct,
      ...r, reached, prize: gets ? prize.amount : 0
    });
  }
  let desp = 0;
  const tuks = [];
  const cat = {};
  for (const t of model.tuks) {
    const tm = tukMonth(model, t.id, year, month);
    desp = round2(desp + tm.desp);
    tuks.push({ id: t.id, ...tm, tuk: t });
    for (const tp of model.types) {
      const add = tp.freq === 'Diário' ? (tm.dailyByType[tp.id] || 0) : ((tm.monthlyByType[tp.id] && tm.monthlyByType[tp.id].counts) ? tm.monthlyByType[tp.id].amount : 0);
      if (add) cat[tp.id] = round2((cat[tp.id] || 0) + add);
    }
  }
  const companyObj = round2(obj * workers);
  const ganho = round2(ownerFat + ownerParts - desp - prizes);
  let tukDays = 0;
  for (const t of tuks) tukDays += t.serviceDays;
  return {
    year, month, obj, prize, fat, desp, lucro: round2(ownerFat + ownerParts - desp), grat, workers, companyObj, prizes,
    ownerFat, ownerParts, ganho, drivers, tuks, cat, tukDays,
    pct: companyObj > 0 ? fat / companyObj : 0
  };
}

export function yearView(model) {
  const year = model.year;
  const months = [];
  let fat = 0, desp = 0, lucro = 0, grat = 0, tukDays = 0, planned = 0;
  const cat = {};
  const byDriver = {};
  const byTuk = {};
  for (const d of model.drivers) byDriver[d.id] = 0;
  for (const t of model.tuks) byTuk[t.id] = 0;
  const activeN = activeDrivers(model).length;
  for (let m = 1; m <= 12; m++) {
    const mv = monthView(model, year, m);
    const plan = round2((model.objectives.find(o => o.month === m)?.amount || 0) * activeN);
    months.push({ month: m, ...mv, plan });
    fat = round2(fat + mv.fat);
    desp = round2(desp + mv.desp);
    lucro = round2(lucro + mv.lucro);
    grat = round2(grat + mv.grat);
    tukDays += mv.tukDays;
    planned = round2(planned + plan);
    for (const [id, v] of Object.entries(mv.cat)) cat[id] = round2((cat[id] || 0) + v);
    for (const d of mv.drivers) byDriver[d.id] = round2((byDriver[d.id] || 0) + d.fat);
    for (const t of mv.tuks) byTuk[t.id] = round2((byTuk[t.id] || 0) + t.fat);
  }
  return {
    year, fat, desp, lucro, grat, tukDays, planned,
    pct: planned > 0 ? fat / planned : 0,
    avg: tukDays ? round2(fat / tukDays) : 0,
    months, cat, byDriver, byTuk, activeN
  };
}

export function dayCompany(model, date) {
  const { y, m } = parseISO(date);
  let fat = 0, desp = 0, company = 0, working = 0;
  const people = [];
  const tukRows = [];
  const assigned = dayAssignments(model, date);
  for (const d of activeDrivers(model)) {
    const rec = dayRec(model, d.id, date);
    const sh = sharesOf(model, d.id, date, rec);
    const owner = sh.ownerRole;
    const tukId = assigned[d.id] || '';
    if (sh.fat > 0 || (rec && rec.services && rec.services.length)) working += sh.fat > 0 || (rec && rec.services.length) ? 1 : 0;
    if (rec && rec.services && rec.services.length && sh.fat === 0) working += 0;
    fat = round2(fat + sh.fat);
    company = round2(company + (owner ? sh.fat : sh.owner));
    const due = owner ? 0 : round2(sh.owner - sum(rec ? rec.entregue : []));
    people.push({
      driver: d, rec, sh, owner, tuk: tukId ? tuk(model, tukId) : null,
      grat: sum(rec ? rec.grat : []),
      entregue: sum(rec ? rec.entregue : []),
      due, services: rec && rec.services ? rec.services.length : 0,
      semTuk: !tukId
    });
  }
  /* working = drivers with a tuk and (services or explicit zero) OR with services */
  working = people.filter(p => p.rec && p.rec.tukId && p.rec.services && p.rec.services.length).length;
  for (const t of model.tuks) {
    if (t.status === 'vendido') continue;
    const ex = dayExpense(model, t.id, date);
    desp = round2(desp + ex.total);
    const drivers = whoDrives(model, t.id, date).filter(d => d.active);
    let tf = 0;
    for (const d of drivers) tf = round2(tf + faturadoOf(dayRec(model, d.id, date)));
    tukRows.push({ tuk: t, ex, drivers, fat: tf });
  }
  const mv = monthView(model, y, m);
  return { date, fat, desp, lucro: round2(company - desp), working, people, tukRows, month: mv };
}

export function suggestFromPrior(prior) {
  if (!prior) return null;
  return prior.map(row => {
    if (!row || !row.workers) return 0;
    return Math.round(row.faturado / row.workers);
  });
}

/** Escreve os gastos fixos que já contam (mês já chegou) quando a célula está vazia. */
export function ensureRecurring(model) {
  const year = model.year;
  for (const tp of model.types) {
    if (!tp.active || tp.freq !== 'Mensal' || !tp.repeat) continue;
    for (const t of model.tuks) {
      if (!appliesToTuk(tp, t)) continue;
      for (let m = 1; m <= 12; m++) {
        if (!monthReached(model, year, m)) continue;
        if (t.soldOn && monthStart(year, m) > t.soldOn) continue;
        const cell = monthCell(model, t.id, year, m, tp.id);
        if (cell && cell.parts && cell.parts.length) continue;
        const amt = fixedAt(model, tp.id, t.id, year, m);
        if (amt > 0) {
          const c = ensureMonthCell(model, t.id, year, m, tp.id);
          c.parts = [amt];
          c.auto = true;
        }
      }
    }
  }
  return model;
}

function pushFixed(model, typeId, tukId, from, amount) {
  const hit = model.fixed.find(f => f.typeId === typeId && f.tukId === tukId && f.from === from);
  if (hit) hit.amount = round2(amount);
  else model.fixed.push({ typeId, tukId, from, amount: round2(amount) });
}

function rewriteAutoFrom(model, typeId, tukId, from, amount) {
  const year = model.year;
  for (let m = 1; m <= 12; m++) {
    if (monthEnd(year, m) < from) continue;
    if (!monthReached(model, year, m)) continue;
    const cell = ensureMonthCell(model, tukId, year, m, typeId);
    cell.parts = amount > 0 ? [round2(amount)] : [];
    cell.auto = true;
  }
}

function requireTuk(model, driverId, date) {
  if (!tukOf(model, driverId, date)) return 'Escolhe primeiro um tuk';
  return '';
}

function materializeTuk(model, driverId, date) {
  const id = tukOf(model, driverId, date);
  if (!id) return null;
  const rec = ensureDay(model, driverId, date);
  if (!rec.tukId) rec.tukId = id;
  return rec;
}

export function apply(model, action) {
  const next = structuredClone(model);
  const res = mutate(next, action) || {};
  return { model: next, toast: res.toast || '', error: res.error || '' };
}

function mutate(model, a) {
  switch (a.type) {
    case 'set-business': {
      const name = String(a.name || '').trim().slice(0, 60);
      if (!name) return { error: 'O negócio precisa de um nome' };
      model.businessName = name;
      return {};
    }
    case 'set-tips': {
      model.tipsEnabled = !!a.on;
      return { toast: a.on ? 'Gratificações ligadas' : 'Gratificações desligadas. A coluna fica escondida; os valores mantêm-se.' };
    }
    case 'assign-tuk': {
      const d = driver(model, a.driverId);
      if (!d || !d.active) return { error: 'Este motorista está inativo' };
      const t = tuk(model, a.tukId);
      if (!t || t.status === 'vendido') return { error: 'Este tuk não está disponível' };
      if (t.soldOn && a.date >= t.soldOn) return { error: 'Este tuk já estava vendido nessa data' };
      let toast = '';
      const holders = model.drivers.filter(other => other.id !== d.id && other.active && tukOf(model, other.id, a.date) === t.id);
      for (const other of holders) {
        const held = ensureDay(model, other.id, a.date);
        held.tukId = null;
        model.notices.unshift({
          id: 'n' + Date.now().toString(36) + holders.indexOf(other),
          date: a.date,
          fromId: other.id,
          toId: d.id,
          tukId: t.id,
          time: a.time || ''
        });
        toast = `${tukTitle(t)} passou para o ${d.name}. O ${other.name} ficou sem tuk.`;
      }
      const rec = ensureDay(model, d.id, a.date);
      rec.tukId = t.id;
      return { toast };
    }
    case 'add-service': {
      const err = requireTuk(model, a.driverId, a.date);
      if (err) return { error: err };
      const amount = round2(a.amount);
      if (!(amount >= 0)) return { error: 'Valor inválido' };
      const rec = materializeTuk(model, a.driverId, a.date);
      if (rec.services.length === 1 && rec.services[0] === 0) rec.services = [];
      rec.services.push(amount);
      return {};
    }
    case 'set-service': {
      const err = requireTuk(model, a.driverId, a.date);
      if (err) return { error: err };
      const rec = materializeTuk(model, a.driverId, a.date);
      if (a.amount == null) rec.services.splice(a.index, 1);
      else rec.services[a.index] = round2(a.amount);
      return {};
    }
    case 'zero-day': {
      const err = requireTuk(model, a.driverId, a.date);
      if (err) return { error: err };
      const rec = materializeTuk(model, a.driverId, a.date);
      rec.services = [0];
      return { toast: 'Dia a zero' };
    }
    case 'add-grat': {
      if (!isOwnerAt(model, a.driverId, a.date)) return { error: 'Só o patrão tem gratificações' };
      if (!model.tipsEnabled) return { error: 'As gratificações estão desligadas' };
      const err = requireTuk(model, a.driverId, a.date);
      if (err) return { error: err };
      const rec = materializeTuk(model, a.driverId, a.date);
      rec.grat.push(round2(a.amount));
      return {};
    }
    case 'set-grat': {
      const rec = ensureDay(model, a.driverId, a.date);
      if (a.amount == null) rec.grat.splice(a.index, 1);
      else rec.grat[a.index] = round2(a.amount);
      return {};
    }
    case 'add-entrega': {
      if (isOwnerAt(model, a.driverId, a.date)) return { error: 'O patrão não entrega' };
      const err = requireTuk(model, a.driverId, a.date);
      if (err) return { error: err };
      const rec = materializeTuk(model, a.driverId, a.date);
      rec.entregue.push(round2(a.amount));
      return {};
    }
    case 'set-entrega': {
      const rec = ensureDay(model, a.driverId, a.date);
      if (a.amount == null) rec.entregue.splice(a.index, 1);
      else rec.entregue[a.index] = round2(a.amount);
      return {};
    }
    case 'set-note': {
      const err = requireTuk(model, a.driverId, a.date);
      if (err) return { error: err };
      const rec = materializeTuk(model, a.driverId, a.date);
      rec.note = String(a.note || '').slice(0, 280);
      return {};
    }
    case 'add-daily': {
      const t = tuk(model, a.tukId);
      const tp = typeById(model, a.typeId);
      if (!t || !tp || tp.freq !== 'Diário' || !tp.active) return { error: 'Tipo de gasto indisponível' };
      if (!appliesToTuk(tp, t)) return { error: 'Este gasto não se aplica a este tuk' };
      const cell = ensureTukDay(model, t.id, a.date);
      if (!cell.byType[tp.id]) cell.byType[tp.id] = [];
      cell.byType[tp.id].push(round2(a.amount));
      return {};
    }
    case 'set-daily': {
      const cell = ensureTukDay(model, a.tukId, a.date);
      const arr = cell.byType[a.typeId] || [];
      if (a.amount == null) arr.splice(a.index, 1);
      else arr[a.index] = round2(a.amount);
      cell.byType[a.typeId] = arr;
      return {};
    }
    case 'set-tuk-note': {
      const cell = ensureTukDay(model, a.tukId, a.date);
      cell.note = String(a.note || '').slice(0, 280);
      return {};
    }
    case 'add-monthly': {
      const tp = typeById(model, a.typeId);
      const t = tuk(model, a.tukId);
      if (!tp || tp.freq !== 'Mensal' || !tp.active) return { error: 'Tipo mensal indisponível' };
      if (!appliesToTuk(tp, t)) return { error: 'Este gasto não se aplica a este tuk' };
      const cell = ensureMonthCell(model, a.tukId, a.year, a.month, tp.id);
      if (cell.auto && cell.parts.length === 1 && tp.repeat) {
        /* passar de valor fixo para soma manual */
      }
      cell.parts = (cell.parts || []).concat([round2(a.amount)]);
      cell.auto = false;
      return {};
    }
    case 'set-monthly-part': {
      const cell = ensureMonthCell(model, a.tukId, a.year, a.month, a.typeId);
      if (a.amount == null) cell.parts.splice(a.index, 1);
      else cell.parts[a.index] = round2(a.amount);
      cell.auto = false;
      return {};
    }
    case 'set-fixed': {
      const from = monthStart(a.year, a.month);
      pushFixed(model, a.typeId, a.tukId, from, a.amount);
      rewriteAutoFrom(model, a.typeId, a.tukId, from, round2(a.amount));
      return { toast: 'Valor novo a partir deste mês. Os meses anteriores ficam como estavam.' };
    }
    case 'set-objective': {
      const row = model.objectives.find(o => o.month === a.month);
      if (row) row.amount = Math.max(0, round2(a.amount));
      return {};
    }
    case 'set-objectives': {
      (a.amounts || []).forEach((v, i) => {
        const row = model.objectives.find(o => o.month === i + 1);
        if (row && v != null) row.amount = Math.max(0, round2(v));
      });
      return { toast: 'Objetivos atualizados. Podes alterar cada mês.' };
    }
    case 'set-prize': {
      const from = monthStart(a.year, a.month);
      const hit = model.prizes.find(p => p.from === from);
      if (hit) { hit.active = !!a.active; hit.amount = round2(a.amount); }
      else model.prizes.push({ from, active: !!a.active, amount: round2(a.amount) });
      model.prizes.sort((x, y) => x.from < y.from ? -1 : 1);
      return { toast: a.active ? 'Prémio atualizado a partir deste mês' : 'Prémio desligado a partir deste mês. O cumprido continua a aparecer.' };
    }
    case 'add-driver': {
      if (model.drivers.length >= 50) return { error: 'O limite é 50 motoristas' };
      const name = String(a.name || '').trim();
      if (!name) return { error: 'Falta o nome' };
      const id = nextId(model.drivers, 'm');
      model.drivers.push({ id, name, phone: '', since: a.since || model.today, active: a.active !== false, opening: 0 });
      const role = a.owner ? 'patrão' : 'motorista';
      model.pct.push({ driverId: id, from: PCT_START, pct: role === 'patrão' ? 0 : round2(a.pct ?? 0.5), role });
      return { toast: `${name} entrou`, id };
    }
    case 'update-driver': {
      const d = driver(model, a.id);
      if (!d) return { error: 'Motorista em falta' };
      if (a.name != null) {
        const name = String(a.name).trim();
        if (!name) return { error: 'Falta o nome' };
        d.name = name;
      }
      if (a.active != null) d.active = !!a.active;
      if (a.owner != null || a.pct != null) {
        const from = monthStart(a.from || model.today);
        const owner = a.owner != null ? !!a.owner : isOwnerAt(model, d.id, from);
        const rows = model.pct.filter(p => p.driverId === d.id);
        const start = rows.length ? from : PCT_START;
        if (owner) upsertPct(model, d.id, rows.length ? start : PCT_START, 0, 'patrão');
        else {
          const pct = a.pct != null ? round2(a.pct) : (pctAt(model, d.id, from).pct || 0.5);
          if (pct < 0 || pct > 1) return { error: 'A percentagem tem de estar entre 0 e 100' };
          upsertPct(model, d.id, rows.length ? start : PCT_START, pct, 'motorista');
        }
      }
      return { toast: 'Motorista atualizado' };
    }
    case 'add-tuk': {
      if (model.tuks.length >= 50) return { error: 'O limite é 50 tuks' };
      const number = Number(a.number);
      if (!(number >= 1 && number <= 50)) return { error: 'Escolhe um número de 1 a 50' };
      if (model.tuks.some(t => t.number === number)) return { error: 'Esse número já está a ser usado' };
      if (a.fuel !== 'combustão' && a.fuel !== 'elétrico') return { error: 'Escolhe combustão ou elétrico' };
      const id = nextId(model.tuks, 't');
      const t = {
        id, number, nickname: String(a.nickname || '').trim(), plate: plateText(a.plate),
        fuel: a.fuel, status: 'ativo', soldOn: ''
      };
      model.tuks.push(t);
      model.tuks.sort((x, y) => x.number - y.number);
      if (a.garage) {
        for (const tp of model.types) {
          if (tp.repeat && tp.freq === 'Mensal' && /garagem/i.test(tp.name)) {
            pushFixed(model, tp.id, id, monthStart(model.year, parseISO(model.today).m), round2(a.garage));
          }
        }
      }
      const warn = plateBad(t.plate) ? ' Matrícula fora do formato AA-00-AA (só um aviso).' : '';
      return { toast: `${tukTitle(t)} adicionado.${warn}`, id };
    }
    case 'update-tuk': {
      const t = tuk(model, a.id);
      if (!t) return { error: 'Tuk em falta' };
      if (a.nickname != null) t.nickname = String(a.nickname).trim();
      if (a.plate != null) t.plate = plateText(a.plate);
      if (a.fuel === 'combustão' || a.fuel === 'elétrico') t.fuel = a.fuel;
      if (a.number != null) {
        const number = Number(a.number);
        if (!(number >= 1 && number <= 50)) return { error: 'Número de 1 a 50' };
        if (model.tuks.some(x => x.id !== t.id && x.number === number)) return { error: 'Esse número já está a ser usado' };
        t.number = number;
      }
      if (a.sold === true) {
        t.status = 'vendido';
        t.soldOn = a.soldOn || model.today;
        const { y, m } = parseISO(model.today);
        for (const tp of model.types) {
          if (tp.freq === 'Mensal' && tp.repeat) {
            pushFixed(model, tp.id, t.id, monthStart(y, m), 0);
            rewriteAutoFrom(model, tp.id, t.id, monthStart(y, m), 0);
          }
        }
      } else if (a.sold === false) {
        t.status = 'ativo';
        t.soldOn = '';
      }
      const warn = plateBad(t.plate) ? ' Matrícula fora do formato AA-00-AA (só um aviso).' : '';
      return { toast: 'Tuk atualizado.' + warn };
    }
    case 'add-type': {
      const name = String(a.name || '').trim();
      if (!name) return { error: 'Falta o nome' };
      if (model.types.some(t => t.active && t.name.toLowerCase() === name.toLowerCase())) return { error: 'Já existe um tipo com esse nome' };
      const freq = a.freq === 'Mensal' ? 'Mensal' : 'Diário';
      const id = nextId(model.types, 'g');
      model.types.push({
        id, name, freq, repeat: freq === 'Mensal' ? !!a.repeat : false,
        scope: a.scope === 'combustão' ? 'combustão' : 'todos', active: true
      });
      if (freq === 'Mensal' && a.repeat && a.amount) {
        const { y, m } = parseISO(model.today);
        const targets = a.tukId ? model.tuks.filter(t => t.id === a.tukId) : model.tuks.filter(t => t.status !== 'vendido');
        for (const t of targets) {
          if (a.scope === 'combustão' && t.fuel !== 'combustão') continue;
          pushFixed(model, id, t.id, monthStart(y, m), round2(a.amount));
        }
        ensureRecurring(model);
      }
      return { toast: freq === 'Diário' ? 'Tipo diário criado. Na folha entra uma coluna antes do fim.' : 'Tipo mensal criado. Usa as linhas livres de cada mês.' };
    }
    case 'update-type': {
      const tp = typeById(model, a.id);
      if (!tp) return { error: 'Tipo em falta' };
      if (a.name != null) {
        const name = String(a.name).trim();
        if (!name) return { error: 'Falta o nome' };
        tp.name = name;
      }
      if (a.scope === 'combustão' || a.scope === 'todos') tp.scope = a.scope;
      if (a.repeat != null && tp.freq === 'Mensal') tp.repeat = !!a.repeat;
      if (a.active != null) tp.active = !!a.active;
      return { toast: tp.active ? 'Tipo atualizado' : 'Tipo apagado. Os valores já lançados ficam na folha.' };
    }
    case 'ensure-recurring': {
      ensureRecurring(model);
      return {};
    }
    default:
      return { error: 'Ação desconhecida' };
  }
}

function upsertPct(model, driverId, from, pct, role) {
  const hit = model.pct.find(p => p.driverId === driverId && p.from === from);
  if (hit) { hit.pct = role === 'patrão' ? 0 : round2(pct); hit.role = role; }
  else model.pct.push({ driverId, from, pct: role === 'patrão' ? 0 : round2(pct), role });
}

export function openingBalances(model) {
  const out = {};
  for (const d of model.drivers) {
    if (isOwnerAt(model, d.id, monthEnd(model.year, 12))) out[d.id] = 0;
    else out[d.id] = saldoAte(model, d.id, model.year);
  }
  return out;
}

/** Ano novo: configuração e saldos, sem os dias. */
export function carryYear(model, newYear) {
  const open = openingBalances(model);
  const next = blankYear(newYear);
  next.businessName = model.businessName;
  next.tipsEnabled = model.tipsEnabled;
  next.tuks = model.tuks.map(t => ({ ...t }));
  next.drivers = model.drivers.map(d => ({ ...d, opening: round2(open[d.id] || 0), since: d.since }));
  next.types = model.types.map(t => ({ ...t }));
  for (const d of model.drivers) next.pct.push(...pctRowsForYear(model, d.id, newYear));
  const prize = prizeAt(model, newYear, 12);
  next.prizes = [{ from: iso(newYear, 1, 1), active: prize.active, amount: prize.raw != null ? prize.raw : prize.amount }];
  for (const t of model.tuks) {
    for (const tp of model.types) {
      if (tp.freq !== 'Mensal' || !tp.repeat) continue;
      const amt = fixedAt(model, tp.id, t.id, model.year, 12);
      if (amt) next.fixed.push({ typeId: tp.id, tukId: t.id, from: iso(newYear, 1, 1), amount: amt });
    }
  }
  next.prior = yearView(model).months.map(m => ({ faturado: m.fat, workers: m.workers }));
  return next;
}

export function servicesFormula(parts) { return cellFromParts(parts); }
export { partsFromCell, MESES, plateBad };
