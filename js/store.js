/* Estado da app: demonstração neste aparelho, ou a folha do ano na Drive. */

import { cellFromParts, civilToday, monthStart, pad } from './format.js';
import { explainError, progressText } from './stages.js';
import { DEMO_TODAY, buildDemo } from './demo.js';
import { apply, blankYear, ensureRecurring, factoryTypes, isOwnerAt, normalizePct, PCT_START } from './model.js';
import { buildBook, contextFromModel, driverTitle, tukTitle } from './sheet.js';
import { TMGoogle, accountsDiffer } from './google.js';
import {
  accountOf, addSheetFromBook, appendLog, backupFile, createBook, loadBook, locateJob, pushRoster, readKeys,
  renameYearFiles, repaintBook, writeCells, yearFileName
} from './remote.js';

const KEY = 'tm.v4';

export const state = {
  ready: false,
  mode: null,
  onboarded: false,
  model: null,
  file: null,
  emailLabel: '',
  googleLinked: false,
  accountEmail: '',
  accountId: '',
  pendingRename: null,
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
      emailLabel: state.emailLabel,
      googleLinked: !!state.googleLinked,
      accountEmail: state.accountEmail || '',
      accountId: state.accountId || '',
      pendingRename: state.pendingRename || null,
      build: state.build || null,
      paintIndex: state.paintIndex || 0,
      paintDone: !!state.paintDone,
      copyPending: !!state.copyPending
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

let flight = null;
export function flush() {
  if (flight) return flight;
  flight = flushBody().finally(() => { flight = null; });
  return flight;
}

async function learnAccount(token) {
  try { return await accountOf(token); }
  catch (e) { return null; }
}

function bindAccount(who) {
  if (!who || !who.email) return;
  state.accountEmail = who.email;
  if (who.id) state.accountId = who.id;
  state.emailLabel = who.email;
  state.googleLinked = true;
  TMGoogle.setHint(who.email);
}

async function applyRename(token) {
  const spec = state.pendingRename;
  if (!spec || !state.file) return;
  const result = await renameYearFiles(token, spec);
  if (result.main === 'missing') {
    state.syncError = 'Não encontrei a folha deste ano para mudar o nome. Não criei outra.';
    return;
  }
  if (result.main === 'failed' || result.backup === 'failed') {
    state.pendingRename = { ...spec, mainDone: result.main === 'ok' };
    state.syncError = result.main === 'ok'
      ? 'A folha já tem o nome novo. A cópia atualiza quando a ligação deixar.'
      : 'Não consegui mudar o nome na Drive. Os dados ficam neste telemóvel.';
    return;
  }
  state.pendingRename = null;
  state.file.name = result.mainName || state.file.name;
  if (result.mainId) state.file.id = result.mainId;
  state.syncError = '';
}

async function flushBody() {
  if (state.mode !== 'google' || !state.file) return;
  if (!state.pending.length && !state.rosterSync && !state.pendingRename) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    state.offline = true;
    state.syncError = state.pendingRename && !state.pending.length
      ? 'Sem rede. O nome novo fica neste telemóvel e os ficheiros mudam quando voltares a ter ligação.'
      : 'Sem rede. Fica guardado neste telemóvel e segue quando voltares a ter ligação.';
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
    await writeCells(token, state.file.id, resolved);
    if (resolved.length) {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      await appendLog(token, state.file.id, resolved.slice(0, 40).map(j => [stamp, 'app', '', j.a1, '', String(j.baseline ?? ''), String(j.value ?? ''), '']));
    }
    state.file.savedAt = Date.now();
    state.offline = false;
    if (!state.pendingRename) state.syncError = '';
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
  if (state.pendingRename && !state.syncError) {
    try {
      const token = await TMGoogle.getToken();
      await applyRename(token);
      state.offline = false;
    } catch (e) {
      if (e.offline || e.message === 'sem rede') {
        state.offline = true;
        state.syncError = 'Sem rede. O nome novo fica neste telemóvel e os ficheiros mudam quando voltares a ter ligação.';
      } else {
        state.syncError = 'Não consegui mudar o nome na Drive. Os dados ficam neste telemóvel.';
      }
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
  const saved = new Set(['set-objective', 'set-objectives', 'set-business', 'set-tips', 'update-type', 'add-type', 'update-driver', 'add-driver', 'update-tuk', 'add-tuk', 'set-fixed', 'set-prize']);
  if (saved.has(action.type)) note('Modificado com sucesso', false);
  else if (res.toast) note(res.toast, false);
  if (state.mode === 'google' && state.file && before.businessName !== res.model.businessName) {
    state.pendingRename = {
      year: res.model.year,
      name: res.model.businessName,
      mainId: state.file.id || '',
      mainDone: false
    };
    state.file = { ...state.file, name: yearFileName(res.model.businessName, res.model.year, 'main') };
  }
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

async function refreshFromSheet(token) {
  if (!state.file || !state.model) return;
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
  state.syncError = '';
}

export async function connectGoogle(select) {
  if (state.busy) return;
  state.busy = true;
  state.busyLabel = 'A ligar à conta…';
  poke();
  try {
    const token = await TMGoogle.signIn(!!select);
    const who = await learnAccount(token);
    if (state.onboarded && state.mode === 'google' && accountsDiffer(state.accountId, who && who.id)) {
      TMGoogle.forgetToken();
      note(state.accountEmail ? `Esta folha está na conta ${state.accountEmail}.` : 'Esta folha está noutra conta.', true);
    } else {
      if (!state.onboarded && select) {
        state.file = null;
        state.build = null;
        state.pending = [];
        state.pendingRename = null;
      }
      if (state.onboarded && state.mode === 'google' && state.file) {
        try {
          await refreshFromSheet(token);
          if (who && who.email) bindAccount(who);
          else state.googleLinked = true;
          const after = flush();
          if (state.copyPending) Promise.resolve(after).finally(() => scheduleBackup(token));
          note('Conta ligada.', false);
        } catch (e) {
          TMGoogle.forgetToken();
          state.syncError = 'Não consegui ler a folha. O que está neste telemóvel continua aqui.';
          note(state.syncError, true);
        }
      } else {
        if (who && who.email) bindAccount(who);
        else if (select) {
          state.accountEmail = '';
          state.accountId = '';
          state.emailLabel = 'Conta Google ligada';
          TMGoogle.setHint('');
        } else if (!state.accountEmail) {
          state.emailLabel = 'Conta Google ligada';
        }
        state.googleLinked = true;
        note('Conta ligada. A app só vê as folhas que ela cria.', false);
      }
    }
  } catch (e) {
    note(e.message === 'timeout' ? 'A janela da Google fechou sem concluir.' : 'Não foi possível ligar à conta Google.', true);
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
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
  const same = state.build && !state.build.done && Number(state.build.year) === year;
  state.build = {
    fileId: same ? state.build.fileId : (state.file && Number(state.file.year) === year ? state.file.id : ''),
    year,
    index: same ? state.build.index || 0 : 0,
    done: false,
    model: same && state.build.index && state.build.model ? state.build.model : model
  };
  state.busy = true;
  state.busyLabel = 'A criar a folha…';
  state.setupError = '';
  state.setupReason = '';
  poke();
  try {
    const token = await TMGoogle.getToken();
    const who = await learnAccount(token);
    if (accountsDiffer(state.accountId, who && who.id)) {
      TMGoogle.forgetToken();
      const err = new Error('conta');
      err.reason = state.accountEmail ? `Esta folha está na conta ${state.accountEmail}.` : 'Esta folha está noutra conta.';
      throw err;
    }
    if (who && who.email) bindAccount(who);
    state.googleLinked = true;
    const created = await createBook(token, state.build.model, state.build.fileId, progressHooks());
    const file = { ...created, year };
    state.file = file;
    state.build = { fileId: file.id, year, index: state.setupTotal || state.build.index, done: true };
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
    if (!state.accountEmail) state.emailLabel = 'Conta Google ligada';
    state.googleLinked = true;
    state.setupError = '';
    rememberJobs(before, state.model);
    state.copyToken = token;
  } catch (e) {
    rememberFailure(e, model, year);
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
  const token = state.copyToken;
  state.copyToken = '';
  if (token && state.onboarded && !state.setupError) Promise.resolve(flush()).finally(() => scheduleBackup(token));
}

function progressHooks(prefix) {
  const painting = !!prefix && prefix.indexOf('repor') >= 0;
  return {
    localIndex: painting ? (state.paintIndex || 0) : (state.build && state.build.index || 0),
    onFile: async (file) => {
      if (painting || (prefix && prefix.indexOf('cópia') >= 0)) return;
      state.file = { id: file.id, name: file.name, year: file.year, url: file.url };
      state.build = { ...(state.build || {}), fileId: file.id, year: file.year, done: false };
      persist();
    },
    onProgress: async (info) => {
      const text = info.text
        || (prefix
          ? `${prefix}, separador ${info.index + 1} de ${info.total}: ${info.label}`
          : progressText(info.index, info.total, info.label));
      state.busyLabel = text;
      state.setupIndex = info.index;
      state.setupTotal = info.total;
      poke();
    },
    onDone: async (index, fileId) => {
      if (painting) {
        state.paintIndex = index;
        state.paintDone = !!(state.setupTotal && index >= state.setupTotal);
        persist();
        return;
      }
      if (prefix && prefix.indexOf('cópia') >= 0) return;
      state.build = { ...(state.build || {}), fileId, index, done: false };
      state.setupIndex = index;
      persist();
    }
  };
}

function rememberFailure(e, model, year) {
  if (e && e.fileId) {
    state.file = { id: e.fileId, name: e.fileName || (model && model.businessName) || '', year, url: `https://docs.google.com/spreadsheets/d/${e.fileId}/edit` };
    state.build = { ...(state.build || {}), fileId: e.fileId, year, done: false, model: (state.build && state.build.model) || model };
  }
  const why = (e && e.reason) || explainError(e);
  const where = e && e.stepLabel ? ` no separador ${e.stepLabel}` : '';
  state.setupReason = why + where;
  state.setupError = 'Não consegui acabar a folha. ' + state.setupReason + '. Toca em Tentar outra vez: continuo nesta, sem criar outra.';
  console.warn('[folha]', state.setupReason, e && e.body ? e.body : '');
}

function scheduleBackup(token) {
  if (!token || !state.file || state.copying) return;
  state.copying = true;
  state.copyPending = true;
  persist();
  poke();
  backupFile(token, state.file).then(() => {
    state.copying = false;
    state.copyPending = false;
    persist();
    poke();
  }).catch(() => {
    state.copying = false;
    state.copyPending = true;
    persist();
    poke();
  });
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
  let next = null;
  try {
    const token = await TMGoogle.getToken();
    const { carryYear } = await import('./model.js');
    next = carryYear(state.model, year);
    next.today = civilToday();
    next.previousId = state.file && state.file.id;
    const preferred = state.build && Number(state.build.year) === Number(year) ? state.build.fileId : '';
    state.build = { fileId: preferred || '', year, index: preferred ? (state.build.index || 0) : 0, done: false, model: next };
    const created = await createBook(token, next, preferred, progressHooks());
    state.file = { ...created, year };
    state.model = await loadBook(token, created.id, year);
    state.model.today = civilToday();
    ensureRecurring(state.model);
    state.build = { fileId: created.id, year, index: state.setupTotal || 0, done: true };
    note(`Folha de ${year} criada. Os saldos transitados já lá estão.`, false);
    state.copyToken = token;
  } catch (e) {
    rememberFailure(e, next, year);
    note(state.setupReason || 'Não consegui criar a folha desse ano.', true);
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
  const token = state.copyToken;
  state.copyToken = '';
  if (token && !state.setupError) Promise.resolve(flush()).finally(() => scheduleBackup(token));
}

export async function restoreLook(recreate) {
  if (state.mode !== 'google' || !state.file) {
    note('Em demonstração a folha é simulada neste telemóvel.', false);
    poke();
    return;
  }
  if (state.busy) return;
  if (state.paintDone) state.paintIndex = 0;
  state.paintDone = false;
  state.busy = true;
  state.busyLabel = 'A repor o aspeto…';
  poke();
  try {
    const token = await TMGoogle.getToken();
    const live = await loadBook(token, state.file.id, state.model.year);
    live.today = civilToday();
    let result = await repaintBook(token, state.file.id, live, progressHooks('A repor o aspeto'));
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
      result = await repaintBook(token, state.file.id, live, progressHooks('A repor o aspeto'));
    }
    state.model = await loadBook(token, state.file.id, live.year);
    state.model.today = civilToday();
    state.missing = null;
    state.keys = {};
    note('Aspeto da folha reposto. Os valores que tinhas escrito mantêm-se.', false);
  } catch (e) {
    note((explainError(e) || 'Não consegui repor o aspeto.') + (e.stepLabel ? ' · ' + e.stepLabel : ''), true);
  }
  state.busy = false;
  state.busyLabel = '';
  persist();
  poke();
}

export function exitDemo() {
  if (state.mode !== 'demo') return;
  state.mode = null;
  state.onboarded = false;
  state.model = null;
  state.file = null;
  state.pending = [];
  state.sheet = null;
  state.toast = '';
  state.toastHtml = '';
  state.toastOn = false;
  state.route = { name: 'inicio' };
  state.emailLabel = state.accountEmail || '';
  state.date = '';
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
  state.googleLinked = false;
  state.accountEmail = '';
  state.accountId = '';
  state.pendingRename = null;
  state.pending = [];
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  poke();
}

function restoreAccount(saved) {
  state.googleLinked = !!(saved && (saved.googleLinked || (saved.emailLabel && String(saved.emailLabel).indexOf('ligada') >= 0)));
  state.accountEmail = (saved && saved.accountEmail) || '';
  state.accountId = (saved && saved.accountId) || '';
  state.pendingRename = (saved && saved.pendingRename) || null;
  if (state.accountEmail) TMGoogle.setHint(state.accountEmail);
}

export async function boot() {
  TMGoogle.setClientId((window.TM_CONFIG && window.TM_CONFIG.clientId) || '');
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
  restoreAccount(saved);
  if (saved && saved.copyPending) state.copyPending = true;
  if (saved && saved.build && !saved.build.done && saved.build.model && saved.build.fileId) {
    state.build = saved.build;
    state.file = { id: saved.build.fileId, year: saved.build.year, url: `https://docs.google.com/spreadsheets/d/${saved.build.fileId}/edit`, name: saved.build.model.businessName || '' };
    state.emailLabel = saved.emailLabel || '';
    state.route = { name: 'inicio' };
    state.ready = true;
    state.busy = true;
    state.busyLabel = 'A continuar a folha…';
    state.setupIndex = saved.build.index || 0;
    poke();
    try {
      const token = await TMGoogle.silent();
      const who = token ? await learnAccount(token) : null;
      if (!token || accountsDiffer(saved.accountId, who && who.id)) {
        if (token && who && accountsDiffer(saved.accountId, who.id)) TMGoogle.forgetToken();
        const err = new Error('sessao');
        err.status = 401;
        throw err;
      }
      const hooks = progressHooks();
      hooks.mustReuse = true;
      hooks.localIndex = saved.build.index || 0;
      const created = await createBook(token, saved.build.model, saved.build.fileId, hooks);
      if (who && who.email) bindAccount(who);
      state.file = { ...created, year: saved.build.year };
      state.build = { fileId: created.id, year: saved.build.year, index: state.setupTotal || saved.build.index || 0, done: true };
      state.model = await loadBook(token, created.id, saved.build.year);
      state.model.today = civilToday();
      ensureRecurring(state.model);
      state.mode = 'google';
      state.onboarded = true;
      state.date = state.model.today;
      state.month = Number(String(state.model.today).slice(5, 7)) || 1;
      state.route = { name: 'hoje' };
      if (!state.accountEmail) state.emailLabel = 'Conta Google ligada';
      state.googleLinked = true;
      state.setupError = '';
      state.copyToken = token;
    } catch (e) {
      rememberFailure(e, saved.build.model, saved.build.year);
    }
  } else if (saved && saved.onboarded && saved.model) {
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
          const who = token ? await learnAccount(token) : null;
          if (token && who && accountsDiffer(state.accountId, who.id)) {
            TMGoogle.forgetToken();
            state.syncError = state.accountEmail
              ? `Entra outra vez com a conta ${state.accountEmail} para sincronizar a folha.`
              : 'Entra outra vez para sincronizar a folha.';
          } else if (token && state.file) {
            await refreshFromSheet(token);
            if (who && who.email) bindAccount(who);
            const after = flush();
            if (saved.copyPending) Promise.resolve(after).finally(() => scheduleBackup(token));
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
    if (saved && saved.paintIndex) state.paintIndex = saved.paintIndex;
    if (saved && saved.paintDone) state.paintDone = true;
  }
  state.ready = true;
  state.busy = false;
  state.busyLabel = '';
  poke();
  const token = state.copyToken;
  state.copyToken = '';
  if (token && state.onboarded && !state.setupError) Promise.resolve(flush()).finally(() => scheduleBackup(token));
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
