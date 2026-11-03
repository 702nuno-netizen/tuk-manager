/* Estado da app: demonstração neste aparelho, ou a folha do ano na Drive. */

import { cellFromParts, civilToday, monthStart, pad } from './format.js';
import { DEMO_TODAY, buildDemo } from './demo.js';
import { apply, blankYear, ensureRecurring, factoryTypes, isOwnerAt, normalizePct, PCT_START } from './model.js';
import { buildBook, contextFromModel, driverTitle, tukTitle } from './sheet.js';
import { TMGoogle } from './google.js';
import {
  addSheetFromBook, appendLog, backupFile, createBook, loadBook, locateJob, pushRoster, readKeys, repaintBook, writeCells
} from './remote.js';

const KEY = 'tm.v4';

export const state = {
  ready: false,
  mode: null,
  onboarded: false,
  model: null,
  file: null,
  emailLabel: '',
  pending: [],
  rosterSync: false,
  syncError: '',
  syncing: false,
  toastOn: false,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  toast: '',
  toastHtml: '',
  toastErr: false,
  busy: false,
  route: { name: 'inicio' },
  date: DEMO_TODAY,
  month: 11,
  sheet: null,
  missing: null,
  yearChoice: 0,
  busyLabel: '',
  setupError: '',
  keys: {}
};

let onChange = () => {};
export function subscribe(fn) { onChange = fn; }
function poke() { onChange(); }

function persist() {
  try {
    const model = state.model ? { ...state.model } : null;
    localStorage.setItem(KEY, JSON.stringify({
      mode: state.mode,
      onboarded: state.onboarded,
      model,
      file: state.file,
      pending: state.pending,
      emailLabel: state.emailLabel
    }));
  } catch (e) { /* cheio ou privado */ }
}

function emptyDay() {
  return { tukId: null, services: [], grat: [], entregue: [], note: '' };
}

function tukName(model, id) {
  const t = (model.tuks || []).find(x => x.id === id);
  return t ? 'Tuk ' + pad(t.number) : '';
}

function sheetTitleForDriver(model, id) {
  const d = model.drivers.find(x => x.id === id);
  if (!d) return '';
  if (d.sheetTitle) return d.sheetTitle;
  return driverTitle({ ...d, owner: isOwnerAt(model, id, model.today || `${model.year}-12-31`) });
}

function sheetTitleForTuk(model, id) {
  const t = model.tuks.find(x => x.id === id);
  if (!t) return '';
  return t.sheetTitle || tukTitle(t);
}

export function diffJobs(before, after) {
  const jobs = [];
  const push = (title, rowKey, colKey, value, baseline) => {
    const norm = (v) => v == null ? '' : String(v);
    if (norm(value) === norm(baseline)) return;
    jobs.push({ title, rowKey, colKey, value: value == null || value === '' ? '' : value, baseline: baseline == null ? '' : baseline });
  };
  const ids = new Set([...Object.keys(before.days || {}), ...Object.keys(after.days || {})]);
  for (const id of ids) {
    const title = sheetTitleForDriver(after, id) || sheetTitleForDriver(before, id);
    if (!title) continue;
    const dates = new Set([...Object.keys((before.days || {})[id] || {}), ...Object.keys((after.days || {})[id] || {})]);
    for (const date of dates) {
      const a = ((before.days || {})[id] || {})[date] || emptyDay();
      const b = ((after.days || {})[id] || {})[date] || emptyDay();
      push(title, date, 'tuk', tukName(after, b.tukId), tukName(before, a.tukId));
      push(title, date, 'servicos', cellFromParts(b.services), cellFromParts(a.services));
      push(title, date, 'gratif', cellFromParts(b.grat), cellFromParts(a.grat));
      push(title, date, 'entregas', cellFromParts(b.entregue), cellFromParts(a.entregue));
      push(title, date, 'nota', b.note || '', a.note || '');
    }
  }
  const tuks = new Set([...Object.keys(before.tukDays || {}), ...Object.keys(after.tukDays || {})]);
  for (const id of tuks) {
    const title = sheetTitleForTuk(after, id) || sheetTitleForTuk(before, id);
    if (!title) continue;
    const dates = new Set([...Object.keys((before.tukDays || {})[id] || {}), ...Object.keys((after.tukDays || {})[id] || {})]);
    for (const date of dates) {
      const a = ((before.tukDays || {})[id] || {})[date] || { byType: {}, note: '' };
      const b = ((after.tukDays || {})[id] || {})[date] || { byType: {}, note: '' };
      const types = new Set([...Object.keys(a.byType || {}), ...Object.keys(b.byType || {})]);
      for (const typeId of types) push(title, date, 'type-' + typeId, cellFromParts((b.byType || {})[typeId]), cellFromParts((a.byType || {})[typeId]));
      push(title, date, 'nota', b.note || '', a.note || '');
    }
  }
  const months = new Set([...Object.keys(before.tukMonths || {}), ...Object.keys(after.tukMonths || {})]);
  for (const id of months) {
    const title = sheetTitleForTuk(after, id) || sheetTitleForTuk(before, id);
    if (!title) continue;
    const yms = new Set([...Object.keys((before.tukMonths || {})[id] || {}), ...Object.keys((after.tukMonths || {})[id] || {})]);
    for (const ym of yms) {
      const a = ((before.tukMonths || {})[id] || {})[ym] || {};
      const b = ((after.tukMonths || {})[id] || {})[ym] || {};
      const types = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const typeId of types) {
        const av = a[typeId] && a[typeId].parts ? cellFromParts(a[typeId].parts) : '';
        const bv = b[typeId] && b[typeId].parts ? cellFromParts(b[typeId].parts) : '';
        push(title, `M|${ym}|${typeId}`, 'valor', bv, av);
      }
    }
  }
  (after.objectives || []).forEach((o, i) => {
    const prev = (before.objectives || [])[i];
    if (!prev || prev.amount !== o.amount) {
      jobs.push({ title: '📊 Painel', rowKey: 'obj-' + o.month, colKey: 'objetivo', value: o.amount, baseline: prev ? prev.amount : 0, direct: `J${9 + o.month}` });
    }
  });
  if (before.businessName !== after.businessName) {
    jobs.push({ title: '⚙ Config', rowKey: 'negocio', colKey: 'Valor', value: after.businessName, baseline: before.businessName || '' });
  }
  if (before.tipsEnabled !== after.tipsEnabled) {
    jobs.push({ title: '⚙ Config', rowKey: 'gratificacoes_ativas', colKey: 'Valor', value: after.tipsEnabled ? 'SIM' : 'NÃO', baseline: before.tipsEnabled ? 'SIM' : 'NÃO' });
  }
  return jobs;
}

async function resolveJobs(token, fileId, jobs) {
  const titles = [...new Set(jobs.map(j => j.title))];
  for (const title of titles) {
    if (!state.keys[title]) state.keys[title] = await readKeys(token, fileId, title);
  }
  const out = [];
  for (const job of jobs) {
    const a1 = locateJob(job.direct ? null : state.keys[job.title], job);
    if (!a1) continue;
    out.push({ a1, value: job.value, baseline: job.baseline });
  }
  return out;
}

let toastTimer = 0;
let toastFade = 0;
export function note(msg, err) {
  state.toast = msg || '';
  state.toastHtml = '';
  state.toastErr = !!err;
  state.toastOn = !!msg;
  clearTimeout(toastTimer);
  clearTimeout(toastFade);
  if (!msg) { poke(); return; }
  toastTimer = setTimeout(() => {
    state.toastOn = false;
    poke();
    toastFade = setTimeout(() => { state.toast = ''; state.toastErr = false; poke(); }, 380);
  }, 2000);
  poke();
}
export function armToast() {
  state.toastOn = true;
  clearTimeout(toastTimer);
  clearTimeout(toastFade);
  toastTimer = setTimeout(() => {
    state.toastOn = false;
    poke();
    toastFade = setTimeout(() => { state.toastHtml = ''; poke(); }, 380);
  }, 2000);
}

export function rosterNeedsPush(before, after) {
  return rosterChanged(before, after);
}

function rosterChanged(before, after) {
  const slim = (m) => JSON.stringify({
    d: (m.drivers || []).map(d => [d.id, d.name, d.active, d.opening, d.phone, d.since]),
    t: (m.tuks || []).map(t => [t.id, t.number, t.nickname, t.plate, t.fuel, t.status, t.soldOn]),
    p: m.pct, y: m.types, f: m.fixed, z: m.prizes, o: m.objectives, b: m.businessName, g: m.tipsEnabled
  });
  return slim(before) !== slim(after);
}

export async function flush() {
  if (state.mode !== 'google' || !state.file) return;
  if (!state.pending.length && !state.rosterSync) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    state.offline = true;
    state.syncError = 'Sem rede. Fica guardado neste telemóvel e segue quando voltares a ter ligação.';
    poke();
    return;
  }
  const jobs = state.pending.splice(0, state.pending.length);
  const roster = state.rosterSync;
  state.rosterSync = false;
  state.syncing = true;
  state.syncError = '';
  poke();
  try {
    const token = await TMGoogle.getToken();
    if (roster) await pushRoster(token, state.file.id, state.model);
    state.keys = {};
    const resolved = await resolveJobs(token, state.file.id, jobs);
    if (jobs.length && resolved.length < jobs.length) {
      throw new Error('célula');
    }
    const { conflicts } = await writeCells(token, state.file.id, resolved);
    if (conflicts.length) {
      state.model = await loadBook(token, state.file.id, state.model.year);
      normalizePct(state.model);
      state.model.today = civilToday();
      note('A folha foi alterada à mão. Mantive esse valor.', false);
    }
    if (resolved.length) {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      await appendLog(token, state.file.id, resolved.slice(0, 40).map(j => [stamp, 'app', '', j.a1, '', String(j.baseline ?? ''), String(j.value ?? ''), '']));
    }
    state.file.savedAt = Date.now();
    state.offline = false;
    state.syncError = '';
  } catch (e) {
    state.pending = jobs.concat(state.pending);
    state.rosterSync = roster || state.rosterSync;
    if (e.offline || e.message === 'sem rede') {
      state.offline = true;
      state.syncError = 'Sem rede. O que lançaste fica neste telemóvel até voltares a ter ligação.';
    } else if (e.message === 'célula') {
      state.syncError = 'Não encontrei a célula na folha. Toca em Repor aspeto da folha.';
    } else {
      state.syncError = 'Não consegui gravar na folha. Os dados ficam neste telemóvel até conseguir.';
    }
  }
  state.syncing = false;
  persist();
  poke();
}

function rememberJobs(before, after) {
  if (state.mode !== 'google') return;
  const jobs = diffJobs(before, after);
  if (rosterChanged(before, after)) state.rosterSync = true;
  if (!jobs.length && !state.rosterSync) return;
  state.pending.push(...jobs);
  persist();
  flush();
}

export function dispatch(action) {
  if (!state.model) return { error: 'Sem dados' };
  const before = state.model;
  const res = apply(before, action);
  if (res.error) {
    note(res.error, true);
    return res;
  }
  res.model.today = state.mode === 'demo' ? DEMO_TODAY : (res.model.today || civilToday());
  state.model = res.model;
  if (res.toast) note(res.toast, false);
  rememberJobs(before, res.model);
  persist();
  poke();
  return res;
}

export async function startDemo() {
  if (state.busy) return;
  state.busy = true;
  state.busyLabel = 'A abrir a demonstração…';
  poke();
  await new Promise(r => setTimeout(r, 900));
  const model = buildDemo();
  state.mode = 'demo';
  state.onboarded = true;
  state.model = model;
  state.file = null;
  state.emailLabel = 'Demonstração · neste telemóvel';
  state.date = DEMO_TODAY;
  state.month = 11;
  state.route = { name: 'hoje' };
  state.pending = [];
  state.toast = '';
  state.toastHtml = '';
  state.toastOn = false;
  state.syncError = '';
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
}

export async function connectGoogle(select) {
  if (state.busy) return;
  state.busy = true;
  state.busyLabel = 'A ligar à conta…';
  poke();
  try {
    await TMGoogle.signIn(!!select);
    state.emailLabel = 'Conta Google ligada';
    note('Conta ligada. A app só vê as folhas que ela cria.', false);
  } catch (e) {
    note(e.message === 'timeout' ? 'A janela da Google fechou sem concluir.' : 'Não foi possível ligar à conta Google.', true);
  }
  state.busy = false;
  state.busyLabel = '';
  poke();
}

export async function createFromSetup(form) {
  const year = Number(form.year) || new Date().getFullYear();
  const model = blankYear(year);
  model.today = civilToday();
  model.businessName = String(form.business || '').trim();
  model.tipsEnabled = true;
  model.types = factoryTypes();
  model.prizes = [{ from: `${year}-01-01`, active: false, amount: 0 }];
  const tukId = 't1';
  model.tuks.push({
    id: tukId, number: Number(form.number), nickname: String(form.nickname || '').trim(),
    plate: String(form.plate || '').trim().toUpperCase(), fuel: form.fuel, status: 'ativo', soldOn: ''
  });
  const driverId = 'm1';
  model.drivers.push({ id: driverId, name: String(form.driver || '').trim(), phone: '', since: model.today, active: true, opening: 0 });
  model.pct.push({ driverId, from: PCT_START, pct: form.owner ? 0 : 0.5, role: form.owner ? 'patrão' : 'motorista' });
  if (form.owner) model.fixed.push({ typeId: 'g3', tukId, from: monthStart(year, Number(model.today.slice(5, 7))), amount: 0 });
  if (state.busy) return;
  state.busy = true;
  state.busyLabel = 'A criar a folha…';
  state.setupError = '';
  poke();
  try {
    const token = await TMGoogle.getToken();
    const preferred = state.file && Number(state.file.year) === year ? state.file.id : '';
    const created = await createBook(token, model, preferred);
    const file = { ...created, year };
    state.file = file;
    persist();
    state.model = await loadBook(token, created.id, year);
    state.model.today = civilToday();
    const before = structuredClone(state.model);
    ensureRecurring(state.model);
    state.mode = 'google';
    state.onboarded = true;
    state.file = file;
    state.date = state.model.today;
    state.month = Number(state.model.today.slice(5, 7));
    state.route = { name: 'hoje' };
    state.emailLabel = 'Conta Google ligada';
    state.setupError = '';
    rememberJobs(before, state.model);
    try { await maybeBackup(token, file); } catch (e) { /* a cópia não impede a entrada */ }
  } catch (e) {
    if (e.fileId) {
      state.file = { id: e.fileId, name: e.fileName || model.businessName, year, url: `https://docs.google.com/spreadsheets/d/${e.fileId}/edit` };
    }
    state.setupError = e.offline
      ? 'Sem rede. Se a folha chegou a ser criada, fica na Drive. Quando voltares a ter ligação, toca em Tentar outra vez — uso a mesma.'
      : 'Não consegui acabar a folha. Se ela já está na Drive, toca em Tentar outra vez: continuo nessa, sem criar outra.';
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
}

async function maybeBackup(token, file) {
  await backupFile(token, file);
}

export async function createYear(year) {
  if (!state.model) return;
  if (state.mode === 'demo') {
    const { carryYear } = await import('./model.js');
    const next = carryYear(state.model, year);
    next.today = DEMO_TODAY;
    state.model = next;
    state.month = 1;
    note(`Ano ${year} criado neste telemóvel, com os saldos transitados.`, false);
    persist();
    poke();
    return;
  }
  if (state.busy) return;
  state.busy = true;
  state.busyLabel = 'A criar a folha…';
  poke();
  try {
    const token = await TMGoogle.getToken();
    const { carryYear } = await import('./model.js');
    const next = carryYear(state.model, year);
    next.today = civilToday();
    next.previousId = state.file.id;
    const preferred = state.file && Number(state.file.year) === Number(year) ? state.file.id : '';
    const created = await createBook(token, next, preferred);
    state.file = { ...created, year };
    state.model = await loadBook(token, created.id, year);
    state.model.today = civilToday();
    ensureRecurring(state.model);
    note(`Folha de ${year} criada. Os saldos transitados já lá estão.`, false);
  } catch (e) {
    note('Não consegui criar a folha desse ano.', true);
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
}

export async function restoreLook(recreate) {
  if (state.mode !== 'google' || !state.file) {
    note('Em demonstração a folha é simulada neste telemóvel.', false);
    poke();
    return;
  }
  if (state.busy) return;
  state.busy = true;
  state.busyLabel = 'A repor o aspeto…';
  poke();
  try {
    const token = await TMGoogle.getToken();
    const live = await loadBook(token, state.file.id, state.model.year);
    live.today = civilToday();
    let result = await repaintBook(token, state.file.id, live);
    if (result.missing.length && !recreate) {
      state.missing = result.missing;
      state.busy = false;
      state.busyLabel = '';
      poke();
      return;
    }
    if (result.missing.length && recreate) {
      const book = buildBook(contextFromModel(live));
      const known = {};
      live.drivers.forEach(d => { if (d.sheetId) known[d.id] = d.sheetId; });
      live.tuks.forEach(t => { if (t.sheetId) known[t.id] = t.sheetId; });
      for (const ws of book.sheets.filter(s => result.missing.includes(s.title))) {
        await addSheetFromBook(token, state.file.id, ws, known);
      }
      result = await repaintBook(token, state.file.id, live);
    }
    state.model = await loadBook(token, state.file.id, live.year);
    state.model.today = civilToday();
    state.missing = null;
    state.keys = {};
    note('Aspeto da folha reposto. Os valores que tinhas escrito mantêm-se.', false);
  } catch (e) {
    note('Não consegui repor o aspeto.', true);
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
}

export function signOut() {
  TMGoogle.signOut();
  state.mode = null;
  state.onboarded = false;
  state.model = null;
  state.file = null;
  state.route = { name: 'inicio' };
  state.emailLabel = '';
  state.pending = [];
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  poke();
}

export async function boot() {
  TMGoogle.setClientId((window.TM_CONFIG && window.TM_CONFIG.clientId) || '');
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
  if (saved && saved.onboarded && saved.model) {
    state.mode = saved.mode;
    state.onboarded = true;
    state.model = saved.model;
    state.file = saved.file || null;
    state.pending = saved.pending || [];
    state.emailLabel = saved.emailLabel || (saved.mode === 'demo' ? 'Demonstração · neste telemóvel' : '');
    state.model.today = saved.mode === 'demo' ? DEMO_TODAY : civilToday();
    state.date = state.model.today;
    state.month = Number(String(state.date).slice(5, 7)) || 11;
    state.route = { name: 'hoje' };
    if (saved.mode === 'google') {
      state.busy = true;
      state.busyLabel = 'A ler a folha…';
      state.ready = true;
      poke();
      if (!navigator.onLine) {
        state.syncError = 'Sem rede. Mostramos o que está neste telemóvel até voltares a ter ligação.';
      } else {
        try {
          const token = await TMGoogle.silent();
          if (token && state.file) {
            const fresh = await loadBook(token, state.file.id, state.model.year);
            normalizePct(fresh);
            if (!fresh.objectives.length || fresh.objectives.every(o => !o.amount)) {
              fresh.objectives = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 3000 }));
            }
            fresh.today = civilToday();
            state.model = fresh;
            state.date = fresh.today;
            state.month = Number(String(fresh.today).slice(5, 7)) || state.month;
            state.rosterSync = true;
            flush();
          } else {
            state.syncError = 'Entra outra vez para sincronizar a folha.';
          }
        } catch (e) {
          state.syncError = 'Não consegui ler a folha. O que está neste telemóvel continua aqui.';
        }
      }
    }
  } else {
    state.route = { name: 'inicio' };
    if (saved && saved.file) state.file = saved.file;
    if (saved && saved.emailLabel) state.emailLabel = saved.emailLabel;
  }
  state.ready = true;
  state.busy = false;
  state.busyLabel = '';
  poke();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { state.offline = false; flush(); });
    window.addEventListener('offline', () => { state.offline = true; poke(); });
  }
}

export function setRoute(route) { state.route = route; poke(); }
export function setDate(date) { state.date = date; poke(); }
export function setMonth(month) { state.month = month; poke(); }
export function openSheet(sheet) { state.sheet = sheet; poke(); }
export function closeSheet() { state.sheet = null; poke(); }
export function clearToast() {
  clearTimeout(toastTimer);
  clearTimeout(toastFade);
  state.toast = '';
  state.toastHtml = '';
  state.toastErr = false;
  state.toastOn = false;
  poke();
}
