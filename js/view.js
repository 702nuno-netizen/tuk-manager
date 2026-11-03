/* Ecrãs. O HTML usa as classes dos esboços aprovados. */

import {
  MESES, MESES_C, SEMANA_C, addDays, dayHeading, escapeHtml, eur, eur0, initials,
  monthHeading, parseISO, pctLabel, plateBad, tukTitle, weekday
} from './format.js';
import {
  activeDrivers, dailyTypes, dayCompany, dayRec, driverMonth, isOwnerAt, monthlyAmount,
  monthlyTypes, monthView, pctAt, prizeAt, saldoAte, sharesOf, suggestFromPrior,
  tukMonth, visibleTuks, yearView
} from './model.js';

let logoN = 0;
const I = {
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 7v6M12 17h.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8 20 3M16.5 6.5l2.5 2.5M14 9l2 2"/></svg>',
  tuk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5V7a2 2 0 0 1 2-2h11.5a2 2 0 0 1 1.9 1.4L20 11"/><path d="M5 5v8.5M16.5 5.5 18 11"/><path d="M2.5 13.5h11.2l1.6-2.5H20a1.6 1.6 0 0 1 1.6 1.6v2.1c0 .8-.6 1.3-1.3 1.3h-.6"/><path d="M2.5 13.5v1.8c0 .6.4.9.9.9h.8M9 16.2h7"/><circle cx="6.6" cy="16.6" r="2.1"/><circle cx="18.2" cy="16.8" r="1.9"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M3 20h12M4 10h10"/><path d="M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>',
  garage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-8h10v8M7 16h10"/></svg>',
  cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4c1.9.8 3 2.7 3 5.6"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9.5 17h5v4h-5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>',
  hoje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17"/><rect x="8" y="13" width="4" height="4" rx="1" fill="currentColor" stroke="none"/></svg>',
  mes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  ano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  obj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>'
};
const G = '<svg width="22" height="22" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function logo() {
  const id = 'tg' + (++logoN);
  return `<svg viewBox="2 7 60 44" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d77a"/><stop offset="1" stop-color="#c9952a"/></linearGradient></defs><path d="M7 14 Q7 9 12 9 H43 Q49 9 51.5 14 L55.5 27 H52 L48.6 15.2 Q48 14 46.5 14 Z" fill="url(#${id})"/><rect x="8.6" y="13" width="3" height="19" rx="1.2" fill="#fff"/><path d="M46.6 15.5 L50 27 H44.5 L43.8 15.5 Z" fill="#fff" opacity=".42"/><rect x="15" y="20.5" width="13" height="11.5" rx="3" fill="#fff" opacity=".55"/><path d="M6.5 31 H37 Q40 31 41.5 28.6 L42.4 27 H53.5 Q58.6 27 59 32.5 L59.4 38 Q59.6 42 55.6 42 H8.5 Q4 42 4 37.8 V33.5 Q4 31 6.5 31 Z" fill="#fff"/><rect x="8" y="35" width="29" height="1.8" rx=".9" fill="url(#${id})"/><circle cx="16" cy="43" r="6.4" fill="#0d2547" stroke="#fff" stroke-width="2.4"/><circle cx="16" cy="43" r="2.3" fill="url(#${id})"/><circle cx="50" cy="43.4" r="5.6" fill="#0d2547" stroke="#fff" stroke-width="2.4"/><circle cx="50" cy="43.4" r="2" fill="url(#${id})"/></svg>`;
}
function brandName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return escapeHtml(name || '');
  const last = parts.pop();
  return escapeHtml(parts.join(' ')) + ' <em>' + escapeHtml(last) + '</em>';
}
function plate(p) {
  const v = String(p || '').trim();
  if (!v) return '<kbd class="plate none">sem matrícula</kbd>';
  return `<kbd class="plate">${escapeHtml(v)}</kbd>`;
}
function nav(on) {
  const items = [['hoje', 'Hoje', I.hoje], ['mes', 'Mês', I.mes], ['ano', 'Ano', I.ano], ['obj', 'Objetivos', I.obj]];
  return '<nav class="nav">' + items.map(([k, l, ic]) => `<button type="button" class="${k === on ? 'on' : ''}" data-act="go" data-to="${k}"><span class="pill"></span>${ic}<span>${l}</span></button>`).join('') + '</nav>';
}
function stepper(k, v, pill, act) {
  return `<div class="stepper"><button type="button" class="step-btn" data-act="step" data-dir="-1" data-what="${act}">${I.left}</button><div class="step-mid"><div class="step-k">${escapeHtml(k)}</div><div class="step-v">${escapeHtml(v)}</div>${pill || ''}</div><button type="button" class="step-btn" data-act="step" data-dir="1" data-what="${act}">${I.right}</button></div>`;
}
function heroBrand(name, sub) {
  return `<header class="hero"><div class="brand"><div class="brand-logo">${logo()}</div><div class="brand-txt"><div class="brand-name">${brandName(name)}</div><div class="brand-sub">${escapeHtml(sub)}</div></div><button type="button" class="icon-btn" data-act="go" data-to="def" aria-label="Definições">${I.gear}</button></div>`;
}
function heroBack(title, sub, rest) {
  return `<header class="hero" style="padding-bottom:${rest ? 64 : 58}px"><div class="brand"><button type="button" class="icon-btn" data-act="back" aria-label="Voltar">${I.back}</button><div class="brand-txt"><div class="brand-name">${escapeHtml(title)}</div><div class="brand-sub">${escapeHtml(sub)}</div></div><div class="brand-logo">${logo()}</div></div>`;
}
function closeHero() { return '</header>'; }
function pctInt(ratio) { return Math.round((Number(ratio) || 0) * 100 + 1e-8); }
function bar(p) {
  const w = Math.max(0, Math.min(100, p));
  return `<div class="bar"><i style="width:${w.toFixed(1)}%"></i></div>`;
}
function ring(p, label) {
  const C = 2 * Math.PI * 50;
  const off = C * (1 - Math.min(1, p / 100));
  return `<div class="ring"><svg viewBox="0 0 120 120"><defs><linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0cf6e"/><stop offset="1" stop-color="#c9952a"/></linearGradient></defs><circle class="bg" cx="60" cy="60" r="50"/><circle class="fg" cx="60" cy="60" r="50" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg><div class="ring-c"><div><b class="num">${Math.round(p)}%</b><small>${escapeHtml(label)}</small></div></div></div>`;
}
function chips(parts, kind, id, date) {
  if (!parts || !parts.length) return '';
  return '<div class="chips">' + parts.map((v, i) => `${i ? '<span class="plus">+</span>' : ''}<button type="button" class="chip num" data-act="edit-part" data-kind="${kind}" data-id="${id}" data-date="${date || ''}" data-index="${i}">${String(v).replace('.', ',')}${I.pen}</button>`).join('') + '</div>';
}
function addRow(gold, ph, act, extra) {
  return `<div class="add-row"><div class="money"><input inputmode="decimal" placeholder="${ph || 'Valor'}" data-money="1" ${extra || ''}><span>€</span></div><button type="button" class="btn ${gold ? 'btn-gold' : 'btn-primary'}" data-act="${act}">${I.plus}Adicionar</button></div>`;
}
function quick(vals, act) {
  return '<div class="quick">' + vals.map(v => `<button type="button" class="q" data-act="quick" data-value="${v}" data-target="${act}">${v} €</button>`).join('') + '</div>';
}
function toast(s) {
  const msg = s.toastHtml || (s.toast ? escapeHtml(s.toast) : '');
  if (!msg) return '';
  return `<div class="toast show ${s.toastErr ? 'err' : ''}"><div class="t-ic">${s.toastErr ? I.alert : I.check}</div><div>${msg}</div></div>`;
}
function offline(s) {
  if (!s.offline && !s.pending.length) return '';
  if (s.mode !== 'google') return '';
  const txt = s.offline ? 'Sem rede. O que lançares fica neste telemóvel e segue quando voltares a ter ligação.' : `A gravar ${s.pending.length} alteração${s.pending.length > 1 ? 'ões' : ''}…`;
  return `<div class="offline-bar">${s.pending.length ? '<i class="pending-dot"></i>' : ''}${escapeHtml(txt)}</div>`;
}

function setup(s) {
  const year = new Date().getFullYear();
  const d = s.draft || {};
  const num = d.number || 1;
  const fuel = d.fuel || 'combustão';
  const owner = d.owner !== false;
  const linked = s.emailLabel && s.emailLabel.indexOf('ligada') >= 0;
  const google = linked
    ? `<div class="connected"><div class="cf-ic" style="background:#fff">${I.check}</div><div style="flex:1;min-width:0"><b>Ligada</b><span>${escapeHtml(s.emailLabel)}</span></div><button type="button" class="link-btn" data-act="google" data-select="1">Trocar</button></div>`
    : `<button type="button" class="gbtn" data-act="google">${G} Entrar com Google</button>`;
  return `<div class="setup" style="justify-content:flex-start;padding-top:36px">
    <img class="logo-xl" src="icons/icon-192.png" alt="">
    <h1>Tuk <em>Manager</em></h1>
    <p style="margin-bottom:14px">Os tuks, os motoristas e as contas do mês, no telemóvel.</p>
    <div class="steps" id="steps"><i></i><i></i><i></i></div>
    <section class="card"><div class="card-h"><div class="card-ic gold">${I.shop}</div><div class="card-t"><div class="card-title">1 · Nome do negócio</div><div class="card-sub">Aparece no topo da app. Podes mudá-lo depois.</div></div></div>
      <div class="field" style="margin-bottom:0"><input id="biz" placeholder="Nome do negócio" autocomplete="organization" value="${escapeHtml(d.business || '')}"></div></section>
    <section class="card"><div class="card-h"><div class="card-ic">${I.globe}</div><div class="card-t"><div class="card-title">2 · Conta Google</div><div class="card-sub">A folha fica na tua Drive. A app só vê os ficheiros que ela cria.</div></div></div>
      <div id="google-slot">${google}</div></section>
    <section class="card"><div class="card-h"><div class="card-ic">${I.tuk}</div><div class="card-t"><div class="card-title">3 · Primeiro tuk e motorista</div><div class="card-sub">Os outros acrescentas depois, em Definições.</div></div></div>
      <div class="field"><label>Número<span class="req">*</span></label><div class="sel" id="num-sel" data-act="toggle-dd">Tuk ${pad2(num)} <span style="color:var(--b600)">▾</span></div>
        <div class="dd ${d.dd ? '' : 'hidden'}" id="num-dd">${[1, 2, 3, 4, 5, 6].map(n => `<button type="button" class="o${n === num ? ' on' : ''}" data-act="pick-num" data-n="${n}"><span>Tuk ${pad2(n)}</span><small>${n === num ? 'escolhido' : 'livre'}</small></button>`).join('')}<div class="more">… até 50</div></div></div>
      <div class="field"><label>Tipo<span class="req">*</span></label><div class="seg" id="fuel-seg"><button type="button" class="${fuel === 'combustão' ? 'on' : ''}" data-act="fuel" data-fuel="combustão">Combustão</button><button type="button" class="${fuel === 'elétrico' ? 'on' : ''}" data-act="fuel" data-fuel="elétrico">Elétrico</button></div></div>
      <div class="year-row" style="margin-bottom:16px"><div class="field"><label>Alcunha<span class="opt">(opcional)</span></label><input id="nick" placeholder="Ex.: Azul" value="${escapeHtml(d.nick || '')}"></div><div class="field"><label>Matrícula<span class="opt">(opcional)</span></label><input id="plate" placeholder="AA-00-AA" value="${escapeHtml(d.plate || '')}" style="font-weight:700;letter-spacing:.06em"></div></div>
      <p class="field hint" id="plate-hint" hidden>Fora do formato AA-00-AA. Podes gravar na mesma — é só um aviso.</p>
      <div class="field"><label>Motorista</label><input id="driver" placeholder="Nome" autocomplete="name" value="${escapeHtml(d.driver || '')}"></div>
      <div class="set-row" style="padding:4px 0 2px;border:0"><div class="sm"><b>Sou eu, o patrão</b><span>Sem percentagem nem entregas</span></div><button type="button" class="sw ${owner ? 'on' : ''}" id="owner-sw" data-act="owner-sw" aria-pressed="${owner}"></button></div>
    </section>
    <button type="button" class="btn btn-gold btn-block" data-act="create">Criar a folha de ${year} e começar</button>
    <p style="font-size:12.5px;margin:12px 0 0">A app cria a folha «<span id="file-name">${escapeHtml(d.business || 'o teu negócio')}</span> · ${year}» na tua Drive.</p>
    <button type="button" class="link-demo" data-act="demo">Experimentar com dados de demonstração</button>
    <p style="font-size:12px;margin-top:18px"><a href="privacy.html" style="color:var(--g400)">Privacidade</a> · <a href="terms.html" style="color:var(--g400)">Termos</a></p>
  </div>`;
}
function pad2(n) { return String(n).padStart(2, '0'); }

function noticeFor(model, date, who) {
  return (model.notices || []).find(n => n.date === date && (!who || n.fromId === who || n.toId === who));
}

function hoje(s) {
  const m = s.model;
  const date = s.date;
  const head = dayHeading(date);
  const day = dayCompany(m, date);
  const pill = date === m.today ? '<span class="today-pill">● Hoje</span>' : '';
  const mv = day.month;
  const pct = pctInt(mv.pct || 0);
  const sem = day.people.filter(p => p.semTuk);
  let alert = '';
  if (sem.length) {
    const n = noticeFor(m, date, sem[0].driver.id);
    const tuk = n && m.tuks.find(t => t.id === n.tukId);
    const to = n && m.drivers.find(d => d.id === n.toId);
    const text = n && tuk && to
      ? `Passaste o ${tukTitle(tuk)} para o ${to.name} às ${n.time}. Escolhe um tuk para o ${sem[0].driver.name} antes de lançar os valores dele.`
      : 'Escolhe um tuk antes de lançar serviços ou gastos.';
    alert = `<div class="alert"><div class="a-ic">${I.alert}</div><div><b>O ${escapeHtml(sem[0].driver.name)} está sem tuk</b><span>${escapeHtml(text)}</span></div></div>`;
  }
  const rows = day.people.map(p => {
    const d = p.driver;
    const tag = p.owner ? '<span class="tag gold">Patrão</span>' : (p.semTuk ? '<span class="tag bad">Sem tuk</span>' : `<span class="tag">${Math.round(p.sh.pct * 100)}%</span>`);
    let sub = 'Ainda não escolheu um tuk';
    if (!p.semTuk) {
      const bits = [tukTitle(p.tuk)];
      if (p.services) bits.push(p.services + (p.services === 1 ? ' serviço' : ' serviços'));
      if (p.grat) bits.push('+' + eur0(p.grat).replace(' €', '') + ' € grat.');
      sub = bits.join(' · ');
    }
    let right = '<div class="dright num off">—</div>';
    if (!p.semTuk) {
      const small = p.owner ? '<small style="color:var(--muted)">empresa</small>' : (p.due > 0.004 ? `<small style="color:var(--g600)">por entregar ${eur(p.due)}</small>` : (p.entregue > 0 ? '<small style="color:var(--ok)">entregue ✓</small>' : ''));
      right = `<div class="dright num">${eur(p.sh.fat)}${small}</div>`;
    }
    const av = p.semTuk ? 'grey' : (p.owner ? 'gold' : '');
    return `<button type="button" class="dayrow${p.semTuk ? ' off' : ''}" data-act="open-driver" data-id="${d.id}"><div class="av ${av}">${initials(d.name)}</div><div class="dmid"><b>${escapeHtml(d.name)}${tag}</b><span>${escapeHtml(sub)}</span></div>${right}</button>`;
  }).join('');
  const tuks = day.tukRows.map(t => {
    const who = t.drivers[0];
    const bits = [];
    if (who) bits.push(who.name);
    const parts = Object.entries(t.ex.byType).filter(([, v]) => v > 0);
    if (!parts.length) bits.push(who ? 'sem gastos' : 'sem motorista');
    else if (parts.length === 1) bits.push('gasto ' + eur(parts[0][1]));
    else {
      const detail = parts.map(([id, v]) => {
        const tp = m.types.find(x => x.id === id);
        return (tp ? tp.name.toLowerCase() : 'gasto') + ' ' + eur(v);
      }).join(', ');
      bits.push('gasto ' + eur(t.ex.total) + ' (' + detail + ')');
    }
    const fuel = t.tuk.fuel === 'combustão';
    return `<button type="button" class="dayrow" data-act="open-tuk" data-id="${t.tuk.id}"><div class="dnum"><div><b>${pad2(t.tuk.number)}</b><small>tuk</small></div></div><div class="dmid"><b>${escapeHtml(tukTitle(t.tuk))}<span class="tag${fuel ? ' gold' : ''}">${fuel ? 'Combustão' : 'Elétrico'}</span></b>${plate(t.tuk.plate)}<span>${escapeHtml(bits.join(' · '))}</span></div><div class="dright num">${eur(t.fat)}</div></button>`;
  }).join('');
  return heroBrand(m.businessName, 'Gestão diária · ' + m.year) + stepper(head.k, head.v, pill, 'day') + closeHero() +
    `<main class="page">${offline(s)}<section class="card summary"><div class="sum-top"><span class="sum-label">Lucro da empresa hoje</span><span class="badge work">${day.working} a trabalhar</span></div><div class="sum-big num">${eur(day.lucro)}</div><div class="sum-row"><div class="mini"><div class="mini-k">Faturado</div><div class="mini-v num">${eur(day.fat)}</div></div><div class="mini gold"><div class="mini-k">Despesa</div><div class="mini-v num">${eur(day.desp)}</div></div></div><div class="strip"><div class="strip-row"><span>${MESES[parseISO(date).m - 1]} · <b class="num">${eur(mv.fat)}</b> de ${eur0(mv.companyObj)}</span><b class="num">${pct}%</b></div>${bar(mv.pct * 100)}</div></section>${alert}<div class="sec-title">Motoristas hoje</div><section class="card" style="padding:6px 14px"><div class="days">${rows}</div></section><div class="sec-title">Tuks hoje</div><section class="card" style="padding:6px 14px"><div class="days">${tuks}</div></section><p class="muted" style="text-align:center;font-size:12.5px;margin:6px 0 0">Toca num motorista para lançar o dia dele</p></main>` + nav('hoje');
}

function tukPicker(m, date, currentId) {
  const tuks = visibleTuks(m, date);
  return '<div class="tuks">' + tuks.map(t => {
    const who = m.drivers.filter(d => {
      const rec = dayRec(m, d.id, date);
      return rec && rec.tukId === t.id;
    });
    const on = currentId === t.id;
    const label = on ? 'Escolhido' : (who[0] ? 'com ' + who[0].name : 'livre');
    const fuel = t.fuel === 'combustão';
    return `<button type="button" class="tukp ${on ? 'on' : who.length ? 'taken' : ''}" data-act="pick-tuk" data-id="${t.id}"><b>Tuk ${pad2(t.number)}</b>${plate(t.plate)}<span>${escapeHtml(t.nickname || '')}</span><span class="who">${escapeHtml(label)}</span><span class="ty ${fuel ? 'c' : ''}">${fuel ? 'Combustão' : 'Elétrico'}</span></button>`;
  }).join('') + '</div>';
}

function dia(s) {
  const m = s.model;
  const d = m.drivers.find(x => x.id === s.route.id);
  if (!d) return hoje(s);
  const date = s.date;
  const head = dayHeading(date);
  const rec = dayRec(m, d.id, date);
  const owner = isOwnerAt(m, d.id, date);
  const pct = pctAt(m, d.id, date);
  const sh = sharesOf(m, d.id, date, rec);
  const tuk = rec && rec.tukId ? m.tuks.find(t => t.id === rec.tukId) : null;
  const sub = owner ? 'Patrão · sem % nem entregas' : `Motorista · ganha ${Math.round((pct.pct || 0) * 100)}%`;
  const pill = date === m.today ? '<span class="today-pill">● Hoje</span>' : '';
  const blocked = !tuk;
  const n = noticeFor(m, date, d.id);
  let warn = '';
  if (blocked) {
    const fromTuk = n && m.tuks.find(t => t.id === n.tukId);
    const to = n && m.drivers.find(x => x.id === n.toId);
    const text = n && fromTuk && to && n.fromId === d.id
      ? `Às ${n.time} o ${tukTitle(fromTuk)} passou para o ${to.name} e o ${d.name} ficou sem tuk. Escolhe um tuk para ele antes de lançar serviços ou gastos.`
      : 'Escolhe um tuk antes de lançar serviços ou gastos.';
    warn = `<div class="alert big"><div class="a-ic">${I.lock}</div><b>Escolhe primeiro um tuk</b><span>${escapeHtml(text)}</span></div>`;
  }
  const month = driverMonth(m, d.id, m.year, parseISO(date).m);
  const obj = (m.objectives.find(o => o.month === parseISO(date).m) || {}).amount || 0;
  const goalPct = obj ? Math.round(month.fat / obj * 100) : 0;
  const types = tuk ? dailyTypes(m, tuk) : [];
  const exp = tuk ? (m.tukDays[tuk.id] || {})[date] : null;
  const expTotal = exp ? Object.values(exp.byType || {}).reduce((s, p) => s + p.reduce((a, b) => a + b, 0), 0) : 0;
  const fuelHidden = tuk && tuk.fuel === 'elétrico' && m.types.some(t => t.id === 'g1' && t.active);
  const services = rec ? rec.services : [];
  const entregue = rec ? sumList(rec.entregue) : 0;
  const due = owner ? 0 : Math.round((sh.owner - entregue) * 100) / 100;
  const body = `${warn}
    <section class="card summary"><div class="sum-top"><span class="sum-label">${owner ? 'Faturado pelo ' + escapeHtml(d.name) + ' hoje' : 'Faturado pelo ' + escapeHtml(d.name) + ' hoje'}</span><span class="badge ${tuk ? 'work' : 'off'}">${tuk ? escapeHtml(tukTitle(tuk)) : 'Sem tuk'}</span></div>
      <div class="sum-big num">${eur(sh.fat)}</div>
      ${owner ? '' : `<div class="sum-row"><div class="mini"><div class="mini-k">A parte dele · ${Math.round(pct.pct * 100)}%</div><div class="mini-v num">${eur(sh.driver)}</div></div><div class="mini gold"><div class="mini-k">Parte do patrão</div><div class="mini-v num">${eur(sh.owner)}</div></div></div>`}
      <div class="strip"><div class="strip-row"><span>Objetivo de ${MESES[parseISO(date).m - 1].toLowerCase()} · <b class="num">${eur(month.fat)}</b> de ${eur0(obj)}</span><b class="num">${goalPct}%</b></div>${bar(obj ? month.fat / obj * 100 : 0)}</div></section>
    <section class="card"><div class="card-h"><div class="card-ic">${I.key}</div><div class="card-t"><div class="card-title">Tuk de hoje</div><div class="card-sub">${blocked ? 'Todos os tuks têm motorista. O que escolheres troca logo, e quem o tinha fica sem tuk.' : 'Toca noutro tuk para trocar. Se estiver ocupado, o outro motorista fica sem tuk.'}</div></div></div>${tukPicker(m, date, tuk && tuk.id)}</section>
    <div class="${blocked ? 'dis' : ''}">
      <section class="card"><div class="card-h"><div class="card-ic">${I.tuk}</div><div class="card-t"><div class="card-title">Serviços</div><div class="card-sub">Um valor por serviço</div></div><div class="card-total num">${eur(sh.fat)}</div></div>
        ${blocked ? '<p class="empty-line">Escolhe primeiro um tuk.</p>' : ''}${chips(services.filter(v => !(services.length === 1 && v === 0)), 'service', d.id, date)}${addRow(false, 'Valor', 'add-service', blocked ? 'disabled' : '')}${quick([20, 25, 30, 50, 80], 'add-service')}
        ${blocked ? '' : '<button type="button" class="zero-btn" data-act="zero">Dia a zero <small>· trabalhou, 0 €</small></button>'}</section>
      <section class="card"><div class="card-h"><div class="card-ic gold">${I.wrench}</div><div class="card-t"><div class="card-title">Gastos do dia</div><div class="card-sub">${tuk ? escapeHtml(tukTitle(tuk)) : 'Sem tuk'}</div></div><div class="card-total num">${eur(expTotal)}</div></div>
        ${fuelHidden ? '<p class="empty-line">Combustível não aparece: o ' + escapeHtml(tukTitle(tuk)) + ' é elétrico.</p>' : ''}
        ${blocked ? '<p class="empty-line">Escolhe primeiro um tuk.</p>' : `<div class="cats" style="margin:0 0 12px">${types.map((t, i) => `<button type="button" class="cat${i === 0 ? ' on' : ''}" data-act="cat" data-type="${t.id}">${escapeHtml(t.name)}</button>`).join('')}</div>`}
        ${types.map(t => chips((exp && exp.byType[t.id]) || [], 'daily', t.id, date)).join('')}
        ${addRow(true, 'Valor', 'add-daily', blocked ? 'disabled' : '')}</section>
      ${owner && m.tipsEnabled ? `<section class="card"><div class="card-h"><div class="card-ic gold">${I.star}</div><div class="card-t"><div class="card-title">Gratificações</div><div class="card-sub">Só informação. Não entram no faturado.</div></div><div class="card-total num">${eur(sumList(rec ? rec.grat : []))}</div></div>${chips(rec ? rec.grat : [], 'grat', d.id, date)}${addRow(true, 'Valor', 'add-grat')}</section>` : ''}
      ${owner ? '' : `<section class="card"><div class="card-h"><div class="card-ic gold">${I.cash}</div><div class="card-t"><div class="card-title">Entregue ao patrão</div><div class="card-sub">Dinheiro que o ${escapeHtml(d.name)} te entregou hoje</div></div><div class="card-total num">${eur(entregue)}</div></div>${chips(rec ? rec.entregue : [], 'entrega', d.id, date)}${addRow(true, 'Valor', 'add-entrega', blocked ? 'disabled' : '')}<div class="saldo"><div><span>Saldo · por entregar</span><small>${eur(sh.owner)} da parte do patrão − ${eur(entregue)} entregues</small></div><b class="num">${eur(Math.max(0, due))}</b></div></section>`}
      ${blocked ? '' : `<section class="card"><div class="card-h"><div class="card-ic">${I.notes}</div><div class="card-t"><div class="card-title">Nota do dia</div><div class="card-sub">Uma nota, para este dia</div></div></div><textarea id="note" placeholder="Ex.: a partir das 12h00">${escapeHtml(rec ? rec.note : '')}</textarea><div class="notes-foot"><span class="saved-hint">Guarda ao saíres do campo</span><button type="button" class="btn btn-ghost" data-act="save-note" style="height:44px">Guardar</button></div></section>`}
    </div>`;
  return heroBack(d.name, sub, true) + stepper(head.k, head.v, pill, 'day') + closeHero() + `<main class="page" data-driver="${d.id}">${offline(s)}${body}</main>` + nav('hoje');
}

function sumList(a) { return Math.round(((a || []).reduce((s, n) => s + Number(n || 0), 0)) * 100) / 100; }

function mes(s) {
  const m = s.model;
  const mv = monthView(m, m.year, s.month);
  const head = monthHeading(m.year, s.month);
  const over = mv.fat - mv.companyObj;
  const reached = mv.companyObj > 0 && over >= -0.001;
  const mx = scale(mv.drivers.map(d => d.fat).concat([mv.obj || 0]));
  const bars = mv.drivers.filter(d => d.active || d.fat).map(d => `<div class="hbar"><span class="hl">${escapeHtml(d.name)}</span><div class="ht"><i class="${d.reached ? 'g' : ''}" style="width:${(d.fat / mx * 100).toFixed(1)}%"></i>${mv.obj ? `<span class="goal" style="left:${(mv.obj / mx * 100).toFixed(1)}%"></span>` : ''}</div><span class="hv num">${eur0(d.fat)}</span></div>`).join('');
  const prizes = mv.drivers.filter(d => d.fat || d.active).map(d => {
    if (d.owner && d.reached) return `<span class="pz own">${escapeHtml(d.name)} · cumprido</span>`;
    if (d.prize) return `<span class="pz">${escapeHtml(d.name)} · prémio ${eur0(d.prize)}</span>`;
    if (!d.fat) return '';
    const p = mv.obj ? Math.round(d.fat / mv.obj * 100) : 0;
    return `<span class="pz no">${escapeHtml(d.name)} · ${p}%</span>`;
  }).join('');
  const days = [];
  const dim = new Date(Date.UTC(m.year, s.month, 0)).getUTCDate();
  for (let d = 1; d <= dim; d++) {
    const iso = `${m.year}-${pad2(s.month)}-${pad2(d)}`;
    let fat = 0;
    for (const person of m.drivers) {
      const rec = dayRec(m, person.id, iso);
      if (rec) fat += (rec.services || []).reduce((s, n) => s + Number(n || 0), 0);
    }
    days.push(Math.round(fat * 100) / 100);
  }
  const tukRows = mv.tuks.filter(t => t.tuk.status !== 'vendido').map(t => `<button type="button" class="dayrow" data-act="open-tuk" data-id="${t.id}"><div class="dnum"><div><b>${pad2(t.tuk.number)}</b><small>tuk</small></div></div><div class="dmid"><b>${escapeHtml(tukTitle(t.tuk))}</b>${plate(t.tuk.plate)}<span>Faturado ${eur0(t.fat)} · despesas ${eur0(t.desp)}</span></div><div class="dright num">${eur0(t.lucro)}<small>lucro</small></div></button>`).join('');
  const accounts = mv.drivers.filter(d => !d.owner && (d.fat || d.entregue)).map(d => {
    const txt = d.saldo < -0.004 ? `<b class="neg">falta ${eur(-d.saldo)}</b>` : (d.saldo > 0.004 ? `<b class="pos">a mais ${eur(d.saldo)}</b>` : '<b class="pos">em dia</b>');
    return `<div class="r"><span>${escapeHtml(d.name)} · ganha ${Math.round(d.pct * 100)}% · entregou ${eur(d.entregue)}</span>${txt}</div>`;
  }).join('');
  const prizeN = mv.drivers.filter(d => d.prize).length;
  return heroBrand(m.businessName, 'Resumo do mês') + stepper(head.k, head.v, '', 'month') + closeHero() + `<main class="page">${offline(s)}
    <section class="card summary"><div class="goal-card">${ring(pctInt(mv.pct), 'da empresa')}<div class="goal-info"><div class="goal-line"><span>Faturado</span><b class="num">${eur(mv.fat)}</b></div><div class="goal-line"><span>Objetivo</span><b class="num">${eur(mv.companyObj)}</b></div><div class="goal-line"><span>Motoristas</span><b class="num">${mv.workers} × ${eur0(mv.obj)}</b></div></div></div>
      <div class="need"><div class="need-k">${reached ? 'Objetivo atingido' : 'Ainda falta'}</div><div class="need-v num">${reached ? '+' + eur(over) : eur(Math.abs(over))}</div><div class="need-s">Conta os ${mv.workers} motoristas que trabalharam em ${MESES[s.month - 1].toLowerCase()}, com o patrão</div></div></section>
    <div class="kpis"><div class="kpi"><div class="kpi-k"><i></i>Lucro</div><div class="kpi-v num">${eur(mv.lucro)}</div></div><div class="kpi"><div class="kpi-k"><i style="background:var(--g500)"></i>Despesas</div><div class="kpi-v num">${eur(mv.desp)}</div></div><div class="kpi"><div class="kpi-k"><i style="background:var(--b300)"></i>Dias de tuk</div><div class="kpi-v num">${mv.tukDays}</div></div><div class="kpi"><div class="kpi-k"><i style="background:var(--b800)"></i>Média por tuk/dia</div><div class="kpi-v num">${eur(mv.tukDays ? mv.fat / mv.tukDays : 0)}</div></div><div class="kpi wide"><div class="kpi-k"><i style="background:var(--g400)"></i>Ganho do patrão · depois de partes, despesas e prémios</div><div class="kpi-v num">${eur(mv.ganho)}</div></div></div>
    <div class="sec-title">Objetivo por motorista · ${eur0(mv.obj)}</div><section class="card">${bars}<div class="prize" style="margin-top:12px">${prizes}</div></section>
    <div class="sec-title">Faturado por dia</div><section class="card"><div class="chart-box tall"><canvas id="ch-month" data-days="${days.join(',')}" data-goal="${mv.companyObj}"></canvas></div><div class="legend"><span><i style="background:#2a63ad"></i>Faturado do dia</span><span><i style="background:#d4a537"></i>Acumulado</span><span><i style="background:#8b97aa"></i>Objetivo</span></div></section>
    <div class="sec-title">Por tuk</div><section class="card" style="padding:6px 14px"><div class="days">${tukRows}</div></section>
    <div class="sec-title">Contas com motoristas</div><section class="card"><div class="rows">${accounts}${prizeN ? `<div class="r"><span>Prémios de ${MESES[s.month - 1].toLowerCase()} · ${prizeN} × ${eur0(mv.prize.amount)}</span><b>${eur(mv.prizes)}</b></div>` : ''}</div></section>
  </main>` + nav('mes');
}

function scale(values) {
  const m = Math.max(1, ...values.map(v => Number(v) || 0));
  const steps = [100, 200, 500, 1000, 2000, 4000, 5000, 8000, 10000, 15000, 20000, 40000, 80000, 120000];
  return steps.find(s => s >= m) || m;
}

function tuk(s) {
  const m = s.model;
  const t = m.tuks.find(x => x.id === s.route.id);
  if (!t) return mes(s);
  const tm = tukMonth(m, t.id, m.year, s.month);
  const head = monthHeading(m.year, s.month);
  const who = Object.entries(tm.who).map(([id, n]) => `${(m.drivers.find(d => d.id === id) || {}).name || ''} ${n} dias`).filter(Boolean);
  const monthlies = monthlyTypes(m).filter(tp => tp.scope !== 'combustão' || t.fuel === 'combustão');
  const monthCards = monthlies.map(tp => {
    const info = monthlyAmount(m, t.id, m.year, s.month, tp.id);
    const next = s.month < 12 ? monthlyAmount(m, t.id, m.year, s.month + 1, tp.id) : null;
    const parts = (info.parts && info.parts.length) ? info.parts : [];
    if (tp.repeat) {
      const rows = [`<div class="r"><span>${MESES[s.month - 1]}${info.auto ? '<span class="auto">automático · 1 ' + MESES_C[s.month - 1].toLowerCase() + '</span>' : ''}</span><b>${eur(info.amount)}</b></div>`];
      if (next) rows.push(`<div class="r"><span>${MESES[s.month]}${next.auto || next.amount ? '<span class="auto">automático · 1 ' + MESES_C[s.month].toLowerCase() + '</span>' : ''}</span><b>${eur(next.counts || next.amount ? next.amount : 0)}</b></div>`);
      return `<section class="card"><div class="card-h"><div class="card-ic gold">${I.garage}</div><div class="card-t"><div class="card-title">${escapeHtml(tp.name)}</div><div class="card-sub">Repete todos os meses, desde o dia 1</div></div><div class="card-total num">${eur(info.amount)}</div></div><div class="rows">${rows.join('')}</div><button type="button" class="zero-btn" style="margin-top:10px" data-act="edit-fixed" data-type="${tp.id}" data-tuk="${t.id}"><span>Mudar valor a partir deste mês</span></button></section>`;
    }
    return `<section class="card"><div class="card-h"><div class="card-ic gold">${I.wrench}</div><div class="card-t"><div class="card-title">${escapeHtml(tp.name)}</div><div class="card-sub">Soma no mês, mesmo com o tuk parado</div></div><div class="card-total num">${eur(info.amount)}</div></div>${chips(parts, 'month', tp.id, `${m.year}-${pad2(s.month)}`)}${addRow(true, 'Valor', 'add-month')}<div class="sum-formula">Na folha: ${parts.length > 1 ? '=' + parts.join('+') : (parts.length ? String(parts[0]).replace('.', ',') : '—')}</div></section>`;
  }).join('');
  const dailyRows = dailyTypes(m, t).map(tp => `<div class="r"><span>${escapeHtml(tp.name)} · ${tm.dailyDays[tp.id] || 0} dias</span><b>${eur(tm.dailyByType[tp.id] || 0)}</b></div>`).join('');
  const days = [];
  const dim = new Date(Date.UTC(m.year, s.month, 0)).getUTCDate();
  for (let d = dim; d >= 1 && days.length < 8; d--) {
    const iso = `${m.year}-${pad2(s.month)}-${pad2(d)}`;
    const drivers = m.drivers.filter(p => (dayRec(m, p.id, iso) || {}).tukId === t.id && sumList((dayRec(m, p.id, iso) || {}).services) > 0);
    const ex = ((m.tukDays[t.id] || {})[iso] || {}).byType || {};
    const note = ((m.tukDays[t.id] || {})[iso] || {}).note || '';
    const fat = drivers.reduce((s, p) => s + sumList(dayRec(m, p.id, iso).services), 0);
    const desp = Object.values(ex).reduce((s, parts) => s + sumList(parts), 0);
    if (!fat && !desp && !note && d < dim - 6) continue;
    const wd = SEMANA_C[weekday(iso)];
    const who = drivers[0];
    const rec = who ? dayRec(m, who.id, iso) : null;
    const nsrv = rec ? rec.services.filter(v => v > 0).length : 0;
    const sub = who ? `${who.name} · ${nsrv} serviços${rec.note ? ' · «' + rec.note + '»' : ''}` : (note ? 'Sem motorista · ' + note : 'Parado');
    days.push(`<button type="button" class="dayrow${who ? '' : ' off'}" data-act="${who ? 'open-day' : ''}" data-id="${who ? who.id : ''}" data-date="${iso}"><div class="dnum"><div><b>${d}</b><small>${wd}</small></div></div><div class="dmid"><b>${who ? eur(fat) + ' faturado' : 'Parado'}</b><span>${escapeHtml(sub)}</span></div><div class="dright num${desp ? '' : ' off'}">${desp ? '−' + eur(desp).replace('−', '') : ''}</div></button>`);
  }
  const fuel = t.fuel === 'combustão';
  return heroBack(tukTitle(t), `${t.plate || 'sem matrícula'} · ${fuel ? 'Combustão' : 'Elétrico'}`, true) + stepper(head.k, head.v, '', 'month') + closeHero() + `<main class="page" data-tuk="${t.id}">${offline(s)}
    <section class="card summary"><div class="sum-top"><span class="sum-label">Lucro do tuk</span><span class="badge work">${tm.serviceDays} dias a trabalhar</span></div><div class="sum-big num">${eur(tm.lucro)}</div><div class="sum-row"><div class="mini"><div class="mini-k">Faturado</div><div class="mini-v num">${eur(tm.fat)}</div></div><div class="mini gold"><div class="mini-k">Despesa</div><div class="mini-v num">${eur(tm.desp)}</div></div></div><div class="strip"><div class="strip-row"><span>Quem conduziu</span><span>${who.map(w => '<b>' + escapeHtml(w.replace(/ \d+ dias/, '')) + '</b> ' + (w.match(/\d+ dias/) || [''])[0]).join(' · ') || '—'}</span></div></div></section>
    <div class="sec-title">Gastos mensais</div>${monthCards}
    <button type="button" class="btn btn-gold btn-block" data-act="open-gasto" data-id="${t.id}" style="margin-bottom:8px">${I.plus}Novo gasto</button>
    <div class="sec-title">Gastos diários no mês</div><section class="card"><div class="rows">${dailyRows}<div class="r"><span>Garagem + Manutenção</span><b>${eur(tm.monthly)}</b></div><div class="r tot"><span>Total de despesas</span><b>${eur(tm.desp)}</b></div></div></section>
    <div class="sec-title">Dias</div><section class="card" style="padding:6px 14px"><div class="days">${days.join('')}</div></section>
  </main>` + nav('mes');
}

function ano(s) {
  const yv = yearView(s.model);
  const falta = Math.max(0, yv.planned - yv.fat);
  const pct = Math.round(yv.pct * 100);
  const cats = s.model.types.filter(t => t.active).map(t => [t.name, yv.cat[t.id] || 0]).filter(([, v]) => v > 0);
  const drivers = s.model.drivers.filter(d => d.active || yv.byDriver[d.id]);
  const mx = scale(drivers.map(d => yv.byDriver[d.id] || 0));
  const bars = drivers.map(d => `<div class="hbar"><span class="hl">${escapeHtml(d.name)}</span><div class="ht"><i style="width:${((yv.byDriver[d.id] || 0) / mx * 100).toFixed(1)}%"></i></div><span class="hv num">${eur0(yv.byDriver[d.id] || 0)}</span></div>`).join('');
  const fat = yv.months.map(m => m.fat).join(',');
  const obj = yv.months.map(m => m.plan).join(',');
  const luc = yv.months.map(m => m.lucro).join(',');
  const tukIds = s.model.tuks.filter(t => t.status !== 'vendido');
  return heroBrand(s.model.businessName, 'Resumo anual') + stepper('Ano', String(s.model.year), '', 'year') + closeHero() + `<main class="page">${offline(s)}
    <section class="card summary"><div class="sum-top"><span class="sum-label">Faturado em ${s.model.year}</span><span class="badge zero">${pct}% do objetivo</span></div><div class="sum-big num">${eur(yv.fat)}</div><div class="strip" style="border:0;padding-top:4px;margin-top:8px"><div class="strip-row"><span>Objetivo anual <b class="num">${eur(yv.planned)}</b></span><span>Falta <b class="num">${eur(falta)}</b></span></div>${bar(yv.pct * 100)}</div></section>
    <div class="kpis"><div class="kpi"><div class="kpi-k"><i></i>Lucro</div><div class="kpi-v num">${eur(yv.lucro)}</div></div><div class="kpi"><div class="kpi-k"><i style="background:var(--g500)"></i>Despesas</div><div class="kpi-v num">${eur(yv.desp)}</div></div><div class="kpi"><div class="kpi-k"><i style="background:var(--b300)"></i>Dias de tuk</div><div class="kpi-v num">${yv.tukDays}</div></div><div class="kpi"><div class="kpi-k"><i style="background:var(--b800)"></i>Média por tuk/dia</div><div class="kpi-v num">${eur(yv.avg)}</div></div><div class="kpi wide"><div class="kpi-k"><i style="background:var(--g400)"></i>Gratificações do patrão no ano</div><div class="kpi-v num">${eur(yv.grat)}</div></div></div>
    <div class="sec-title">Faturado vs objetivo</div><section class="card"><div class="chart-box"><canvas id="ch-fo" data-fat="${fat}" data-obj="${obj}"></canvas></div><div class="legend"><span><i style="background:#2a63ad"></i>Faturado</span><span><i style="background:#d4a537"></i>Objetivo</span></div></section>
    <div class="sec-title">Lucro por mês</div><section class="card"><div class="chart-box"><canvas id="ch-lucro" data-luc="${luc}"></canvas></div></section>
    <div class="sec-title">Faturado por motorista</div><section class="card">${bars}</section>
    <div class="sec-title">Faturado por tuk</div><section class="card"><div class="chart-box" style="height:200px"><canvas id="ch-tuk" data-labels="${tukIds.map(t => 'Tuk ' + pad2(t.number)).join('|')}" data-values="${tukIds.map(t => yv.byTuk[t.id] || 0).join(',')}"></canvas></div></section>
    <div class="sec-title">Despesas por categoria</div><section class="card"><div class="chart-box" style="height:230px"><canvas id="ch-cat" data-labels="${cats.map(c => c[0]).join('|')}" data-values="${cats.map(c => c[1]).join(',')}"></canvas></div><div class="legend" id="cat-legend"></div></section>
  </main>` + nav('ano');
}

function obj(s) {
  const m = s.model;
  const cur = Number(String(m.today).slice(5, 7));
  const sameYear = Number(String(m.today).slice(0, 4)) === m.year;
  const focus = sameYear ? cur : 12;
  const row = m.objectives.find(o => o.month === focus) || { amount: 0 };
  const mv = monthView(m, m.year, focus);
  const prize = prizeAt(m, m.year, focus);
  const history = prizeHistory(m);
  const months = m.objectives.map(o => {
    const view = monthView(m, m.year, o.month);
    const pz = view.drivers.filter(d => d.fat || d.active).map(d => {
      if (!view.workers && o.month > focus) return '';
      if (d.owner && d.reached) return `<span class="pz own">${escapeHtml(d.name)} ✓</span>`;
      if (d.prize) return `<span class="pz">${escapeHtml(d.name)} ${eur0(d.prize)}</span>`;
      if (d.fat && view.obj) return `<span class="pz no">${escapeHtml(d.name)} ${Math.round(d.fat / view.obj * 100)}%</span>`;
      return '';
    }).filter(Boolean).join('');
    const sub = view.workers ? `${view.workers} motoristas${o.month === focus && sameYear ? ' · em curso' : ''}` : 'Ainda não começou';
    return `<div class="goal-row${o.month === focus && sameYear ? ' cur' : ''}" style="flex-wrap:wrap"><div class="gm"><b>${MESES[o.month - 1]}</b><span>${sub}</span></div><div class="money"><input inputmode="decimal" data-act="obj-input" data-month="${o.month}" value="${o.amount ? String(o.amount).replace('.', ',') : ''}"><span>€</span></div>${pz ? `<div class="prize" style="flex-basis:100%">${pz}</div>` : ''}</div>`;
  }).join('');
  const fromLabel = `A partir de ${MESES[focus - 1].toLowerCase()} ${m.year}`;
  return heroBrand(m.businessName, 'Objetivos mensais') + stepper('Objetivos de', String(m.year), '', 'year') + closeHero() + `<main class="page">${offline(s)}
    <section class="card summary"><div class="sum-top"><span class="sum-label">Objetivo de ${MESES[focus - 1].toLowerCase()}</span><span class="badge zero">igual para todos</span></div><div class="sum-big num">${eur(row.amount)}</div><div class="strip"><div class="strip-row"><span>Empresa · ${mv.workers || activeDrivers(m).length} motoristas com o patrão</span><b class="num">${eur0((row.amount || 0) * (mv.workers || activeDrivers(m).length))}</b></div>${bar(mv.companyObj ? mv.fat / mv.companyObj * 100 : 0)}</div></section>
    <section class="card"><div class="card-h"><div class="card-ic gold">${I.trophy}</div><div class="card-t"><div class="card-title">Prémio</div><div class="card-sub">O mesmo para todos os motoristas que chegarem ao objetivo</div></div><button type="button" class="sw ${prize.active ? 'on' : ''}" data-act="prize-sw" aria-pressed="${prize.active}"></button></div>
      <div class="goal-row" style="padding-top:2px"><div class="gm"><b>${fromLabel}</b><span>Muda só deste mês em diante</span></div><div class="money"><input id="prize-amt" inputmode="decimal" value="${prize.raw != null ? String(prize.raw || prize.amount).replace('.', ',') : String(prize.amount).replace('.', ',')}"><span>€</span></div></div>
      ${history}<p class="muted" style="font-size:12.5px;margin:8px 0 0">O patrão conta para o objetivo, mas não recebe prémio.</p></section>
    <section class="card" style="padding:14px 18px"><div class="card-h" style="margin-bottom:10px"><div class="card-ic">${I.reset}</div><div class="card-t"><div class="card-title">Usar ano anterior</div><div class="card-sub">Propõe cada mês com a média de ${m.year - 1} dos motoristas que trabalharam. Podes alterar depois.</div></div></div><button type="button" class="btn btn-ghost btn-block" data-act="suggest">${I.reset}Propor objetivos com base em ${m.year - 1}</button></section>
    <div class="sec-title">Meses · objetivo por motorista</div><section class="card" style="padding:4px 18px">${months}</section>
  </main>` + nav('obj');
}
function prizeHistory(m) {
  const rows = (m.prizes || []).slice().sort((a, b) => a.from < b.from ? -1 : 1);
  if (rows.length < 2) return '';
  const lines = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    const fromM = MESES[Number(a.from.slice(5, 7)) - 1];
    const to = new Date(Date.UTC(Number(b.from.slice(0, 4)), Number(b.from.slice(5, 7)) - 1, 0));
    const toM = MESES[to.getUTCMonth()];
    lines.push(`<div class="r"><span>${fromM} a ${toM.toLowerCase()} ${a.from.slice(0, 4)}</span><b>${a.active ? eur(a.amount) : 'desligado'}</b></div>`);
  }
  return `<div class="rows">${lines.join('')}</div>`;
}

function def(s) {
  const m = s.model;
  const nTuk = m.tuks.filter(t => t.status !== 'vendido').length;
  const nFuel = m.tuks.filter(t => t.status !== 'vendido' && t.fuel === 'combustão').length;
  const nDrv = activeDrivers(m).length;
  const owner = m.drivers.find(d => isOwnerAt(m, d.id, m.today));
  const daily = m.types.filter(t => t.active && t.freq === 'Diário').length;
  const monthly = m.types.filter(t => t.active && t.freq === 'Mensal').length;
  const saved = s.file && s.file.savedAt ? 'guardado há ' + ago(s.file.savedAt) : (s.mode === 'demo' ? 'só neste telemóvel' : '');
  return heroBack('Definições', m.businessName, false) + closeHero() + `<main class="page flat">${offline(s)}
    <section class="card summary"><div class="card-h"><div class="card-ic gold">${I.shop}</div><div class="card-t"><div class="card-title">Nome do negócio</div><div class="card-sub">Aparece no topo da app e no nome da folha</div></div></div><div class="field" style="margin-bottom:0"><input id="biz-edit" value="${escapeHtml(m.businessName)}"></div></section>
    <section class="card"><div class="card-h"><div class="card-ic gold">${I.notes}</div><div class="card-t"><div class="card-title">Folha em uso</div><div class="card-sub">${s.mode === 'demo' ? 'Demonstração, sem Google' : 'Uma folha por ano, na tua Drive'}</div></div></div>
      <div class="sheet-row"><div class="year-tag">${m.year}</div><div class="sr-mid"><b>${escapeHtml(m.businessName)} · ${m.year}</b><span>${escapeHtml(s.emailLabel || '')}${saved ? ' · ' + saved : ''}</span></div>${s.file ? `<a class="open-link" href="${s.file.url}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}</div></section>
    <div class="sec-title">Negócio</div><section class="card set-list">
      <button type="button" class="set-row" data-act="go" data-to="pessoas"><div class="card-ic">${I.tuk}</div><div class="sm"><b>Tuks</b><span>${nTuk} tuks · ${nFuel} combustão, ${nTuk - nFuel} elétricos</span></div>${I.chev}</button>
      <button type="button" class="set-row" data-act="go" data-to="pessoas"><div class="card-ic">${I.users}</div><div class="sm"><b>Motoristas</b><span>${nDrv} ativos · ${owner ? owner.name + ' é o patrão' : ''}</span></div>${I.chev}</button>
      <button type="button" class="set-row" data-act="go" data-to="tipos"><div class="card-ic gold">${I.tag}</div><div class="sm"><b>Tipos de gasto</b><span>${daily} diários · ${monthly} mensais</span></div>${I.chev}</button>
      <button type="button" class="set-row" data-act="go" data-to="obj"><div class="card-ic">${I.obj}</div><div class="sm"><b>Objetivos e prémio</b><span>Muda-se no separador Objetivos</span></div><span class="val" style="color:var(--b600);font-weight:700">Abrir</span>${I.chev}</button>
      <div class="set-row"><div class="card-ic gold">${I.star}</div><div class="sm"><b>Gratificações</b><span>Só do patrão · desligado esconde a coluna</span></div><button type="button" class="sw ${m.tipsEnabled ? 'on' : ''}" data-act="tips" aria-pressed="${m.tipsEnabled}"></button></div>
    </section>
    <div class="sec-title">Folha e conta</div><section class="card set-list">
      <button type="button" class="set-row" data-act="go" data-to="folha"><div class="card-ic">${I.cal}</div><div class="sm"><b>Criar folha de outro ano</b><span>Uma folha vazia para qualquer ano</span></div>${I.chev}</button>
      <button type="button" class="set-row" data-act="go" data-to="folha"><div class="card-ic gold">${I.reset}</div><div class="sm"><b>Repor aspeto da folha</b><span>Repõe o desenho, sem mexer nos valores</span></div>${I.chev}</button>
      <div class="set-row"><div class="card-ic">${I.globe}</div><div class="sm"><b>${s.mode === 'demo' ? 'Modo demonstração' : 'Conta Google'}</b><span>${escapeHtml(s.emailLabel || '')}</span></div>${s.mode === 'demo' ? '<button type="button" class="link-btn" data-act="google">Entrar</button>' : '<button type="button" class="link-btn" data-act="signout">Sair</button>'}</div>
      <div class="set-row"><div class="card-ic">${I.globe}</div><div class="sm"><b>Idioma</b><span>Português da Europa</span></div><span class="val">Português</span></div>
    </section>
    <p class="muted" style="text-align:center"><a href="privacy.html">Privacidade</a> · <a href="terms.html">Termos</a></p>
  </main>`;
}
function ago(ts) {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return min + ' min';
  const h = Math.round(min / 60);
  return h + ' h';
}

function tipos(s) {
  const m = s.model;
  const rows = m.types.filter(t => t.active).map(t => {
    const icon = t.id === 'g1' ? I.fuel : t.id === 'g3' ? I.garage : I.wrench;
    const tags = `<span class="tag${t.freq === 'Mensal' ? ' gold' : ''}">${t.freq}</span>${t.repeat ? '<span class="tag ok">Repete</span>' : (t.freq === 'Mensal' ? '<span class="tag grey">Soma</span>' : '')}`;
    let sub = t.scope === 'combustão' ? 'Só nos tuks a combustão' : 'Todos os tuks';
    if (t.repeat) {
      const bits = m.tuks.filter(tk => tk.status !== 'vendido').map(tk => {
        const amt = (m.fixed || []).filter(f => f.typeId === t.id && f.tukId === tk.id).sort((a, b) => a.from < b.from ? 1 : -1)[0];
        return amt ? `${tukTitle(tk).replace('Tuk ', 'Tuk ')} ${eur0(amt.amount).replace(' €', '')} €` : '';
      }).filter(Boolean);
      if (bits.length) sub = bits.join(' · ');
    }
    return `<div class="etype"><div class="card-ic${t.freq === 'Mensal' ? ' gold' : ''}" style="width:38px;height:38px;border-radius:12px">${icon}</div><div class="sm"><b>${escapeHtml(t.name)}</b>${tags}<span>${escapeHtml(sub)}</span></div><button type="button" class="mini-btn" data-act="edit-type" data-id="${t.id}" aria-label="Editar">${I.pen}</button><button type="button" class="mini-btn del" data-act="del-type" data-id="${t.id}" aria-label="Apagar">${I.trash}</button></div>`;
  }).join('');
  return heroBack('Tipos de gasto', 'Definições · ' + m.businessName, false) + closeHero() + `<main class="page flat">${offline(s)}
    <section class="card summary" style="padding:6px 18px">${rows}</section>
    <div class="sec-title">Novo tipo de gasto</div><section class="card">
      <div class="field"><label>Nome</label><input id="type-name" placeholder="Ex.: Seguro"></div>
      <div class="field"><label>Quando se lança</label><div class="seg" id="type-freq"><button type="button" data-act="type-freq" data-freq="Diário">Diário</button><button type="button" class="on" data-act="type-freq" data-freq="Mensal">Mensal</button></div></div>
      <div class="set-row" id="type-repeat" style="border-top:1px solid var(--line)"><div class="sm"><b>Repete todos os meses</b><span>Escreve o mesmo valor no dia 1, até mudares</span></div><button type="button" class="sw on" id="type-rep" data-act="type-rep"></button></div>
      <div class="set-row"><div class="sm"><b>Só tuks a combustão</b><span>Os elétricos não mostram este gasto</span></div><button type="button" class="sw" id="type-fuel" data-act="type-fuel"></button></div>
      <div class="field" style="margin-top:12px"><label>Valor por mês, em cada tuk</label><div class="money"><input id="type-amt" inputmode="decimal" placeholder="0"><span>€</span></div></div>
      <button type="button" class="btn btn-primary btn-block" data-act="add-type">${I.plus}Adicionar tipo de gasto</button>
    </section>
    <p class="muted" style="text-align:center;font-size:12.5px">Os gastos de fábrica podem ser mudados ou apagados.<br>Os valores já lançados não se perdem.</p>
  </main>`;
}

function folha(s) {
  const y = s.model.year;
  const years = [y - 1, y + 1, y + 2];
  return heroBack('Folha', 'Definições · ' + s.model.businessName, false) + closeHero() + `<main class="page flat">${offline(s)}
    <section class="card summary"><div class="card-h"><div class="card-ic">${I.cal}</div><div class="card-t"><div class="card-title">Criar folha de outro ano</div><div class="card-sub">Uma folha vazia, com os teus tuks, motoristas e gastos</div></div></div>
      <div class="cats" id="year-picks" style="margin:0 0 14px">${years.map((yy, i) => `<button type="button" class="cat${i === 1 ? ' on' : ''}" data-act="pick-year" data-year="${yy}">${yy}</button>`).join('')}<button type="button" class="cat" data-act="pick-year-other">Outro…</button></div>
      <div class="sheet-row" style="padding-bottom:0"><div class="year-tag" id="year-tag" style="background:var(--g500);color:var(--b900)">${y + 1}</div><div class="sr-mid"><b id="year-title">${escapeHtml(s.model.businessName)} · ${y + 1}</b><span>Ainda não existe · ${s.mode === 'demo' ? 'fica neste telemóvel' : 'fica na tua Drive'}</span></div></div>
      <button type="button" class="btn btn-primary btn-block" id="year-go" data-act="create-year" data-year="${y + 1}" style="margin-top:14px">Criar folha de ${y + 1}</button></section>
    <section class="card"><div class="card-h"><div class="card-ic gold">${I.reset}</div><div class="card-t"><div class="card-title">Repor aspeto da folha</div><div class="card-sub">Para quando se apaga uma coluna ou se mexe no tamanho sem querer</div></div></div>
      <div class="rows"><div class="r"><span>Colunas e linhas apagadas</span><b class="pos">repõe</b></div><div class="r"><span>Larguras, cores e letras</span><b class="pos">repõe</b></div><div class="r"><span>Fórmulas, totais e proteções</span><b class="pos">repõe</b></div><div class="r"><span>Os valores que escreveste</span><b>não mexe</b></div></div>
      ${s.missing && s.missing.length ? `<div class="cf-warn">${s.missing.length} separador${s.missing.length > 1 ? 'es' : ''} em falta: ${s.missing.map(escapeHtml).join(', ')}. Criar outra vez?</div><div class="btns" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><button type="button" class="btn btn-ghost" data-act="close-missing">Agora não</button><button type="button" class="btn btn-gold" data-act="restore-yes">Criar outra vez</button></div>` : `<button type="button" class="btn btn-gold btn-block" style="margin-top:14px" data-act="restore">${I.reset}Repor aspeto da folha de ${y}</button>`}
    </section>
  </main>`;
}

function pessoas(s) {
  const m = s.model;
  const today = m.today;
  const drivers = m.drivers.map(d => {
    const owner = isOwnerAt(m, d.id, today);
    const pct = pctAt(m, d.id, today);
    const tag = !d.active ? '<span class="tag grey">Inativo</span>' : (owner ? '<span class="tag gold">Patrão</span>' : `<span class="tag">${Math.round(pct.pct * 100)}%</span>`);
    let sub = 'Saiu · os dados ficam';
    if (d.active && owner) sub = 'Sem %, entregas nem prémio';
    else if (d.active) {
      const ownerPct = Math.round((1 - pct.pct) * 100);
      const since = pct.from ? `${Number(pct.from.slice(8, 10))} ${MESES_C[Number(pct.from.slice(5, 7)) - 1].toLowerCase()}` : '';
      sub = `Ganha ${Math.round(pct.pct * 100)}% · patrão ${ownerPct}%${since ? ' · desde ' + since : ''}`;
    }
    const right = owner || !d.active
      ? `<button type="button" class="sw ${d.active && owner ? 'on' : ''} ${!d.active ? '' : 'on'}" data-act="drv-active" data-id="${d.id}" aria-label="Ativo"></button>`
      : `<span class="val num" style="font-weight:800;color:var(--b800)">${Math.round(pct.pct * 100)}%</span>`;
    const sw = !owner ? (d.active ? '' : '') : '';
    void sw;
    const control = owner
      ? `<button type="button" class="sw ${d.active ? 'on' : ''}" data-act="noop"></button>`
      : (!d.active ? `<button type="button" class="sw" data-act="drv-active" data-id="${d.id}"></button>` : right);
    return `<button type="button" class="dayrow${d.active ? '' : ' off'}" data-act="open-driver-card" data-id="${d.id}"><div class="av ${owner ? 'gold' : (d.active ? '' : 'grey')}">${initials(d.name)}</div><div class="dmid"><b>${escapeHtml(d.name)}${tag}</b><span>${escapeHtml(sub)}</span></div>${owner ? `<span class="sw on"></span>` : (!d.active ? '<span class="sw"></span>' : control)}</button>`;
  }).join('');
  const tuks = m.tuks.slice().sort((a, b) => a.number - b.number).map(t => {
    const fuel = t.fuel === 'combustão';
    const sold = t.status === 'vendido';
    const tag = sold ? '<span class="tag grey">Vendido</span>' : `<span class="tag${fuel ? ' gold' : ''}">${fuel ? 'Combustão' : 'Elétrico'}</span>`;
    const gar = (m.fixed || []).filter(f => f.tukId === t.id && f.typeId === 'g3').sort((a, b) => a.from < b.from ? 1 : -1)[0];
    const sub = sold ? `Vendido${t.soldOn ? ' em ' + MESES[Number(t.soldOn.slice(5, 7)) - 1].toLowerCase() : ''} · histórico fica na folha` : (gar ? `Garagem ${eur0(gar.amount).replace(' €', '')} €/mês` : 'Sem garagem definida');
    return `<button type="button" class="dayrow${sold ? ' off' : ''}" data-act="open-tuk-card" data-id="${t.id}"><div class="dnum"><div><b>${pad2(t.number)}</b><small>tuk</small></div></div><div class="dmid"><b>${escapeHtml(tukTitle(t))}${tag}</b>${plate(t.plate)}<span>${escapeHtml(sub)}</span></div>${I.chev}</button>`;
  }).join('');
  const used = new Set(m.tuks.map(t => t.number));
  const free = [];
  for (let n = 1; n <= 50 && free.length < 6; n++) if (!used.has(n)) free.push(n);
  return heroBack('Motoristas e tuks', 'Definições · ' + m.businessName, false) + closeHero() + `<main class="page flat">${offline(s)}
    <section class="card summary" style="padding:6px 14px"><div class="days">${drivers}</div></section>
    <button type="button" class="btn btn-ghost btn-block" data-act="open-new-driver" style="margin-bottom:6px">${I.plus}Adicionar motorista</button>
    <div class="sec-title">Tuks</div><section class="card" style="padding:6px 14px"><div class="days">${tuks}</div></section>
    <div class="sec-title">Novo tuk</div><section class="card">
      <div class="field"><label>Número<span class="req">*</span></label><div class="sel" data-act="toggle-dd" id="new-num">Tuk ${pad2(free[0] || 1)} <span style="color:var(--b600)">▾</span></div>
        <div class="dd hidden" id="new-num-dd">${m.tuks.slice(0, 4).map(t => `<div class="o used"><span>Tuk ${pad2(t.number)}</span><small>usado · ${escapeHtml(t.nickname || (t.status === 'vendido' ? 'vendido' : ''))}</small></div>`).join('')}${free.slice(0, 3).map((n, i) => `<button type="button" class="o${i === 0 ? ' on' : ''}" data-act="pick-new-num" data-n="${n}"><span>Tuk ${pad2(n)}</span><small>${i === 0 ? 'escolhido' : 'livre'}</small></button>`).join('')}<div class="more">… até 50</div></div></div>
      <div class="field"><label>Tipo<span class="req">*</span></label><div class="seg" id="new-fuel"><button type="button" data-act="new-fuel" data-fuel="combustão">Combustão</button><button type="button" class="on" data-act="new-fuel" data-fuel="elétrico">Elétrico</button></div></div>
      <div class="year-row" style="margin-bottom:14px"><div class="field"><label>Alcunha<span class="opt">(opcional)</span></label><input id="new-nick" placeholder="Ex.: Preto"></div><div class="field"><label>Matrícula<span class="opt">(opcional)</span></label><input id="new-plate" placeholder="AA-00-AA"></div></div>
      <button type="button" class="btn btn-primary btn-block" data-act="add-tuk">${I.plus}Adicionar tuk</button>
    </section>
    <p class="muted" style="text-align:center;font-size:12.5px;margin-top:14px">Até 50 tuks e 50 motoristas. Cada tuk precisa de número e tipo. A % é a parte do motorista e muda a partir desse dia.</p>
  </main>`;
}

function overlay(s) {
  const sh = s.sheet;
  if (!sh) return '';
  let inner = '';
  if (sh.type === 'gasto') inner = gastoSheet(s, sh);
  else if (sh.type === 'part') inner = partSheet(s, sh);
  else if (sh.type === 'driver') inner = driverSheet(s, sh);
  else if (sh.type === 'tuk') inner = tukEdit(s, sh);
  else if (sh.type === 'fixed') inner = fixedSheet(s, sh);
  else if (sh.type === 'new-driver') inner = newDriver(s);
  if (!inner) return '';
  return `<div class="sheet-bg show" data-act="close-sheet"></div><div class="sheet show"><div class="grab"></div>${inner}</div>`;
}
function gastoSheet(s, sh) {
  const m = s.model;
  const t = m.tuks.find(x => x.id === sh.tukId);
  const types = m.types.filter(tp => tp.active && (tp.scope !== 'combustão' || (t && t.fuel === 'combustão')));
  const sel = sh.typeId || (types.find(tp => tp.freq === 'Mensal' && !tp.repeat) || types[0] || {}).id;
  const tp = types.find(x => x.id === sel);
  const amt = Number(String(sh.amount || '').replace(',', '.')) || 0;
  let preview = '';
  if (tp && tp.freq === 'Mensal') {
    const info = monthlyAmount(m, t.id, m.year, s.month, tp.id);
    const parts = (info.parts || []).slice();
    if (amt) parts.push(amt);
    const total = parts.reduce((a, b) => a + b, 0);
    preview = `<div class="test-out ok">${escapeHtml(tp.name)} de ${MESES[s.month - 1].toLowerCase()}: ${parts.map(p => String(p).replace('.', ',')).join(' + ')} = <b>${eur(total)}</b>. ${tp.repeat ? 'Repete todos os meses.' : 'É um gasto mensal, por isso podes lançá-lo num dia em que o tuk esteve parado.'}</div>`;
  }
  return `<h3>Novo gasto · ${escapeHtml(tukTitle(t))}</h3><p>Escolhe o tipo e escreve o valor. Soma ao que já lá está.</p>
    <div class="cats" style="margin:0 0 14px">${types.map(tp2 => `<button type="button" class="cat${tp2.id === sel ? ' on' : ''}" data-act="gasto-type" data-type="${tp2.id}">${escapeHtml(tp2.name)}</button>`).join('')}</div>
    <div class="money"><input id="gasto-amt" inputmode="decimal" value="${sh.amount || ''}" style="font-size:22px"><span>€</span></div>
    ${quick([10, 20, 50, 80, 150], 'gasto-quick')}${preview}
    <div class="btns" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button type="button" class="btn btn-ghost" data-act="close-sheet">Cancelar</button><button type="button" class="btn btn-gold" data-act="confirm-gasto">${I.plus}Adicionar</button></div>`;
}
function partSheet(s, sh) {
  return `<h3>Editar valor</h3><p>Muda o valor ou elimina esta parcela.</p><div class="money"><input id="part-amt" inputmode="decimal" value="${String(sh.amount).replace('.', ',')}"><span>€</span></div><div class="btns" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px"><button type="button" class="btn btn-danger" data-act="delete-part">Eliminar</button><button type="button" class="btn btn-primary" data-act="save-part">Guardar</button></div>`;
}
function driverSheet(s, sh) {
  const m = s.model;
  const d = m.drivers.find(x => x.id === sh.id);
  if (!d) return '';
  const owner = isOwnerAt(m, d.id, m.today);
  const pct = Math.round((pctAt(m, d.id, m.today).pct || 0) * 100);
  return `<h3>${escapeHtml(d.name)}</h3><p>A percentagem é a parte do motorista. Uma mudança vale a partir do dia que escolheres.</p>
    <div class="field"><label>Nome</label><input id="card-name" value="${escapeHtml(d.name)}"></div>
    ${owner ? '' : `<div class="field"><label>% do motorista</label><input id="card-pct" inputmode="decimal" value="${pct}"></div><div class="field"><label>A partir de</label><input id="card-from" type="date" value="${m.today}"></div>`}
    <div class="set-row"><div class="sm"><b>É o patrão</b><span>Sem percentagem, entregas, saldo ou prémio</span></div><button type="button" class="sw ${owner ? 'on' : ''}" id="card-owner" data-act="card-owner"></button></div>
    <div class="set-row"><div class="sm"><b>Ativo</b><span>Inativo fica de fora do dia, mas o histórico mantém-se</span></div><button type="button" class="sw ${d.active ? 'on' : ''}" id="card-active" data-act="card-active"></button></div>
    <button type="button" class="btn btn-primary btn-block" data-act="save-driver" data-id="${d.id}" style="margin-top:8px">Guardar</button>`;
}
function tukEdit(s, sh) {
  const t = s.model.tuks.find(x => x.id === sh.id);
  if (!t) return '';
  const sold = t.status === 'vendido';
  return `<h3>${escapeHtml(tukTitle(t))}</h3><p>Número e tipo são obrigatórios. A matrícula, se estiver fora de AA-00-AA, só avisa.</p>
    <div class="field"><label>Alcunha</label><input id="edit-nick" value="${escapeHtml(t.nickname || '')}"></div>
    <div class="field"><label>Matrícula</label><input id="edit-plate" value="${escapeHtml(t.plate || '')}" placeholder="AA-00-AA"></div>
    <div class="field"><label>Tipo</label><div class="seg" id="edit-fuel"><button type="button" class="${t.fuel === 'combustão' ? 'on' : ''}" data-act="edit-fuel" data-fuel="combustão">Combustão</button><button type="button" class="${t.fuel === 'elétrico' ? 'on' : ''}" data-act="edit-fuel" data-fuel="elétrico">Elétrico</button></div></div>
    <div class="set-row"><div class="sm"><b>Vendido</b><span>Deixa de aparecer no dia. O histórico fica.</span></div><button type="button" class="sw ${sold ? 'on' : ''}" id="edit-sold" data-act="edit-sold"></button></div>
    <button type="button" class="btn btn-primary btn-block" data-act="save-tuk" data-id="${t.id}">Guardar</button>`;
}
function fixedSheet(s, sh) {
  const tp = s.model.types.find(t => t.id === sh.typeId);
  return `<h3>Mudar ${escapeHtml(tp ? tp.name : 'valor')}</h3><p>O valor novo vale a partir de ${MESES[s.month - 1].toLowerCase()}. Os meses anteriores ficam como estavam.</p>
    <div class="money"><input id="fixed-amt" inputmode="decimal" placeholder="0"><span>€</span></div>
    <button type="button" class="btn btn-gold btn-block" style="margin-top:14px" data-act="save-fixed" data-type="${sh.typeId}" data-tuk="${sh.tukId}">Guardar a partir deste mês</button>`;
}
function newDriver() {
  return `<h3>Novo motorista</h3><p>A % é a parte dele. Podes marcá-lo como patrão.</p>
    <div class="field"><label>Nome</label><input id="nd-name" placeholder="Nome"></div>
    <div class="field"><label>% do motorista</label><input id="nd-pct" inputmode="decimal" value="50"></div>
    <div class="set-row"><div class="sm"><b>É o patrão</b><span>Substitui o patrão atual a partir de hoje</span></div><button type="button" class="sw" id="nd-owner" data-act="nd-owner"></button></div>
    <button type="button" class="btn btn-primary btn-block" data-act="save-new-driver">${I.plus}Adicionar</button>`;
}

export function render(s) {
  logoN = 0;
  if (!s.ready) return '<div class="setup"><h1>Tuk <em>Manager</em></h1></div>';
  if (!s.onboarded || s.route.name === 'inicio') return setup(s) + toast(s);
  const name = s.route.name;
  const page = name === 'dia' ? dia(s) : name === 'mes' ? mes(s) : name === 'tuk' ? tuk(s) : name === 'ano' ? ano(s) : name === 'obj' ? obj(s) : name === 'def' ? def(s) : name === 'tipos' ? tipos(s) : name === 'folha' ? folha(s) : name === 'pessoas' ? pessoas(s) : hoje(s);
  return page + toast(s) + overlay(s);
}

export function suggestions(model) {
  return suggestFromPrior(model.prior);
}
