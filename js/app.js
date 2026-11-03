/* Tuk Manager — navegação, gráficos e ações. */

import { plateBad, addDays, parseISO, daysInMonth, iso } from './format.js';
import { suggestions } from './view.js';
import { render } from './view.js';
import {
  state, subscribe, boot, dispatch, startDemo, connectGoogle, createFromSetup,
  createYear, restoreLook, signOut, exitDemo, setRoute, setDate, setMonth, openSheet, closeSheet, clearToast, flush, note, armToast
} from './store.js';

const app = document.getElementById('app');
let charts = [];

function moneyOf(input) {
  if (!input) return NaN;
  let t = String(input.value || '').trim().replace(/\s|€/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function fieldMoney(root) {
  const input = root ? root.querySelector('[data-money]') : document.querySelector('main [data-money]');
  return moneyOf(input);
}
function selectedType() {
  const on = document.querySelector('main .cat.on');
  return on ? on.dataset.type : '';
}

function readDraft() {
  const biz = document.getElementById('biz');
  if (!biz) return;
  state.draft = {
    ...(state.draft || {}),
    business: biz.value,
    nick: (document.getElementById('nick') || {}).value || '',
    plate: (document.getElementById('plate') || {}).value || '',
    driver: (document.getElementById('driver') || {}).value || ''
  };
}

function drawCharts() {
  charts.forEach(c => { try { c.destroy(); } catch (e) { /* já fechado */ } });
  charts = [];
  if (!window.Chart) return;
  const Chart = window.Chart;
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#5d6a80';
  const eur0 = (v) => Math.round(v).toLocaleString('pt-PT') + ' €';
  const base = () => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10.5 } } },
      y: { grid: { color: '#edf1f7' }, border: { display: false }, ticks: { callback: (v) => eur0(v), maxTicksLimit: 5 } }
    }
  });
  const grad = (ctx, a, b) => { const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const month = document.getElementById('ch-month');
  if (month) {
    const days = (month.dataset.days || '').split(',').map(Number);
    let acc = 0;
    const cum = days.map(d => (acc += d));
    const goal = Number(month.dataset.goal) || 0;
    const ctx = month.getContext('2d');
    const o = base();
    o.scales.y2 = { position: 'right', grid: { display: false }, border: { display: false }, ticks: { callback: (v) => eur0(v), maxTicksLimit: 5, color: '#b8861f' }, min: 0 };
    charts.push(new Chart(ctx, { data: { labels: days.map((_, i) => i + 1), datasets: [
      { type: 'line', data: days.map(() => goal), yAxisID: 'y2', borderColor: '#8b97aa', borderDash: [6, 5], borderWidth: 1.6, pointRadius: 0, order: 0 },
      { type: 'line', data: cum, yAxisID: 'y2', borderColor: '#d4a537', backgroundColor: 'rgba(212,165,55,.10)', fill: true, tension: 0.32, borderWidth: 3, pointRadius: 0, order: 1 },
      { type: 'bar', data: days.map(d => d || null), yAxisID: 'y', backgroundColor: grad(ctx, '#3a76c4', '#1f4e8c'), borderRadius: 6, maxBarThickness: 12, order: 2 }
    ] }, options: o }));
  }
  const fo = document.getElementById('ch-fo');
  if (fo) {
    const fat = (fo.dataset.fat || '').split(',').map(Number);
    const obj = (fo.dataset.obj || '').split(',').map(Number);
    const ctx = fo.getContext('2d');
    const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    charts.push(new Chart(ctx, { type: 'bar', data: { labels: MES, datasets: [
      { data: fat, backgroundColor: grad(ctx, '#3a76c4', '#1f4e8c'), borderRadius: 6, maxBarThickness: 16 },
      { data: obj, backgroundColor: 'rgba(212,165,55,.35)', borderColor: '#d4a537', borderWidth: { top: 2.5, left: 0, right: 0, bottom: 0 }, borderSkipped: false, borderRadius: 6, maxBarThickness: 16 }
    ] }, options: base() }));
  }
  const lucro = document.getElementById('ch-lucro');
  if (lucro) {
    const luc = (lucro.dataset.luc || '').split(',').map(Number);
    const mx = Math.max(...luc);
    const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    charts.push(new Chart(lucro, { type: 'bar', data: { labels: MES, datasets: [{ data: luc, backgroundColor: luc.map(v => v >= mx && v > 0 ? '#d4a537' : '#2a63ad'), borderRadius: 7, maxBarThickness: 20 }] }, options: base() }));
  }
  const tuk = document.getElementById('ch-tuk');
  if (tuk) {
    const o = base();
    o.indexAxis = 'y';
    o.scales.x.grid = { color: '#edf1f7' };
    o.scales.x.ticks = { callback: (v) => eur0(v), maxTicksLimit: 4 };
    o.scales.y.grid = { display: false };
    o.scales.y.ticks = { font: { size: 12.5, weight: '700' }, color: '#122036' };
    charts.push(new Chart(tuk, { type: 'bar', data: { labels: (tuk.dataset.labels || '').split('|'), datasets: [{ data: (tuk.dataset.values || '').split(',').map(Number), backgroundColor: ['#1f4e8c', '#2a63ad', '#8fb0dc', '#0b2142'], borderRadius: 7, maxBarThickness: 26 }] }, options: o }));
  }
  const cat = document.getElementById('ch-cat');
  if (cat) {
    const labels = (cat.dataset.labels || '').split('|').filter(Boolean);
    const values = (cat.dataset.values || '').split(',').map(Number);
    const cols = ['#1f4e8c', '#d4a537', '#8fb0dc', '#0b2142', '#2a63ad'];
    const o = base();
    delete o.scales;
    o.cutout = '68%';
    charts.push(new Chart(cat, { type: 'doughnut', data: { labels, datasets: [{ data: values, backgroundColor: cols, borderColor: '#fff', borderWidth: 3 }] }, options: o }));
    const legend = document.getElementById('cat-legend');
    const tot = values.reduce((a, b) => a + b, 0) || 1;
    if (legend) legend.innerHTML = labels.map((name, i) => `<span><i style="background:${cols[i]}"></i>${name} · ${eur0(values[i])} (${Math.round(values[i] / tot * 100)}%)</span>`).join('');
  }
}

function paint() {
  const focus = document.activeElement && document.activeElement.id;
  app.innerHTML = render(state);
  drawCharts();
  if (focus) {
    const again = document.getElementById(focus);
    if (again) again.focus();
  }
  const plate = document.getElementById('plate');
  if (plate) plateWarn(plate);
}

function plateWarn(input) {
  const hint = document.getElementById('plate-hint');
  if (!hint) return;
  const bad = plateBad(input.value);
  hint.hidden = !bad;
  input.classList.toggle('warn', bad);
}

function driverId() {
  const main = document.querySelector('main[data-driver]');
  return main ? main.dataset.driver : (state.route.id || '');
}
function tukId() {
  const main = document.querySelector('main[data-tuk]');
  return main ? main.dataset.tuk : (state.route.id || '');
}

function go(name, id) {
  const route = { name, id: id || '' };
  const hash = '#/' + name + (id ? '/' + id : '');
  state.route = route;
  if (location.hash !== hash) location.hash = hash;
  else paint();
}

function onHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = parts[0] || (state.onboarded ? 'hoje' : 'inicio');
  const id = parts[1] || '';
  const extra = parts[2] || '';
  if (!(name === 'dia' && id === 'm2')) { state.toastHtml = ''; state.toastOn = state.toast ? state.toastOn : false; }
  state.route = { name, id, extra };
  if (name === 'tuk' && extra === 'novo' && state.model) {
    const maint = (state.model.types || []).find(t => t.id === 'g4');
    state.sheet = { type: 'gasto', tukId: id, typeId: maint ? maint.id : '', amount: '10' };
  }
  if (name === 'dia' && id === 'm2' && state.model && state.date === state.model.today && !state.toastHtml && !sessionStorage.getItem('tm.swap')) {
    const n = (state.model.notices || []).find(x => x.date === state.date && x.toId === 'm2');
    if (n) {
      const tuk = state.model.tuks.find(t => t.id === n.tukId);
      const other = state.model.drivers.find(d => d.id === n.fromId);
      state.toastHtml = `${tuk ? tukTitleSafe(tuk) : 'O tuk'} passou para o João. <b style="color:var(--g400)">O ${other ? other.name : 'outro'} ficou sem tuk.</b>`;
      sessionStorage.setItem('tm.swap', '1');
      armToast();
    }
  }
  paint();
}
function tukTitleSafe(t) {
  return 'Tuk ' + String(t.number).padStart(2, '0') + (t.nickname ? ' ' + t.nickname : '');
}

subscribe(() => {
  if (state.route && state.route.name) {
    const hash = '#/' + state.route.name + (state.route.id ? '/' + state.route.id : '');
    if (location.hash !== hash && state.ready) history.replaceState(null, '', hash);
  }
  paint();
});

document.body.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (state.busy) return;
  const act = el.dataset.act;
  if (act === 'go') { go(el.dataset.to, el.dataset.id); return; }
  if (act === 'back') {
    const back = { dia: 'hoje', tuk: 'mes', def: 'hoje', tipos: 'def', folha: 'def', pessoas: 'def' }[state.route.name] || 'hoje';
    go(back);
    return;
  }
  if (act === 'step') {
    const dir = Number(el.dataset.dir);
    if (el.dataset.what === 'day' && state.model) {
      setDate(addDays(state.date, dir));
    } else if (el.dataset.what === 'month') {
      let m = state.month + dir;
      if (m < 1) m = 1;
      if (m > 12) m = 12;
      setMonth(m);
    } else if (el.dataset.what === 'year') {
      note('Cada ano tem a sua folha. Cria-a em Definições.');
    }
    return;
  }
  if (act === 'demo') { startDemo(); return; }
  if (act === 'ask-exit-demo') { openSheet({ type: 'exit-demo' }); return; }
  if (act === 'confirm-exit-demo') { closeSheet(); exitDemo(); return; }
  if (act === 'google') { readDraft(); connectGoogle(el.dataset.select === '1'); return; }
  if (act === 'signout') { signOut(); return; }
  if (act === 'create') { submitSetup(); return; }
  if (act === 'toggle-dd') {
    readDraft();
    state.draft = state.draft || {};
    state.draft.dd = !state.draft.dd;
    paint();
    return;
  }
  if (act === 'pick-num') {
    state.draft = state.draft || {};
    state.draft.number = Number(el.dataset.n);
    state.draft.dd = false;
    readDraft();
    paint();
    return;
  }
  if (act === 'fuel') {
    readDraft();
    state.draft.fuel = el.dataset.fuel;
    paint();
    return;
  }
  if (act === 'owner-sw') {
    readDraft();
    state.draft.owner = !(state.draft.owner !== false);
    paint();
    return;
  }
  if (act === 'open-driver') { go('dia', el.dataset.id); return; }
  if (act === 'open-tuk') { go('tuk', el.dataset.id); return; }
  if (act === 'open-day') { if (el.dataset.date) setDate(el.dataset.date); go('dia', el.dataset.id); return; }
  if (act === 'pick-tuk') {
    dispatch({ type: 'assign-tuk', driverId: driverId(), date: state.date, tukId: el.dataset.id, time: nowHM() });
    return;
  }
  if (act === 'add-service') return addMoney('add-service', null, el);
  if (act === 'add-daily') return addMoney('add-daily', null, el);
  if (act === 'add-entrega') return addMoney('add-entrega', null, el);
  if (act === 'add-grat') return addMoney('add-grat', null, el);
  if (act === 'add-month') return addMonth();
  if (act === 'quick') {
    const root = el.closest('section, .sheet') || document;
    const input = root.querySelector('input[data-money], #gasto-amt, input');
    if (input) {
      input.value = el.dataset.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return;
  }
  if (act === 'cat') {
    document.querySelectorAll('main .cat').forEach(b => b.classList.toggle('on', b === el));
    return;
  }
  if (act === 'zero') { dispatch({ type: 'zero-day', driverId: driverId(), date: state.date }); return; }
  if (act === 'save-note') {
    const note = document.getElementById('note');
    dispatch({ type: 'set-note', driverId: driverId(), date: state.date, note: note ? note.value : '' });
    return;
  }
  if (act === 'edit-part') {
    const chip = el.textContent.replace(/[^\d,.-]/g, '').replace(',', '.');
    openSheet({ type: 'part', kind: el.dataset.kind, id: el.dataset.id, date: el.dataset.date, index: Number(el.dataset.index), amount: chip });
    return;
  }
  if (act === 'delete-part') return savePart(null);
  if (act === 'save-part') return savePart(moneyOf(document.getElementById('part-amt')));
  if (act === 'close-sheet' || act === 'close-missing') { state.missing = null; closeSheet(); return; }
  if (act === 'open-gasto') { openSheet({ type: 'gasto', tukId: el.dataset.id, typeId: 'g4', amount: '' }); return; }
  if (act === 'gasto-type') { state.sheet = { ...state.sheet, typeId: el.dataset.type }; paint(); return; }
  if (act === 'confirm-gasto') return confirmGasto();
  if (act === 'edit-fixed') { openSheet({ type: 'fixed', typeId: el.dataset.type, tukId: el.dataset.tuk }); return; }
  if (act === 'save-fixed') {
    const amt = moneyOf(document.getElementById('fixed-amt'));
    if (!(amt >= 0)) return;
    dispatch({ type: 'set-fixed', typeId: el.dataset.type, tukId: el.dataset.tuk, year: state.model.year, month: state.month, amount: amt });
    closeSheet();
    return;
  }
  if (act === 'tips') { dispatch({ type: 'set-tips', on: !state.model.tipsEnabled }); return; }
  if (act === 'open-driver-card') { openSheet({ type: 'driver', id: el.dataset.id }); return; }
  if (act === 'open-tuk-card') { openSheet({ type: 'tuk', id: el.dataset.id }); return; }
  if (act === 'open-new-driver') { openSheet({ type: 'new-driver' }); return; }
  if (act === 'card-owner' || act === 'card-active' || act === 'nd-owner' || act === 'edit-sold' || act === 'type-rep' || act === 'type-fuel') {
    el.classList.toggle('on');
    return;
  }
  if (act === 'edit-fuel' || act === 'new-fuel' || act === 'type-freq') {
    el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
    if (act === 'type-freq') {
      const rep = document.getElementById('type-repeat');
      if (rep) rep.style.display = el.dataset.freq === 'Mensal' ? '' : 'none';
    }
    return;
  }
  if (act === 'save-driver') return saveDriver(el.dataset.id);
  if (act === 'save-tuk') return saveTuk(el.dataset.id);
  if (act === 'save-new-driver') return saveNewDriver();
  if (act === 'add-tuk') return addTuk();
  if (act === 'add-type') return addType();
  if (act === 'del-type') { dispatch({ type: 'update-type', id: el.dataset.id, active: false }); return; }
  if (act === 'edit-type') {
    const found = state.model.types.find(t => t.id === el.dataset.id);
    openSheet({ type: 'rename', id: el.dataset.id, name: found ? found.name : '' });
    return;
  }
  if (act === 'save-rename') {
    const name = String((document.getElementById('rename-name') || {}).value || '').trim();
    if (!name || !state.sheet) return;
    dispatch({ type: 'update-type', id: state.sheet.id, name });
    closeSheet();
    return;
  }
  if (act === 'pick-year') {
    state.yearChoice = Number(el.dataset.year);
    paint();
    return;
  }
  if (act === 'pick-year-other') {
    openSheet({ type: 'year', year: String((state.yearChoice || state.model.year + 1)) });
    return;
  }
  if (act === 'save-year') {
    const year = Number(String((document.getElementById('year-other') || {}).value || '').trim());
    if (!(year >= 1991 && year <= 2100)) return;
    state.yearChoice = year;
    closeSheet();
    return;
  }
  if (act === 'create-year') { createYear(Number(el.dataset.year)); return; }
  if (act === 'restore') { restoreLook(false); return; }
  if (act === 'restore-yes') { restoreLook(true); return; }
  if (act === 'suggest') {
    const values = suggestions(state.model);
    if (!values) { note('Ainda não há um ano anterior para propor.'); return; }
    dispatch({ type: 'set-objectives', amounts: values });
    return;
  }
  if (act === 'prize-sw') {
    el.classList.toggle('on');
    const amt = moneyOf(document.getElementById('prize-amt'));
    const month = Number(String(state.model.today).slice(5, 7)) || state.month;
    dispatch({ type: 'set-prize', year: state.model.year, month, active: el.classList.contains('on'), amount: amt || 0 });
    return;
  }
  if (act === 'drv-active') {
    ev.stopPropagation();
    const d = state.model.drivers.find(x => x.id === el.dataset.id);
    dispatch({ type: 'update-driver', id: el.dataset.id, active: d ? !d.active : true });
    return;
  }
});

document.body.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'biz-edit') dispatch({ type: 'set-business', name: t.value });
  if (t.dataset.act === 'obj-input') {
    const n = moneyOf(t);
    if (n >= 0) dispatch({ type: 'set-objective', month: Number(t.dataset.month), amount: n });
  }
  if (t.id === 'note') dispatch({ type: 'set-note', driverId: driverId(), date: state.date, note: t.value });
  if (t.id === 'prize-amt') {
    const sw = document.querySelector('[data-act="prize-sw"]');
    const month = Number(String(state.model.today).slice(5, 7)) || state.month;
    dispatch({ type: 'set-prize', year: state.model.year, month, active: sw ? sw.classList.contains('on') : true, amount: moneyOf(t) || 0 });
  }
  if (t.id === 'plate') plateWarn(t);
});

document.body.addEventListener('input', (ev) => {
  if (ev.target.id === 'biz') {
    readDraft();
    const name = document.getElementById('file-name');
    if (name) name.textContent = ev.target.value || 'o teu negócio';
    markSteps();
  }
  if (ev.target.id === 'plate') plateWarn(ev.target);
  if (['nick', 'driver', 'plate'].includes(ev.target.id)) { readDraft(); markSteps(); }
  if (ev.target.id === 'gasto-amt' && state.sheet) {
    state.sheet = { ...state.sheet, amount: ev.target.value };
    const box = document.querySelector('.sheet .test-out');
    if (box) paint();
  }
});

function markSteps() {
  const steps = document.querySelectorAll('#steps i');
  if (!steps.length) return;
  const d = state.draft || {};
  steps[0].classList.toggle('on', !!(d.business || '').trim());
  steps[1].classList.toggle('on', !!(state.emailLabel || '').includes('ligada'));
  steps[2].classList.toggle('on', !!(d.driver || '').trim() && !!(d.number || 1));
}

function submitSetup() {
  readDraft();
  const d = state.draft || {};
  if (!(d.business || '').trim()) { note('Falta o nome do negócio.', true); return; }
  if (!(d.driver || '').trim()) { note('Falta o nome do motorista.', true); return; }
  if (!(state.emailLabel || '').includes('ligada')) {
    note('Entra com Google, ou experimenta a demonstração.', true);
    return;
  }
  createFromSetup({
    business: d.business, number: d.number || 1, nickname: d.nick, plate: d.plate,
    fuel: d.fuel || 'combustão', driver: d.driver, owner: d.owner !== false, year: new Date().getFullYear()
  });
}

function addMoney(type, preset, el) {
  const scope = el && el.closest('section') ? el.closest('section') : document.querySelector('main');
  const amount = preset != null ? preset : fieldMoney(scope);
  if (!(amount >= 0)) return;
  const id = driverId();
  if (type === 'add-service') dispatch({ type: 'add-service', driverId: id, date: state.date, amount });
  if (type === 'add-grat') dispatch({ type: 'add-grat', driverId: id, date: state.date, amount });
  if (type === 'add-entrega') dispatch({ type: 'add-entrega', driverId: id, date: state.date, amount });
  if (type === 'add-daily') {
    const tuk = tukOfDriver();
    const typeId = selectedType() || firstDaily(tuk);
    if (!tuk || !typeId) return;
    dispatch({ type: 'add-daily', tukId: tuk, date: state.date, typeId, amount });
  }
}
function tukOfDriver() {
  const id = driverId();
  const rec = state.model && state.model.days[id] && state.model.days[id][state.date];
  return rec && rec.tukId;
}
function firstDaily(tukId) {
  const tuk = (state.model.tuks || []).find(t => t.id === tukId);
  const types = (state.model.types || []).filter(t => t.active && t.freq === 'Diário' && (t.scope !== 'combustão' || (tuk && tuk.fuel === 'combustão')));
  return types[0] && types[0].id;
}
function addMonth() {
  const amount = fieldMoney(document.querySelector('main'));
  if (!(amount >= 0)) return;
  const section = document.activeElement && document.activeElement.closest('section');
  const card = section || document.querySelector('main .card .btn-gold')?.closest('section');
  const typeBtn = card && card.querySelector('[data-act="add-month"]');
  const title = card && card.querySelector('.card-title');
  const tp = (state.model.types || []).find(t => title && t.name === title.textContent && t.freq === 'Mensal' && !t.repeat);
  if (!tp) return;
  dispatch({ type: 'add-monthly', tukId: tukId(), year: state.model.year, month: state.month, typeId: tp.id, amount });
  void typeBtn;
}
function confirmGasto() {
  const sh = state.sheet || {};
  const amount = moneyOf(document.getElementById('gasto-amt'));
  if (!(amount >= 0) || !sh.typeId) return;
  const tp = state.model.types.find(t => t.id === sh.typeId);
  if (tp && tp.freq === 'Mensal') dispatch({ type: 'add-monthly', tukId: sh.tukId, year: state.model.year, month: state.month, typeId: tp.id, amount });
  else {
    const { y, m } = parseISO(state.date);
    const dim = daysInMonth(y, m);
    let date = state.date;
    if (parseISO(state.date).m !== state.month) date = iso(state.model.year, state.month, Math.min(dim, 1));
    dispatch({ type: 'add-daily', tukId: sh.tukId, date, typeId: tp.id, amount });
  }
  closeSheet();
}
function savePart(amount) {
  const sh = state.sheet;
  if (!sh) return;
  if (sh.kind === 'service') dispatch({ type: 'set-service', driverId: driverId(), date: sh.date, index: sh.index, amount });
  if (sh.kind === 'grat') dispatch({ type: 'set-grat', driverId: driverId(), date: sh.date, index: sh.index, amount });
  if (sh.kind === 'entrega') dispatch({ type: 'set-entrega', driverId: driverId(), date: sh.date, index: sh.index, amount });
  if (sh.kind === 'daily') dispatch({ type: 'set-daily', tukId: tukOfDriver(), date: sh.date, typeId: sh.id, index: sh.index, amount });
  if (sh.kind === 'month') {
    const [y, mo] = (sh.date || '').split('-');
    dispatch({ type: 'set-monthly-part', tukId: tukId(), year: Number(y), month: Number(mo), typeId: sh.id, index: sh.index, amount });
  }
  closeSheet();
}
function saveDriver(id) {
  const name = document.getElementById('card-name').value;
  const owner = document.getElementById('card-owner')?.classList.contains('on');
  const active = document.getElementById('card-active')?.classList.contains('on');
  const pctEl = document.getElementById('card-pct');
  const from = (document.getElementById('card-from') || {}).value || state.model.today;
  const pct = pctEl ? Number(String(pctEl.value).replace(',', '.')) / 100 : undefined;
  dispatch({ type: 'update-driver', id, name, owner, active, pct, from });
  closeSheet();
}
function saveTuk(id) {
  const nick = document.getElementById('edit-nick').value;
  const plate = document.getElementById('edit-plate').value;
  const fuelBtn = document.querySelector('#edit-fuel .on');
  const sold = document.getElementById('edit-sold').classList.contains('on');
  dispatch({ type: 'update-tuk', id, nickname: nick, plate, fuel: fuelBtn ? fuelBtn.dataset.fuel : undefined, sold });
  closeSheet();
}
function saveNewDriver() {
  const name = document.getElementById('nd-name').value;
  const pct = Number(String(document.getElementById('nd-pct').value).replace(',', '.')) / 100;
  const owner = document.getElementById('nd-owner').classList.contains('on');
  dispatch({ type: 'add-driver', name, pct, owner, since: state.model.today });
  closeSheet();
}
function addTuk() {
  const on = document.querySelector('#new-num-dd .o.on span');
  const num = on ? Number(on.textContent.replace(/\D/g, '')) : Number((state.draft || {}).newNum || 0);
  const fuel = (document.querySelector('#new-fuel .on') || {}).dataset?.fuel || 'elétrico';
  dispatch({
    type: 'add-tuk',
    number: num,
    fuel,
    nickname: document.getElementById('new-nick').value,
    plate: document.getElementById('new-plate').value
  });
}
function addType() {
  const freq = (document.querySelector('#type-freq .on') || {}).dataset?.freq || 'Mensal';
  dispatch({
    type: 'add-type',
    name: document.getElementById('type-name').value,
    freq,
    repeat: document.getElementById('type-rep')?.classList.contains('on'),
    scope: document.getElementById('type-fuel')?.classList.contains('on') ? 'combustão' : 'todos',
    amount: moneyOf(document.getElementById('type-amt'))
  });
}
function nowHM() {
  const d = new Date();
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

window.addEventListener('hashchange', onHash);
state.draft = { number: 1, fuel: 'combustão', owner: true, business: '', nick: '', plate: '', driver: '' };

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  const base = location.pathname.includes('/tuk-manager/') ? '/tuk-manager/' : './';
  navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
}

boot().then(() => {
  if (location.hash) onHash();
});

window.tmState = state;

void flush;
void daysInMonth;
