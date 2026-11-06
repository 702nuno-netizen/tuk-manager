/* Passos da criação da folha. Sem rede: dá para testar a retoma e a pausa. */

export const STEP_GAP_MS = 5000;

export function backoffMs(attempt, retryAfterSec) {
  const n = Number(retryAfterSec);
  if (n > 0) return Math.min(20000, Math.round(n * 1000));
  return Math.min(20000, 500 * 2 ** Math.max(0, attempt));
}

export function googleMessage(body) {
  const raw = String(body || '').trim();
  if (!raw) return '';
  try {
    const j = JSON.parse(raw);
    const msg = j && j.error && j.error.message;
    if (msg) return String(msg).trim();
  } catch (e) { /* texto simples */ }
  return raw.replace(/\s+/g, ' ').trim();
}

/** Parte uma lista para caber em poucos pedidos. Cada bocado fica abaixo de maxBytes. */
export function splitPayload(items, maxBytes) {
  const limit = Math.max(1000, Number(maxBytes) || 8000000);
  const chunks = [];
  let cur = [];
  let size = 2;
  for (const item of items || []) {
    const n = JSON.stringify(item).length + 1;
    if (cur.length && size + n > limit) {
      chunks.push(cur);
      cur = [];
      size = 2;
    }
    cur.push(item);
    size += n;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export function explainError(e) {
  if (!e || e.offline) return 'sem ligação';
  const status = Number(e.status) || 0;
  if (status === 429) return 'limite do Google (429)';
  if (status >= 500) return 'o Google não respondeu (' + status + ')';
  if (status === 401 || status === 403) return 'a sessão Google expirou';
  const msg = googleMessage(e.body);
  if (status === 400) return msg || 'pedido recusado (400)';
  if (msg) return msg;
  if (status) return 'erro do Google (' + status + ')';
  return 'sem ligação';
}

/** Parte um retângulo nas fronteiras do congelamento e das linhas/colunas ocultas. */
export function legalMerges(merges, opt = {}) {
  const frozenRows = Number(opt.frozenRows) || 0;
  const frozenCols = Number(opt.frozenCols) || 0;
  const cuts = [];
  if (frozenRows > 0) cuts.push(['row', frozenRows + 1]);
  if (frozenCols > 0) cuts.push(['col', frozenCols + 1]);
  for (const r of opt.hiddenRows || []) {
    cuts.push(['row', Number(r)]);
    cuts.push(['row', Number(r) + 1]);
  }
  for (const c of opt.hiddenCols || []) {
    const n = typeof c === 'number' ? c : colNum(c);
    cuts.push(['col', n]);
    cuts.push(['col', n + 1]);
  }
  let rects = (merges || []).map(m => [m[0], m[1], m[2], m[3]]);
  for (const [axis, boundary] of cuts) rects = splitAt(rects, axis, boundary);
  rects = rects.filter(span);
  const kept = [];
  for (const rect of rects) {
    if (kept.some(k => overlaps(k, rect))) continue;
    kept.push(rect);
  }
  return kept;
}

function colNum(letter) {
  let n = 0;
  for (const ch of String(letter)) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function span([r1, c1, r2, c2]) {
  return r2 > r1 || c2 > c1;
}

function splitAt(rects, axis, boundary) {
  if (!(boundary > 1)) return rects;
  const out = [];
  for (const rect of rects) {
    const [r1, c1, r2, c2] = rect;
    const start = axis === 'row' ? r1 : c1;
    const end = axis === 'row' ? r2 : c2;
    if (start < boundary && end >= boundary) {
      if (axis === 'row') {
        out.push([r1, c1, boundary - 1, c2]);
        out.push([boundary, c1, r2, c2]);
      } else {
        out.push([r1, c1, r2, boundary - 1]);
        out.push([r1, boundary, r2, c2]);
      }
    } else out.push(rect);
  }
  return out.filter(r => r[2] >= r[0] && r[3] >= r[1]);
}

function overlaps(a, b) {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

export function requiredGrid(ws) {
  let rows = 1;
  let cols = 1;
  const box = (r1, c1, r2, c2) => {
    rows = Math.max(rows, Number(r1) || 0, Number(r2) || 0);
    cols = Math.max(cols, Number(c1) || 0, Number(c2) || 0);
  };
  const a1 = (ref) => {
    const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(String(ref || ''));
    if (!m) return;
    box(Number(m[2]), colNum(m[1]), Number(m[4] || m[2]), m[3] ? colNum(m[3]) : colNum(m[1]));
  };
  for (const c of ws.cells || []) box(c.r, c.c, c.r, c.c);
  for (const m of ws.merges || []) box(m[0], m[1], m[2], m[3]);
  for (const r of ws.hideRow || []) rows = Math.max(rows, r);
  for (const c of ws.hideCol || []) cols = Math.max(cols, colNum(c));
  for (const p of ws.protect || []) a1(p);
  for (const rule of ws.cf || []) a1(rule.range);
  for (const check of ws.checks || []) a1(String(check.range || '').includes(':') ? check.range : check.range + ':' + check.range);
  for (const k of Object.keys(ws.colW || {})) cols = Math.max(cols, Number(k) || 0);
  for (const k of Object.keys(ws.rowH || {})) rows = Math.max(rows, Number(k) || 0);
  return { rowCount: Math.max(1000, rows), columnCount: Math.max(26, cols) };
}

function rangeOk(range) {
  if (!range) return false;
  const { startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } = range;
  return startRowIndex >= 0 && endRowIndex > startRowIndex && startColumnIndex >= 0 && endColumnIndex > startColumnIndex;
}

export function auditRequests(ws, requests) {
  const faults = [];
  const m = /^([A-Z]+)(\d+)$/.exec(ws.freeze || '');
  const frozenRows = m ? Math.max(0, Number(m[2]) - 1) : 0;
  let frozenCols = 0;
  if (m) {
    let n = 0;
    for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
    frozenCols = n - 1;
  }
  const grid = requiredGrid(ws);
  const noteGrid = (range, where) => {
    if (!range) return;
    if (range.endRowIndex > grid.rowCount || range.endColumnIndex > grid.columnCount) faults.push(where + ' além da grelha');
  };
  const merges = [];
  requests.forEach((req, i) => {
    if (req.mergeCells) {
      const range = req.mergeCells.range;
      if (!rangeOk(range)) faults.push('união sem intervalo');
      const prev = requests[i - 1];
      const same = prev && prev.unmergeCells && JSON.stringify(prev.unmergeCells.range) === JSON.stringify(range);
      if (!same) faults.push('união sem desunir antes');
      merges.push([
        range.startRowIndex + 1,
        range.startColumnIndex + 1,
        range.endRowIndex,
        range.endColumnIndex
      ]);
    }
    const dim = req.updateDimensionProperties;
    if (dim) {
      const r = dim.range;
      if (!r || r.startIndex < 0 || r.endIndex <= r.startIndex) faults.push('dimensão inválida');
    }
    const rep = req.repeatCell && req.repeatCell.range;
    if (req.repeatCell && !rangeOk(rep)) faults.push('pintura sem intervalo');
    if (req.addProtectedRange && !rangeOk(req.addProtectedRange.protectedRange && req.addProtectedRange.protectedRange.range)) faults.push('proteção sem intervalo');
    if (req.addConditionalFormatRule) {
      const rule = req.addConditionalFormatRule.rule;
      const cond = rule && rule.booleanRule && rule.booleanRule.condition;
      const entered = cond && cond.values && cond.values[0] && cond.values[0].userEnteredValue;
      if (!entered) faults.push('formato condicional sem fórmula');
      else faults.push(...formulaFaults(entered, 'formato condicional'));
      if (!rule.ranges || !rule.ranges.length || !rangeOk(rule.ranges[0])) faults.push('formato condicional sem intervalo');
      if (rule.ranges && rule.ranges[0] && rangeOk(rule.ranges[0])) noteGrid(rule.ranges[0], 'formato condicional');
    }
    if (req.setDataValidation) {
      if (!rangeOk(req.setDataValidation.range)) faults.push('validação sem intervalo');
      const cond = req.setDataValidation.rule && req.setDataValidation.rule.condition;
      const entered = cond && cond.values && cond.values[0] && cond.values[0].userEnteredValue;
      if (cond && (cond.type === 'ONE_OF_RANGE' || cond.type === 'CUSTOM_FORMULA')) {
        if (!entered) faults.push('validação sem intervalo de origem');
        else faults.push(...formulaFaults(entered, 'validação'));
      }
      if (req.setDataValidation.range) noteGrid(req.setDataValidation.range, 'validação');
    }
    if (req.repeatCell && req.repeatCell.range) noteGrid(req.repeatCell.range, 'pintura');
    if (req.addProtectedRange && req.addProtectedRange.protectedRange && req.addProtectedRange.protectedRange.range) noteGrid(req.addProtectedRange.protectedRange.range, 'proteção');
    if (req.updateDimensionProperties && req.updateDimensionProperties.range) {
      const r = req.updateDimensionProperties.range;
      if (r.dimension === 'ROWS' && r.endIndex > grid.rowCount) faults.push('dimensão além da grelha');
      if (r.dimension === 'COLUMNS' && r.endIndex > grid.columnCount) faults.push('dimensão além da grelha');
    }
    const sheetId = (req.mergeCells && req.mergeCells.range.sheetId)
      || (req.repeatCell && req.repeatCell.range.sheetId)
      || (req.updateSheetProperties && req.updateSheetProperties.properties.sheetId);
    if (sheetId != null && typeof sheetId !== 'number') faults.push('sheetId inválido');
  });
  const hiddenRows = new Set(ws.hideRow || []);
  const hiddenCols = new Set((ws.hideCol || []).map(c => typeof c === 'number' ? c : colNum(c)));
  if (frozenRows > 0 && [...hiddenRows].filter(r => r <= frozenRows).length >= frozenRows) faults.push('todas as linhas congeladas ficam ocultas');
  if (frozenCols > 0 && [...hiddenCols].filter(c => c <= frozenCols).length >= frozenCols) faults.push('todas as colunas congeladas ficam ocultas');
  return faults.concat(mergeFaults(merges, {
    frozenRows, frozenCols, hiddenRows: ws.hideRow, hiddenCols: ws.hideCol
  }));
}

/** Referência 'Separador'! que não está dentro de INDIRECT("..."). */
export function bareSheetRefs(formula) {
  let s = String(formula || '');
  s = s.replace(/INDIRECT\(\s*"(?:[^"]|"")*"\s*\)/gi, '');
  s = s.replace(/"(?:[^"]|"")*"/g, '');
  const found = [];
  const re = /'(?:[^']|'')+'!/g;
  let m;
  while ((m = re.exec(s))) found.push(m[0]);
  return found;
}

function formulaFaults(formula, where) {
  const faults = [];
  const text = String(formula || '');
  if (text && !text.startsWith('=')) faults.push(where + ' sem =');
  for (const ref of bareSheetRefs(text)) faults.push(where + ' com referência direta ' + ref);
  if (/\bTRUE\b|\bFALSE\b/.test(text.replace(/"(?:[^"]|"")*"/g, ''))) faults.push(where + ' com booleano inglês');
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') q = !q;
    if (!q && ch === ',') {
      const prev = text[i - 1];
      const next = text[i + 1];
      const decimal = prev >= '0' && prev <= '9' && next >= '0' && next <= '9';
      if (!decimal) { faults.push(where + ' com vírgula de argumento'); break; }
    }
  }
  return faults;
}

export function mergeFaults(merges, opt = {}) {
  const frozenRows = Number(opt.frozenRows) || 0;
  const frozenCols = Number(opt.frozenCols) || 0;
  const hiddenRows = new Set(opt.hiddenRows || []);
  const hiddenCols = new Set((opt.hiddenCols || []).map(c => typeof c === 'number' ? c : colNum(c)));
  const faults = [];
  merges.forEach((m, i) => {
    const [r1, c1, r2, c2] = m;
    if (!(r2 > r1 || c2 > c1)) faults.push('união ' + i + ' é uma só célula');
    if (frozenRows > 0 && r1 <= frozenRows && r2 > frozenRows) faults.push('união ' + i + ' cruza as linhas congeladas');
    if (frozenCols > 0 && c1 <= frozenCols && c2 > frozenCols) faults.push('união ' + i + ' cruza as colunas congeladas');
    for (const hr of hiddenRows) if (r1 <= hr && r2 > hr) faults.push('união ' + i + ' cruza a linha oculta ' + hr);
    for (const hc of hiddenCols) if (c1 <= hc && c2 > hc) faults.push('união ' + i + ' cruza a coluna oculta ' + hc);
    for (let j = 0; j < i; j++) if (overlaps(merges[j], m)) faults.push('união ' + i + ' sobrepõe a união ' + j);
  });
  return faults;
}

export function progressText(index, total, label) {
  return `A criar separador ${index + 1} de ${total}: ${label}`;
}

export function stepLabel(ws) {
  const role = ws && ws.role;
  let title = String((ws && ws.title) || '');
  if (role === 'motorista' || role === 'tuk') {
    title = title.replace(/\(patrão\)/g, '');
    title = title.replace(/^[^\p{L}\p{N}]+/u, '');
  } else {
    title = title.replace(/^⚙\s*/, '');
  }
  return title.trim() || (ws && ws.title) || '';
}

const HIDDEN = new Set([
  'config', 'tuks-reg', 'drivers-reg', 'pct', 'types', 'fixed', 'objectives', 'prize', 'log',
  'consolidado', 'estrutura', 'modelo-motorista', 'modelo-tuk'
]);

export function orderSheets(sheets) {
  const group = (ws) => {
    if (HIDDEN.has(ws.role) || String(ws.title || '').startsWith('⚙')) return 0;
    if (ws.role === 'motorista') return 2;
    if (ws.role === 'tuk') return 3;
    return 1;
  };
  return sheets.map((ws, i) => ({ ws, i, g: group(ws) }))
    .sort((a, b) => a.g - b.g || a.i - b.i)
    .map(x => x.ws);
}

export function planRun(steps, doneCount) {
  const total = steps.length;
  const done = Math.max(0, Math.min(total, Number(doneCount) || 0));
  return { done, total, pending: steps.slice(done) };
}

/** Corre os passos em falta. A pausa fica entre separadores, não antes do primeiro nem depois do último. */
export async function runStages({ steps, doneCount, gapMs = STEP_GAP_MS, sleep, work, onStep }) {
  const plan = planRun(steps, doneCount);
  let index = plan.done;
  for (const step of plan.pending) {
    if (index > plan.done) await sleep(gapMs);
    if (onStep) await onStep(step, index, plan.total);
    await work(step, index, plan.total);
    index += 1;
  }
  return index;
}

export function formatIdMap(sheets) {
  return (sheets || []).filter(ws => ws.ref && ws.sheetId != null).map(ws => `${ws.ref}=${ws.sheetId}`).join(',');
}

export function parseIdMap(text) {
  const out = {};
  for (const part of String(text || '').split(',')) {
    const m = /^([A-Za-z0-9_-]+)=(\d+)$/.exec(part.trim());
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

export function reconcileIndex(steps, existingTitles, claimed) {
  const max = Math.max(0, Math.min(steps.length, Number(claimed) || 0));
  let i = 0;
  while (i < max && existingTitles && existingTitles.has(steps[i].title)) i += 1;
  return i;
}
