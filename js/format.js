/* Datas, dinheiro e textos curtos em português europeu. */

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_C = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const SEMANA_C = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const PLATE_RE = /^([A-Z]{2}|[0-9]{2})-([A-Z]{2}|[0-9]{2})-([A-Z]{2}|[0-9]{2})$/;

export function pad(n) { return String(n).padStart(2, '0'); }

export function iso(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

export function parseISO(s) {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return { y, m, d };
}

export function weekday(date) {
  const { y, m, d } = parseISO(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthStart(y, m) { return iso(y, m, 1); }
export function monthEnd(y, m) { return iso(y, m, daysInMonth(y, m)); }
export function ym(y, m) { return `${y}-${pad(m)}`; }
export function addDays(date, n) {
  const { y, m, d } = parseISO(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Hora civil de Portugal continental, sem nomear um fuso com cidade. UTC+0, UTC+1 no verão. */
export function civilToday(now = new Date()) {
  const y = now.getUTCFullYear();
  const lastSunday = (year, monthIndex) => {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  const start = Date.UTC(y, 2, lastSunday(y, 2), 1);
  const end = Date.UTC(y, 9, lastSunday(y, 9), 1);
  const dst = now.getTime() >= start && now.getTime() < end;
  const local = new Date(now.getTime() + (dst ? 3600000 : 0));
  return iso(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
}

export function civilTime(now = new Date()) {
  const y = now.getUTCFullYear();
  const lastSunday = (year, monthIndex) => {
    const last = new Date(Date.UTC(year, monthIndex + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  const start = Date.UTC(y, 2, lastSunday(y, 2), 1);
  const end = Date.UTC(y, 9, lastSunday(y, 9), 1);
  const dst = now.getTime() >= start && now.getTime() < end;
  const local = new Date(now.getTime() + (dst ? 3600000 : 0));
  return `${local.getUTCHours()}:${pad(local.getUTCMinutes())}`;
}

export function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function sum(list) {
  let s = 0;
  for (const n of list || []) s += Number(n) || 0;
  return round2(s);
}

export function eur(n, dec = true) {
  const x = Number(n) || 0;
  const neg = x < 0;
  const v = Math.abs(x);
  const [a, b] = v.toFixed(dec ? 2 : 0).split('.');
  const int = a.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + int + (dec ? ',' + b : '') + ' €';
}

export function eur0(n) { return eur(Math.round(Number(n) || 0), false); }

export function pctLabel(p) {
  const n = Math.round(Number(p) * 1000) / 10;
  const t = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return t + '%';
}

export function tukNum(n) { return 'Tuk ' + pad(n); }

export function tukTitle(t) {
  if (!t) return 'Tuk';
  const base = tukNum(t.number || 0);
  return t.nickname ? `${base} ${t.nickname}` : base;
}

export function plateText(plate) {
  const p = String(plate || '').trim().toUpperCase();
  return p || '';
}

export function plateBad(plate) {
  const p = plateText(plate);
  return !!p && !PLATE_RE.test(p);
}

export function initials(name) {
  const s = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '');
  return (s.slice(0, 2) || '·').toUpperCase();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function dayHeading(date) {
  const { d, m } = parseISO(date);
  return { k: SEMANA[weekday(date)], v: `${d} de ${MESES_L[m - 1]}` };
}

export function monthHeading(y, m) {
  return { k: String(y), v: MESES[m - 1] };
}

/** Número de série das folhas (época 1899-12-30) para uma data AAAA-MM-DD. */
export function isoToSerial(date) {
  const { y, m, d } = parseISO(date);
  const utc = Date.UTC(y, m - 1, d);
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
}

export function serialToISO(n) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(n)) * 86400000);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Chave de linha: data em texto, número de série, ou fórmula ="AAAA-MM-DD". */
export function rowKey(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 120000) return serialToISO(v);
  let s = String(v).trim();
  const quoted = /^="(\d{4}-\d{2}-\d{2})"/.exec(s);
  if (quoted) return quoted[1];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) return iso(Number(br[3]), Number(br[2]), Number(br[1]));
  if (/^\d{5,6}$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 120000) return serialToISO(n);
  }
  return s;
}

export function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

/** Partes de uma fórmula de soma (=70+50+90) ou um número. Aceita vírgula decimal. */
export function partsFromCell(v) {
  if (v == null || v === '') return [];
  if (typeof v === 'number') return Number.isFinite(v) ? [round2(v)] : [];
  let s = String(v).trim();
  if (!s) return [];
  if (s.startsWith('=')) s = s.slice(1);
  s = s.replace(/\s/g, '');
  if (/^[0-9+.,]+$/.test(s) && s.includes('+')) {
    return s.split('+').filter(Boolean).map(x => round2(Number(x.replace(',', '.')))).filter(n => Number.isFinite(n));
  }
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',') && !s.includes('+')) return Number.isFinite(n) ? [round2(n)] : [];
  const plain = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(plain) ? [round2(plain)] : [];
}

export function cellFromParts(parts) {
  const p = (parts || []).map(round2).filter(n => Number.isFinite(n));
  if (!p.length) return '';
  if (p.length === 1) return p[0];
  return '=' + p.join('+');
}
