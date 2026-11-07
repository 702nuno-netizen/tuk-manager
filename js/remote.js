/* Drive e Sheets a partir do browser. Lê e escreve pela chave, não pela posição. */

import { cellFromParts, partsFromCell, round2, rowKey } from './format.js';
import { blankYear, ensureRecurring } from './model.js';
import { buildBook, colLetter, contextFromModel, keyIndex } from './sheet.js';
import {
  STEP_GAP_MS, backoffMs, explainError, formatIdMap, legalMerges, orderSheets, parseIdMap, progressText, requiredGrid,
  reconcileIndex, runStages, splitPayload, stepLabel
} from './stages.js';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const APP_MARK = 'tuk-manager';

export function yearFileName(business, year, role) {
  const base = `${String(business || '').trim()} · ${year}`;
  return role === 'backup' ? `${base} (cópia)` : base;
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function gfetch(token, url, opt = {}, attempt = 0) {
  let res;
  try {
    res = await fetch(url, {
      ...opt,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opt.headers || {}) }
    });
  } catch (e) {
    if (attempt < 4) {
      await wait(backoffMs(attempt));
      return gfetch(token, url, opt, attempt + 1);
    }
    const err = new Error('sem rede');
    err.offline = true;
    err.reason = explainError(err);
    throw err;
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 8) {
    const retryAfter = Number(res.headers.get('retry-after'));
    await wait(backoffMs(attempt, retryAfter));
    return gfetch(token, url, opt, attempt + 1);
  }
  if (!res.ok) {
    const err = new Error('Google ' + res.status);
    err.status = res.status;
    err.body = (await res.text()).slice(0, 4000);
    err.reason = explainError(err);
    console.warn('[folha]', res.status, String(url).slice(0, 120), err.body);
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function hexColor(hex) {
  const h = String(hex || '808080').replace('#', '');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { red: n(0), green: n(2), blue: n(4) };
}

function colIdx(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseA1(sheetId, a1) {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(a1);
  if (!m) return null;
  return {
    sheetId,
    startColumnIndex: colIdx(m[1]),
    endColumnIndex: colIdx(m[3]) + 1,
    startRowIndex: Number(m[2]) - 1,
    endRowIndex: Number(m[4])
  };
}

function runs(nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out = [];
  for (const n of s) {
    const last = out[out.length - 1];
    if (last && last.end === n - 1) last.end = n;
    else out.push({ start: n, end: n });
  }
  return out;
}

function freezeOf(spec) {
  if (!spec) return null;
  const m = /^([A-Z]+)(\d+)$/.exec(spec);
  if (!m) return null;
  return { frozenRowCount: Math.max(0, Number(m[2]) - 1), frozenColumnCount: colIdx(m[1]) };
}

function fillGids(book) {
  book.sheets.forEach((ws, i) => { ws.sheetId = i + 1; });
  const ids = {};
  for (const ws of book.sheets) if (ws.ref) ids[ws.ref] = ws.sheetId;
  for (const ws of book.sheets) {
    for (const c of ws.cells) {
      if (typeof c.v === 'string' && c.v.includes('{{gid:')) {
        c.v = c.v.replace(/\{\{gid:([^}]+)\}\}/g, (_, k) => String(k === 'self' ? ws.sheetId : (ids[k] || 0)));
      }
    }
  }
  return book;
}

function gridOf(ws) {
  let maxR = 1;
  let maxC = 1;
  for (const c of ws.cells) {
    maxR = Math.max(maxR, c.r);
    maxC = Math.max(maxC, c.c);
  }
  const rows = Array.from({ length: maxR }, () => Array(maxC).fill(''));
  for (const c of ws.cells) rows[c.r - 1][c.c - 1] = c.v == null ? '' : c.v;
  return rows;
}

export function formatRequests(ws) {
  const req = [];
  const id = ws.sheetId;
  const fr = freezeOf(ws.freeze);
  if (fr) {
    req.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: fr }, fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount' } });
  }
  for (const [c, w] of Object.entries(ws.colW)) {
    const idx = Number(c) - 1;
    if (idx < 0) continue;
    req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 }, properties: { pixelSize: Math.max(30, Math.round(Number(w) * 8)) }, fields: 'pixelSize' } });
  }
  const hideCols = ws.hideCol.map(letter => colIdx(letter));
  for (const run of runs(hideCols)) {
    req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'COLUMNS', startIndex: run.start, endIndex: run.end + 1 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } });
  }
  for (const run of runs(ws.hideRow)) {
    req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'ROWS', startIndex: run.start - 1, endIndex: run.end }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } });
  }
  const merges = legalMerges(ws.merges, {
    frozenRows: fr ? fr.frozenRowCount : 0,
    frozenCols: fr ? fr.frozenColumnCount : 0,
    hiddenRows: ws.hideRow,
    hiddenCols: ws.hideCol
  });
  for (const [r1, c1, r2, c2] of merges) {
    const range = { sheetId: id, startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: c1 - 1, endColumnIndex: c2 };
    req.push({ unmergeCells: { range } });
    req.push({ mergeCells: { range, mergeType: 'MERGE_ALL' } });
  }
  for (const [row, h] of Object.entries(ws.rowH || {})) {
    const r = Number(row);
    req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'ROWS', startIndex: r - 1, endIndex: r }, properties: { pixelSize: Math.round(Number(h) * 1.3) }, fields: 'pixelSize' } });
  }
  const painted = new Map();
  for (const c of ws.cells) {
    if (!c.bg && !c.nf && !c.bold && !c.color && !c.border && !c.size) continue;
    const sig = JSON.stringify([c.bg || '', c.nf || '', c.bold ? 1 : 0, c.italic ? 1 : 0, c.color || '', c.align || '', c.size || 10, c.wrap ? 1 : 0, c.border ? 1 : 0, c.bg === 'FFF9E5' ? 1 : 0]);
    if (!painted.has(sig)) painted.set(sig, []);
    painted.get(sig).push(c);
  }
  for (const [sig, cells] of painted) {
    const [bg, nf, bold, italic, color, align, size, wrap, border, inputBorder] = JSON.parse(sig);
    const byCol = new Map();
    for (const c of cells) {
      if (!byCol.has(c.c)) byCol.set(c.c, []);
      byCol.get(c.c).push(c.r);
    }
    const format = {
      textFormat: {
        fontFamily: 'Arial',
        fontSize: Number(size) || 10,
        bold: bold === 1,
        italic: italic === 1,
        foregroundColor: color ? hexColor(color) : { red: 0, green: 0, blue: 0 }
      }
    };
    if (wrap === 1) format.wrapStrategy = 'WRAP';
    const fields = ['userEnteredFormat.textFormat'];
    if (bg) { format.backgroundColor = hexColor(bg); fields.push('userEnteredFormat.backgroundColor'); }
    if (nf) {
      const pattern = String(nf);
      format.numberFormat = { type: /^0(\.0+)?%$/.test(pattern) ? 'PERCENT' : 'NUMBER', pattern };
      fields.push('userEnteredFormat.numberFormat');
    }
    if (align) {
      format.horizontalAlignment = align === 'center' ? 'CENTER' : align === 'right' ? 'RIGHT' : 'LEFT';
      fields.push('userEnteredFormat.horizontalAlignment');
    }
    if (wrap === 1) fields.push('userEnteredFormat.wrapStrategy');
    if (border || inputBorder) {
      const edge = hexColor(inputBorder ? 'E0B000' : 'BFBFBF');
      const side = { style: 'SOLID', color: edge };
      format.borders = { top: side, bottom: side, left: side, right: side };
      fields.push('userEnteredFormat.borders');
    }
    for (const [col, rows] of byCol) {
      for (const run of runs(rows)) {
        req.push({ repeatCell: { range: { sheetId: id, startRowIndex: run.start - 1, endRowIndex: run.end, startColumnIndex: col - 1, endColumnIndex: col }, cell: { userEnteredFormat: format }, fields: fields.join(',') } });
      }
    }
  }
  for (const rule of ws.cf || []) {
    const range = parseA1(id, rule.range);
    if (!range) continue;
    const format = {};
    if (rule.bg) format.backgroundColor = hexColor(rule.bg);
    if (rule.color || rule.bold || rule.italic) format.textFormat = { bold: !!rule.bold, italic: !!rule.italic, foregroundColor: rule.color ? hexColor(rule.color) : undefined };
    req.push({ addConditionalFormatRule: { rule: { ranges: [range], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: rule.formula }] }, format } }, index: 0 } });
  }
  for (const a1 of ws.protect) {
    const range = parseA1(id, a1);
    if (!range) continue;
    req.push({ addProtectedRange: { protectedRange: { range, description: 'Calculado', warningOnly: false } } });
  }
  for (const check of ws.checks) {
    const range = parseA1(id, check.range.includes(':') ? check.range : check.range + ':' + check.range);
    if (!range) continue;
    let condition;
    if (check.kind === 'list') condition = { type: 'ONE_OF_LIST', values: check.values.map(v => ({ userEnteredValue: String(v) })) };
    else if (check.kind === 'list-range') condition = { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: check.formula }] };
    else condition = { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: '0' }] };
    req.push({ setDataValidation: { range, rule: { condition, strict: check.kind !== 'list-range', showCustomUi: true } } });
  }
  return req;
}

async function batch(token, id, requests) {
  for (let i = 0; i < requests.length; i += 60) {
    const chunk = requests.slice(i, i + 60);
    if (!chunk.length) continue;
    await gfetch(token, `${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: chunk }) });
  }
}

export async function listFiles(token) {
  const files = [];
  let pageToken = '';
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  do {
    const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const data = await gfetch(token, `${DRIVE}/files?q=${q}&fields=nextPageToken,files(id,name,createdTime,modifiedTime,quotaBytesUsed,appProperties)&pageSize=100${page}`);
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return files;
}

function dataScore(file) {
  const n = Number(file && (file.sheetCount != null ? file.sheetCount : file.quotaBytesUsed));
  return Number.isFinite(n) ? n : 0;
}

/** Uma folha por ano. Se houver várias, fica a que tem mais dados; empate, a mais antiga. O id guardado ganha sempre. */
export function chooseFile(files, { role, year, preferredId, title } = {}) {
  const yearS = String(year);
  const usable = (files || []).filter(f => f && f.id && !f.trashed);
  const tagged = usable.filter(f => {
    const p = f.appProperties || {};
    return p.tmApp === APP_MARK && String(p.role || '') === String(role || '') && String(p.year || '') === yearS;
  });
  const orphans = String(role) === 'main' ? usable.filter(f => {
    const p = f.appProperties || {};
    if (p.tmApp === APP_MARK && p.role) return false;
    return !!title && f.name === title;
  }) : [];
  const pool = tagged.length ? tagged : orphans;
  if (!pool.length) return null;
  if (preferredId && pool.some(f => f.id === preferredId)) return pool.find(f => f.id === preferredId);
  return pool.slice().sort((a, b) => {
    const d = dataScore(b) - dataScore(a);
    if (d) return d;
    return String(a.createdTime || '9999').localeCompare(String(b.createdTime || '9999'));
  })[0];
}

export function decideSetup(files, opts) {
  const file = chooseFile(files, opts);
  return file ? { action: 'reuse', id: file.id, file } : { action: 'create' };
}

/** Só muda o nome dos ficheiros que já existem. Não cria folha nenhuma. */
export function renamePlan(files, spec) {
  const mainName = yearFileName(spec.name, spec.year, 'main');
  const backupName = yearFileName(spec.name, spec.year, 'backup');
  let main = chooseFile(files, { role: 'main', year: spec.year, preferredId: spec.mainId });
  if (spec.mainId && (!main || main.id !== spec.mainId)) main = null;
  const backup = (main || !spec.mainId) ? chooseFile(files, { role: 'backup', year: spec.year }) : null;
  const ops = [];
  if (main && main.name !== mainName && !spec.mainDone) ops.push({ id: main.id, role: 'main', name: mainName });
  if (backup && backup.name !== backupName) ops.push({ id: backup.id, role: 'backup', name: backupName });
  return {
    mainName, backupName,
    mainId: main ? main.id : '',
    backupId: backup ? backup.id : '',
    mainFound: !!main,
    backupFound: !!backup,
    ops
  };
}

export async function renameYearFiles(token, spec) {
  const files = await listFiles(token);
  const plan = renamePlan(files, spec);
  const out = {
    main: plan.mainFound || spec.mainDone ? 'ok' : 'missing',
    backup: plan.backupFound ? 'ok' : 'absent',
    mainId: plan.mainId,
    mainName: plan.mainName,
    backupName: plan.backupName
  };
  for (const op of plan.ops) {
    if (op.role === 'backup' && out.main === 'failed') {
      out.backup = 'failed';
      continue;
    }
    try {
      await gfetch(token, `${DRIVE}/files/${op.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: op.name })
      });
    } catch (e) {
      if (op.role === 'main') out.main = 'failed';
      else out.backup = 'failed';
    }
  }
  return out;
}

export async function accountOf(token) {
  const data = await gfetch(token, `${DRIVE}/about?fields=user(emailAddress,permissionId)`);
  const user = (data && data.user) || {};
  return { email: String(user.emailAddress || ''), id: String(user.permissionId || '') };
}

function sheetUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function assignGids(book, existingByTitle, savedIds) {
  const used = new Set();
  let maxId = 0;
  for (const id of existingByTitle.values()) {
    const n = Number(id) || 0;
    used.add(n);
    maxId = Math.max(maxId, n);
  }
  for (const id of Object.values(savedIds || {})) {
    const n = Number(id) || 0;
    if (n) { used.add(n); maxId = Math.max(maxId, n); }
  }
  for (const ws of book.sheets) {
    if (existingByTitle.has(ws.title)) ws.sheetId = existingByTitle.get(ws.title);
    else if (ws.ref && savedIds && savedIds[ws.ref] && !takenByOther(existingByTitle, ws.title, savedIds[ws.ref])) ws.sheetId = Number(savedIds[ws.ref]);
    else {
      do { maxId += 1; } while (used.has(maxId));
      ws.sheetId = maxId;
      used.add(maxId);
    }
  }
  const ids = {};
  for (const ws of book.sheets) if (ws.ref) ids[ws.ref] = ws.sheetId;
  for (const ws of book.sheets) bindGids(ws, ws.sheetId, ids);
  return book;
}

function takenByOther(existingByTitle, title, id) {
  for (const [name, sid] of existingByTitle) if (name !== title && Number(sid) === Number(id)) return true;
  return false;
}

async function stampFile(token, id, props) {
  await gfetch(token, `${DRIVE}/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties: props })
  });
}

async function driveCreate(token, name, role, year) {
  return gfetch(token, `${DRIVE}/files`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      appProperties: { tmApp: APP_MARK, role, year: String(year), ready: '0' }
    })
  });
}

const DEFAULT_TITLES = new Set(['Sheet1', 'Folha1', 'Folha 1', 'Página1']);

async function hasSchema(token, fileId) {
  try {
    const rows = await readRange(token, fileId, `'⚙ Config'!A1:B40`, 'UNFORMATTED_VALUE');
    return rows.some(row => String((row || [])[0] || '') === 'schema_version' && String((row || [])[1] || '') !== '');
  } catch (e) {
    return false;
  }
}

async function readProgress(token, fileId) {
  try {
    const rows = await readRange(token, fileId, `'⚙ Config'!A28:B29`, 'UNFORMATTED_VALUE');
    const ids = parseIdMap((rows[0] || [])[1]);
    const index = Number((rows[1] || [])[1]) || 0;
    return { ids, index };
  } catch (e) {
    return { ids: {}, index: 0 };
  }
}

async function sendRequests(token, id, requests, chunk = 10) {
  for (let i = 0; i < requests.length; i += chunk) {
    const piece = requests.slice(i, i + chunk);
    if (!piece.length) continue;
    await gfetch(token, `${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: piece }) });
  }
}

const BULK_BYTES = 8000000;

export function shouldStage(e) {
  if (!e) return false;
  if (e.offline) return true;
  const status = Number(e.status) || 0;
  if (status === 429 || status === 413 || status >= 500) return true;
  const body = String(e.body || e.message || '');
  return /payload|too large|entity too large|exceeds the limit|too many/i.test(body);
}

async function sendBulk(token, id, requests) {
  const chunks = splitPayload(requests, BULK_BYTES);
  if (chunks.length > 3) {
    const err = new Error('payload');
    err.status = 413;
    err.body = 'Request payload too large';
    throw err;
  }
  for (const piece of chunks) {
    if (!piece.length) continue;
    await gfetch(token, `${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: piece }) });
  }
}

async function writeValueChunks(token, fileId, data) {
  const chunks = splitPayload(data, BULK_BYTES);
  if (chunks.length > 2) {
    const err = new Error('payload');
    err.status = 413;
    err.body = 'Request payload too large';
    throw err;
  }
  for (const piece of chunks) {
    if (!piece.length) continue;
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: piece })
    });
  }
}

function valueBands(ws, size = 60) {
  const rows = gridOf(ws);
  const bands = [];
  const width = rows[0] ? rows[0].length : 1;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const end = i + slice.length;
    bands.push({ range: `${qTitle(ws.title)}!A${i + 1}:${colLetter(width)}${end}`, values: slice });
  }
  return bands;
}

async function clearOneSheet(token, fileId, sheetId) {
  try {
    const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=sheets(properties(sheetId),protectedRanges(protectedRangeId),conditionalFormats)`);
    const s = (meta.sheets || []).find(x => x.properties && x.properties.sheetId === sheetId);
    if (!s) return;
    const req = [];
    for (const pr of s.protectedRanges || []) {
      if (pr.protectedRangeId != null) req.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } });
    }
    const rules = (s.conditionalFormats || []).length;
    for (let i = rules - 1; i >= 0; i--) req.push({ deleteConditionalFormatRule: { sheetId, index: i } });
    if (req.length) await sendRequests(token, fileId, req, 20);
  } catch (e) {
    console.warn('[folha] limpar separador', sheetId, e.status || '', e.body || e.message || '');
  }
}

async function writeOneSheet(token, fileId, ws, existing) {
  const grid = requiredGrid(ws);
  if (!existing.has(ws.title)) {
    await sendRequests(token, fileId, [{
      addSheet: { properties: { sheetId: ws.sheetId, title: ws.title, hidden: !!ws.hidden, tabColor: hexColor(ws.color), gridProperties: grid } }
    }], 1);
    existing.set(ws.title, ws.sheetId);
  } else {
    ws.sheetId = existing.get(ws.title);
    await sendRequests(token, fileId, [{
      updateSheetProperties: { properties: { sheetId: ws.sheetId, hidden: !!ws.hidden, tabColor: hexColor(ws.color), gridProperties: grid }, fields: 'hidden,tabColor,gridProperties.rowCount,gridProperties.columnCount' }
    }], 1);
    await clearOneSheet(token, fileId, ws.sheetId);
  }
  if (ws.role === 'config') {
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [{ range: `'⚙ Config'!A28:B29`, values: [['sheet_ids', ''], ['setup_index', '0']] }]
      })
    });
  }
  const bands = valueBands(ws, 60);
  for (const band of bands) {
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [band] })
    });
  }
  const painted = formatRequests(ws);
  const merges = painted.filter(r => r.mergeCells || r.unmergeCells);
  const rest = painted.filter(r => !r.mergeCells && !r.unmergeCells);
  await sendRequests(token, fileId, rest, 10);
  await sendRequests(token, fileId, merges, 2);
}

async function noteProgress(token, fileId, index, idMap) {
  try {
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [{ range: `'⚙ Config'!A28:B29`, values: [['sheet_ids', idMap || ''], ['setup_index', String(index)]] }]
      })
    });
  } catch (e) { /* a configuração pode ainda não existir */ }
}

async function stageBook(token, fileId, model, hooks = {}) {
  const sleep = hooks.sleep || wait;
  const gap = hooks.gapMs == null ? STEP_GAP_MS : hooks.gapMs;
  const kind = hooks.kind || 'build';
  const props = hooks.props || {};
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=properties(locale,title),sheets.properties(sheetId,title)`);
  if (!meta.properties || meta.properties.locale !== 'pt_PT') {
    await sendRequests(token, fileId, [{ updateSpreadsheetProperties: { properties: { locale: 'pt_PT', title: meta.properties && meta.properties.title }, fields: 'locale,title' } }], 1);
  }
  const existing = new Map();
  for (const s of meta.sheets || []) existing.set(s.properties.title, s.properties.sheetId);
  const saved = await readProgress(token, fileId);
  const book = assignGids(buildBook(contextFromModel(model)), existing, saved.ids);
  if (hooks.fill) hooks.fill(book);
  const steps = orderSheets(book.sheets);
  const key = kind === 'paint' ? 'paintIndex' : 'setupIndex';
  const claimed = Math.max(Number(props[key]) || 0, kind === 'build' ? saved.index : 0, Number(hooks.localIndex) || 0);
  const start = kind === 'paint' && claimed >= steps.length ? 0 : reconcileIndex(steps, existing, claimed);
  const idMap = formatIdMap(book.sheets);
  const role = hooks.role || 'main';
  const year = model.year;
  try {
    const finished = await runStages({
      steps,
      doneCount: start,
      gapMs: gap,
      sleep,
      onStep: async (ws, index, total) => {
        if (hooks.onProgress) await hooks.onProgress({ index, total, label: stepLabel(ws), title: ws.title });
      },
      work: async (ws, index) => {
        try {
          await writeOneSheet(token, fileId, ws, existing);
          existing.set(ws.title, ws.sheetId);
          const done = index + 1;
          await noteProgress(token, fileId, done, idMap);
          const extra = kind === 'paint'
            ? { ready: props.ready || '1', paintIndex: String(done), setupIndex: props.setupIndex || '' }
            : { ready: '0', setupIndex: String(done) };
          await stampFile(token, fileId, baseProps(role, year, extra));
          if (hooks.onDone) await hooks.onDone(done, fileId);
        } catch (e) {
          e.stepLabel = stepLabel(ws);
          e.stepTitle = ws.title;
          throw e;
        }
      }
    });
    for (const [name, id] of [...existing]) {
      if (DEFAULT_TITLES.has(name)) {
        try { await sendRequests(token, fileId, [{ deleteSheet: { sheetId: id } }], 1); } catch (e) { /* fica a folha de origem */ }
      }
    }
    return { steps: steps.length, index: finished };
  } catch (e) {
    throw e;
  }
}

function baseProps(role, year, extra) {
  return { tmApp: APP_MARK, role, year: String(year), ...extra };
}

async function fastFill(token, fileId, model, kind) {
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=properties(locale,title),sheets(properties(sheetId,title),protectedRanges(protectedRangeId),conditionalFormats)`);
  const existing = new Map();
  for (const s of meta.sheets || []) existing.set(s.properties.title, s.properties.sheetId);
  const book = assignGids(buildBook(contextFromModel(model)), existing, {});
  if (kind === 'paint') for (const ws of book.sheets) fillInputs(ws, model);
  const titles = new Set(book.sheets.map(ws => ws.title));
  const setup = [];
  if (!meta.properties || meta.properties.locale !== 'pt_PT') {
    setup.push({ updateSpreadsheetProperties: { properties: { locale: 'pt_PT', title: meta.properties && meta.properties.title }, fields: 'locale,title' } });
  }
  for (const ws of book.sheets) {
    const grid = requiredGrid(ws);
    if (!existing.has(ws.title)) {
      setup.push({ addSheet: { properties: { sheetId: ws.sheetId, title: ws.title, hidden: !!ws.hidden, tabColor: hexColor(ws.color), gridProperties: grid } } });
    } else {
      setup.push({ updateSheetProperties: { properties: { sheetId: ws.sheetId, hidden: !!ws.hidden, tabColor: hexColor(ws.color), gridProperties: grid }, fields: 'hidden,tabColor,gridProperties.rowCount,gridProperties.columnCount' } });
    }
  }
  const clear = [];
  for (const s of meta.sheets || []) {
    const title = s.properties.title;
    if (titles.has(title)) {
      const id = s.properties.sheetId;
      for (const pr of s.protectedRanges || []) {
        if (pr.protectedRangeId != null) clear.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } });
      }
      const rules = (s.conditionalFormats || []).length;
      for (let i = rules - 1; i >= 0; i--) clear.push({ deleteConditionalFormatRule: { sheetId: id, index: i } });
    } else if (DEFAULT_TITLES.has(title)) {
      setup.push({ deleteSheet: { sheetId: s.properties.sheetId } });
    }
  }
  if (setup.length) await sendBulk(token, fileId, setup);
  const data = [];
  const formats = [];
  for (const ws of book.sheets) {
    data.push(...valueBands(ws));
    formats.push(...formatRequests(ws));
  }
  await writeValueChunks(token, fileId, data);
  await sendBulk(token, fileId, clear.concat(formats));
}

export function fastBatches(model) {
  const book = fillGids(buildBook(contextFromModel(model)));
  const values = [];
  const formats = [];
  for (const ws of book.sheets) {
    values.push(...valueBands(ws));
    formats.push(...formatRequests(ws));
  }
  return {
    sheets: book.sheets.length,
    valueParts: splitPayload(values, BULK_BYTES).length,
    formatParts: splitPayload(formats, BULK_BYTES).length
  };
}

export async function createBook(token, model, preferredId, hooks = {}) {
  const year = model.year;
  const role = hooks.role || 'main';
  const title = yearFileName(model.businessName, year, 'main');
  const fileName = yearFileName(model.businessName, year, role);
  const files = await listFiles(token);
  let chosen = chooseFile(files, { role, year, preferredId, title: role === 'main' ? title : undefined });
  if (!chosen) {
    if (hooks.mustReuse) {
      const err = new Error('sem folha');
      err.status = 401;
      err.reason = 'Não encontrei a folha nesta conta. Não criei outra.';
      throw err;
    }
    const created = await driveCreate(token, fileName, role, year);
    chosen = { id: created.id, name: fileName, appProperties: created.appProperties || {} };
    const again = await listFiles(token);
    const winner = chooseFile(again, { role, year, preferredId, title: role === 'main' ? title : undefined });
    if (winner) chosen = winner;
  }
  if (!chosen) throw new Error('sem folha');
  if (hooks.onFile) await hooks.onFile({ id: chosen.id, name: chosen.name || fileName, year, url: sheetUrl(chosen.id) });
  const props = chosen.appProperties || {};
  try {
    if (role === 'main' && props.ready === '1') return { id: chosen.id, name: chosen.name || fileName, url: sheetUrl(chosen.id) };
    if (role === 'main' && props.ready !== '0' && await hasSchema(token, chosen.id)) {
      await stampFile(token, chosen.id, baseProps(role, year, { ready: '1', setupIndex: props.setupIndex || '' }));
      return { id: chosen.id, name: chosen.name || fileName, url: sheetUrl(chosen.id) };
    }
    const index = Math.max(Number(props.setupIndex) || 0, Number(hooks.localIndex) || 0);
    await stampFile(token, chosen.id, baseProps(role, year, { ready: '0', setupIndex: String(index) }));
    if (index === 0 && role === 'main') {
      try {
        if (hooks.onProgress) await hooks.onProgress({ index: 0, total: 1, text: 'A criar a folha…' });
        await fastFill(token, chosen.id, model, 'build');
        await stampFile(token, chosen.id, baseProps(role, year, { ready: '1', setupIndex: '1' }));
        if (hooks.onDone) await hooks.onDone(1, chosen.id);
        return { id: chosen.id, name: chosen.name || fileName, url: sheetUrl(chosen.id) };
      } catch (e) {
        if (!shouldStage(e)) throw e;
        console.warn('[folha] pedido único falhou, sigo separador a separador', explainError(e));
      }
    }
    const staged = await stageBook(token, chosen.id, model, {
      ...hooks,
      kind: 'build',
      props,
      localIndex: hooks.localIndex,
      onProgress: async (info) => {
        const text = hooks.labelPrefix
          ? `${hooks.labelPrefix}, separador ${info.index + 1} de ${info.total}: ${info.label}`
          : progressText(info.index, info.total, info.label);
        if (hooks.onProgress) await hooks.onProgress({ ...info, text });
      }
    });
    await stampFile(token, chosen.id, baseProps(role, year, { ready: '1', setupIndex: String(staged.index) }));
    if (hooks.onDone) await hooks.onDone(staged.index, chosen.id);
    return { id: chosen.id, name: chosen.name || fileName, url: sheetUrl(chosen.id) };
  } catch (e) {
    e.fileId = chosen.id;
    e.fileName = chosen.name || fileName;
    e.reason = explainError(e);
    console.warn('[folha] falhou', e.stepLabel || '', e.reason, e.body || '');
    throw e;
  }
}

function cell(grid, r, c) {
  const row = grid[r - 1] || [];
  return row[c - 1] == null ? '' : row[c - 1];
}

function indexGrid(grid) {
  const cols = {};
  const rows = {};
  const head = grid[0] || [];
  head.forEach((v, i) => { if (v) cols[String(v)] = i + 1; });
  grid.forEach((row, i) => {
    if (!row || row[0] == null || row[0] === '') return;
    rows[rowKey(row[0])] = i + 1;
  });
  return { cols, rows };
}

async function readRange(token, id, range, render) {
  const data = await gfetch(token, `${SHEETS}/${id}/values/${encodeURIComponent(range)}?valueRenderOption=${render}`);
  return data.values || [];
}

function numOrPct(v) {
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  const s = String(v || '').trim().replace('%', '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return String(v).includes('%') || n > 1 ? n / 100 : n;
}

function asDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(v).trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

export async function loadBook(token, fileId, yearHint) {
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=sheets.properties(sheetId,title,hidden),properties.title`);
  const byTitle = {};
  for (const s of meta.sheets || []) byTitle[s.properties.title] = s.properties;
  const model = blankYear(yearHint || new Date().getFullYear());
  const cfgGrid = await readRange(token, fileId, `'⚙ Config'!A1:C40`, 'UNFORMATTED_VALUE');
  const cfgIdx = indexGrid(cfgGrid);
  const cfgGet = (key) => cfgIdx.rows[key] ? cell(cfgGrid, cfgIdx.rows[key], 2) : '';
  model.year = Number(cfgGet('ano')) || model.year;
  model.businessName = String(cfgGet('negocio') || '');
  model.tipsEnabled = String(cfgGet('gratificacoes_ativas') || 'SIM').toUpperCase() !== 'NÃO';
  model.previousId = String(cfgGet('ficheiro_anterior') || '');
  const tukGrid = await readRange(token, fileId, `'⚙ Tuks'!A1:L60`, 'UNFORMATTED_VALUE');
  const tukIdx = indexGrid(tukGrid);
  model.tuks = [];
  for (let r = 2; r < tukGrid.length + 1; r++) {
    const id = cell(tukGrid, r, 1);
    if (!id) continue;
    model.tuks.push({
      id: String(id),
      number: Number(cell(tukGrid, r, 10)) || 0,
      nickname: String(cell(tukGrid, r, 5) || ''),
      plate: String(cell(tukGrid, r, 11) || ''),
      fuel: String(cell(tukGrid, r, 6) || 'combustão'),
      status: String(cell(tukGrid, r, 8) || 'ativo'),
      soldOn: asDate(cell(tukGrid, r, 9)),
      sheetTitle: String(cell(tukGrid, r, 3) || ''),
      sheetId: Number(cell(tukGrid, r, 4)) || 0
    });
  }
  const motGrid = await readRange(token, fileId, `'⚙ Motoristas'!A1:I80`, 'UNFORMATTED_VALUE');
  model.drivers = [];
  for (let r = 2; r < motGrid.length + 1; r++) {
    const id = cell(motGrid, r, 1);
    if (!id) continue;
    model.drivers.push({
      id: String(id),
      name: String(cell(motGrid, r, 2) || ''),
      phone: String(cell(motGrid, r, 5) || ''),
      since: asDate(cell(motGrid, r, 6)),
      active: String(cell(motGrid, r, 8) || 'ativo') !== 'inativo',
      opening: round2(cell(motGrid, r, 9) || 0),
      sheetTitle: String(cell(motGrid, r, 3) || ''),
      sheetId: Number(cell(motGrid, r, 4)) || 0
    });
  }
  const pctGrid = await readRange(token, fileId, `'⚙ Percentagens'!A1:F200`, 'UNFORMATTED_VALUE');
  model.pct = [];
  for (let r = 2; r < pctGrid.length + 1; r++) {
    const id = cell(pctGrid, r, 1);
    if (!id) continue;
    model.pct.push({ driverId: String(id), from: asDate(cell(pctGrid, r, 3)), pct: numOrPct(cell(pctGrid, r, 4)), role: String(cell(pctGrid, r, 5) || 'motorista') });
  }
  const typeGrid = await readRange(token, fileId, `'⚙ Tipos de gasto'!A1:H40`, 'UNFORMATTED_VALUE');
  if (typeGrid.length > 1) {
    model.types = [];
    for (let r = 2; r < typeGrid.length + 1; r++) {
      const id = cell(typeGrid, r, 1);
      if (!id) continue;
      const freq = String(cell(typeGrid, r, 3) || '');
      model.types.push({
        id: String(id),
        name: String(cell(typeGrid, r, 2) || ''),
        freq: freq.startsWith('M') || freq.startsWith('m') ? 'Mensal' : 'Diário',
        repeat: String(cell(typeGrid, r, 4) || '').toLowerCase().startsWith('s'),
        scope: /combust/.test(String(cell(typeGrid, r, 5) || '')) ? 'combustão' : 'todos',
        active: String(cell(typeGrid, r, 6) || 'ativo') !== 'inativo'
      });
    }
  }
  const fixGrid = await readRange(token, fileId, `'⚙ Gastos fixos'!A1:G300`, 'UNFORMATTED_VALUE');
  model.fixed = [];
  for (let r = 2; r < fixGrid.length + 1; r++) {
    const typeId = cell(fixGrid, r, 1);
    const tukId = cell(fixGrid, r, 3);
    if (!typeId || !tukId) continue;
    model.fixed.push({ typeId: String(typeId), tukId: String(tukId), from: asDate(cell(fixGrid, r, 5)), amount: round2(cell(fixGrid, r, 6) || 0) });
  }
  const preGrid = await readRange(token, fileId, `'⚙ Prémio'!A1:E80`, 'UNFORMATTED_VALUE');
  model.prizes = [];
  for (let r = 2; r < preGrid.length + 1; r++) {
    const from = asDate(cell(preGrid, r, 1));
    if (!from) continue;
    model.prizes.push({ from, active: String(cell(preGrid, r, 2) || '').toUpperCase() === 'SIM', amount: round2(cell(preGrid, r, 3) || 0) });
  }
  const painel = await readRange(token, fileId, `'📊 Painel'!A9:J21`, 'UNFORMATTED_VALUE');
  model.objectives = [];
  for (let m = 1; m <= 12; m++) {
    const row = painel[m] || [];
    model.objectives.push({ month: m, amount: round2(row[9] || 0) });
  }
  const nameToId = {};
  for (const t of model.tuks) nameToId['Tuk ' + String(t.number).padStart(2, '0')] = t.id;
  model.days = {};
  for (const d of model.drivers) {
    const title = d.sheetTitle || (byTitle[d.sheetTitle] && d.sheetTitle);
    const sheetTitle = Object.keys(byTitle).find(name => byTitle[name].sheetId === d.sheetId) || d.sheetTitle;
    if (!sheetTitle || !byTitle[sheetTitle]) continue;
    const grid = await readRange(token, fileId, `'${sheetTitle.replace(/'/g, "''")}'!A1:M520`, 'FORMULA');
    const idx = indexGrid(grid);
    model.days[d.id] = {};
    for (const [key, row] of Object.entries(idx.rows)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const tukName = cell(grid, row, idx.cols.tuk || 4);
      const services = partsFromCell(cell(grid, row, idx.cols.servicos || 5));
      const grat = partsFromCell(cell(grid, row, idx.cols.gratif || 6));
      const entregue = partsFromCell(cell(grid, row, idx.cols.entregas || 10));
      const note = String(cell(grid, row, idx.cols.nota || 12) || '');
      if (!tukName && !services.length && !grat.length && !entregue.length && !note) continue;
      model.days[d.id][key] = { tukId: nameToId[tukName] || null, services, grat, entregue, note, locked: true };
    }
  }
  model.tukDays = {};
  model.tukMonths = {};
  for (const t of model.tuks) {
    const sheetTitle = Object.keys(byTitle).find(name => byTitle[name].sheetId === t.sheetId) || t.sheetTitle;
    if (!sheetTitle || !byTitle[sheetTitle]) continue;
    const grid = await readRange(token, fileId, `'${sheetTitle.replace(/'/g, "''")}'!A1:Z750`, 'FORMULA');
    const idx = indexGrid(grid);
    model.tukDays[t.id] = {};
    model.tukMonths[t.id] = {};
    let valueCol = 4;
    for (const [key, row] of Object.entries(idx.rows)) {
      if (String(key).startsWith('MH|')) {
        const line = grid[row - 1] || [];
        const at = line.findIndex(v => String(v).includes('Valor'));
        if (at >= 0) valueCol = at + 1;
      }
    }
    for (const [key, row] of Object.entries(idx.rows)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        const byType = {};
        for (const [colKey, col] of Object.entries(idx.cols)) {
          if (!colKey.startsWith('type-')) continue;
          const parts = partsFromCell(cell(grid, row, col));
          if (parts.length) byType[colKey.slice(5)] = parts;
        }
        const note = String(cell(grid, row, idx.cols.nota || 12) || '');
        if (Object.keys(byType).length || note) model.tukDays[t.id][key] = { byType, note };
      } else if (/^M\|\d{4}-\d{2}\|/.test(key) && !key.endsWith('|-')) {
        const typeId = key.split('|')[2];
        const parts = partsFromCell(cell(grid, row, valueCol));
        const ym = key.slice(2, 9);
        if (!model.tukMonths[t.id][ym]) model.tukMonths[t.id][ym] = {};
        if (parts.length) model.tukMonths[t.id][ym][typeId] = { parts, auto: false, note: '' };
      }
    }
  }
  model.fileTitle = meta.properties && meta.properties.title;
  void tukIdx;
  return model;
}

function setCell(ws, r, c, v) {
  if (!r || !c) return;
  const hit = ws.cells.find(x => x.r === r && x.c === c);
  if (hit) hit.v = v == null ? '' : v;
}

function fillInputs(ws, model) {
  const keys = indexFromCells(ws);
  if (ws.role === 'motorista') {
    const bag = (model.days || {})[ws.ref] || {};
    for (const [date, rec] of Object.entries(bag)) {
      const row = keys.rows[date];
      if (!row) continue;
      const tuk = (model.tuks || []).find(t => t.id === rec.tukId);
      setCell(ws, row, keys.cols.tuk, tuk ? 'Tuk ' + String(tuk.number).padStart(2, '0') : '');
      setCell(ws, row, keys.cols.servicos, cellFromParts(rec.services));
      setCell(ws, row, keys.cols.gratif, cellFromParts(rec.grat));
      setCell(ws, row, keys.cols.entregas, cellFromParts(rec.entregue));
      setCell(ws, row, keys.cols.nota, rec.note || '');
    }
  }
  if (ws.role === 'tuk') {
    const days = (model.tukDays || {})[ws.ref] || {};
    for (const [date, rec] of Object.entries(days)) {
      const row = keys.rows[date];
      if (!row) continue;
      for (const [typeId, parts] of Object.entries(rec.byType || {})) {
        setCell(ws, row, keys.cols['type-' + typeId], cellFromParts(parts));
      }
      setCell(ws, row, keys.cols.nota, rec.note || '');
    }
    const months = (model.tukMonths || {})[ws.ref] || {};
    for (const [ym, types] of Object.entries(months)) {
      for (const [typeId, cell] of Object.entries(types)) {
        const row = keys.rows[`M|${ym}|${typeId}`];
        if (!row || !cell) continue;
        setCell(ws, row, 4, cellFromParts(cell.parts));
      }
    }
  }
}

function indexFromCells(ws) {
  const cols = {};
  const rows = {};
  for (const c of ws.cells) {
    if (c.r === 1 && c.c > 1 && c.v) cols[String(c.v)] = c.c;
    if (c.c === 1 && c.r > 1 && c.v) rows[rowKey(c.v)] = c.r;
  }
  return { cols, rows };
}

export async function repaintBook(token, fileId, model, hooks = {}) {
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=sheets.properties(sheetId,title)`);
  const byTitle = {};
  for (const s of meta.sheets || []) byTitle[s.properties.title] = s.properties.sheetId;
  const book = buildBook(contextFromModel(model));
  const missing = [];
  for (const ws of book.sheets) if (!byTitle[ws.title] && !ws.hidden) missing.push(ws.title);
  if (missing.length) return { missing };
  const info = await gfetch(token, `${DRIVE}/files/${fileId}?fields=appProperties`);
  try {
    if (hooks.onProgress) await hooks.onProgress({ index: 0, total: 1, text: 'A repor o aspeto…' });
    await fastFill(token, fileId, model, 'paint');
    return { missing: [] };
  } catch (e) {
    if (!shouldStage(e)) throw e;
    console.warn('[folha] repor num pedido falhou, sigo separador a separador', explainError(e));
  }
  await stageBook(token, fileId, model, {
    ...hooks,
    kind: 'paint',
    role: 'main',
    props: (info && info.appProperties) || {},
    fill: (built) => { for (const ws of built.sheets) fillInputs(ws, model); }
  });
  return { missing: [] };
}

export function cellSame(current, base) {
  const na = current == null || current === '' ? '' : String(current);
  const nb = base == null || base === '' ? '' : String(base);
  if (na === nb) return true;
  if ((na === '' || na === '0') && (nb === '' || nb === '0')) return true;
  const fa = Number(na.replace(',', '.'));
  const fb = Number(nb.replace(',', '.'));
  return na !== '' && nb !== '' && Number.isFinite(fa) && Number.isFinite(fb) && fa === fb;
}

function bindGids(ws, selfId, map) {
  for (const c of ws.cells) {
    if (typeof c.v === 'string' && c.v.includes('{{gid:')) {
      c.v = c.v.replace(/\{\{gid:([^}]+)\}\}/g, (_, k) => String(k === 'self' ? selfId : (map[k] || 0)));
    }
  }
}

function qTitle(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

export async function pushRoster(token, fileId, model) {
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=sheets.properties(sheetId,title)`);
  const byTitle = {};
  let maxId = 0;
  for (const s of meta.sheets || []) {
    byTitle[s.properties.title] = s.properties.sheetId;
    maxId = Math.max(maxId, s.properties.sheetId || 0);
  }
  const idByRef = { painel: byTitle['📊 Painel'] || 0 };
  for (const d of model.drivers) if (d.sheetId) idByRef[d.id] = d.sheetId;
  for (const t of model.tuks) if (t.sheetId) idByRef[t.id] = t.sheetId;
  let added = false;
  let staged = 0;
  const book = buildBook(contextFromModel(model));
  const existing = new Map(Object.entries(byTitle));
  for (const ws of book.sheets) {
    if (ws.role !== 'motorista' && ws.role !== 'tuk') continue;
    if (byTitle[ws.title]) {
      const ent = (ws.role === 'motorista' ? model.drivers : model.tuks).find(x => x.id === ws.ref);
      if (ent) { ent.sheetId = byTitle[ws.title]; ent.sheetTitle = ws.title; idByRef[ws.ref] = byTitle[ws.title]; }
      continue;
    }
    if (staged) await wait(STEP_GAP_MS);
    maxId += 1;
    ws.sheetId = maxId;
    bindGids(ws, ws.sheetId, idByRef);
    idByRef[ws.ref] = ws.sheetId;
    await writeOneSheet(token, fileId, ws, existing);
    byTitle[ws.title] = ws.sheetId;
    const ent = (ws.role === 'motorista' ? model.drivers : model.tuks).find(x => x.id === ws.ref);
    if (ent) { ent.sheetId = ws.sheetId; ent.sheetTitle = ws.title; }
    added = true;
    staged += 1;
  }
  const mot = await readRange(token, fileId, `'⚙ Motoristas'!A2:A60`, 'UNFORMATTED_VALUE');
  const tukCol = await readRange(token, fileId, `'⚙ Tuks'!A2:A60`, 'UNFORMATTED_VALUE');
  const writes = [];
  const place = (grid, id, start) => {
    for (let i = 0; i < grid.length; i++) if (String((grid[i] || [])[0] || '') === id) return start + i;
    for (let i = 0; i < 50; i++) if (!grid[i] || !grid[i][0]) return start + i;
    return start;
  };
  model.drivers.forEach((d) => {
    const row = place(mot, d.id, 2);
    const title = d.sheetTitle || '';
    const vals = [d.id, d.name, title, d.sheetId || '', d.phone || '', d.since || ''];
    writes.push({ range: `'⚙ Motoristas'!A${row}:F${row}`, values: [vals] });
    writes.push({ range: `'⚙ Motoristas'!H${row}:I${row}`, values: [[d.active === false ? 'inativo' : 'ativo', d.opening || 0]] });
    if (d.sheetId) writes.push({ range: `'👥 Motoristas'!F${row + 2}`, values: [[`=HYPERLINK("#gid=${d.sheetId}";"abrir →")`]] });
  });
  model.tuks.forEach((t) => {
    const row = place(tukCol, t.id, 2);
    writes.push({ range: `'⚙ Tuks'!A${row}`, values: [[t.id]] });
    writes.push({ range: `'⚙ Tuks'!C${row}:F${row}`, values: [[t.sheetTitle || '', t.sheetId || '', t.nickname || '', t.fuel || '']] });
    writes.push({ range: `'⚙ Tuks'!H${row}:K${row}`, values: [[t.status || 'ativo', t.soldOn || '', t.number, t.plate || '']] });
  });
  const pctRows = (model.pct || []).map(p => [p.driverId, (model.drivers.find(d => d.id === p.driverId) || {}).name || '', p.from, p.pct, p.role, '']);
  while (pctRows.length < 30) pctRows.push(['', '', '', '', '', '']);
  writes.push({ range: `'⚙ Percentagens'!A2:F31`, values: pctRows });
  const typeRows = (model.types || []).map(t => [t.id, t.name, t.freq, t.repeat ? 'sim' : 'não', t.scope === 'combustão' ? 'só tuks a combustão' : 'todos os tuks', t.active === false ? 'inativo' : 'ativo', '', '']);
  while (typeRows.length < 20) typeRows.push(['', '', '', '', '', '', '', '']);
  writes.push({ range: `'⚙ Tipos de gasto'!A2:H21`, values: typeRows });
  const fixRows = (model.fixed || []).map(f => [f.typeId, '', f.tukId, '', f.from, f.amount, f.note || '']);
  while (fixRows.length < 40) fixRows.push(['', '', '', '', '', '', '']);
  writes.push({ range: `'⚙ Gastos fixos'!A2:G41`, values: fixRows });
  const preRows = (model.prizes || []).map(p => [p.from, p.active ? 'SIM' : 'NÃO', p.amount, 'faturado do motorista no mês ≥ objetivo do mês', '']);
  while (preRows.length < 20) preRows.push(['', '', '', '', '']);
  writes.push({ range: `'⚙ Prémio'!A2:E21`, values: preRows });
  const objs = (model.objectives || []).map(o => [o.amount || 0]);
  writes.push({ range: `'📊 Painel'!J10:J21`, values: objs });
  const cfg = await readRange(token, fileId, `'⚙ Config'!A1:A40`, 'UNFORMATTED_VALUE');
  cfg.forEach((row, i) => {
    const key = String((row || [])[0] || '');
    if (key === 'negocio') writes.push({ range: `'⚙ Config'!B${i + 1}`, values: [[model.businessName || '']] });
    if (key === 'gratificacoes_ativas') writes.push({ range: `'⚙ Config'!B${i + 1}`, values: [[model.tipsEnabled ? 'SIM' : 'NÃO']] });
  });
  if (added) {
    const cons = book.sheets.find(s => s.role === 'consolidado');
    if (cons) {
      for (const c of cons.cells) {
        if (typeof c.v === 'string' && c.v.startsWith('=')) {
          writes.push({ range: `'⚙ Consolidado'!${colLetter(c.c)}${c.r}`, values: [[c.v]] });
        }
      }
    }
  }
  for (let i = 0; i < writes.length; i += 40) {
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: writes.slice(i, i + 40) })
    });
  }
  return { added };
}

export async function appendLog(token, fileId, lines) {
  if (!lines.length) return;
  const col = await readRange(token, fileId, `'⚙ Registo'!A1:A400`, 'FORMULA');
  const start = Math.max(2, col.length + 1);
  await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [{ range: `'⚙ Registo'!A${start}:H${start + lines.length - 1}`, values: lines }]
    })
  });
}

export async function writeCells(token, spreadsheetId, jobs) {
  if (!jobs.length) return { conflicts: [] };
  const updates = jobs.map(j => ({ range: j.a1, values: [[j.value == null ? '' : j.value]] }));
  for (let i = 0; i < updates.length; i += 100) {
    await gfetch(token, `${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates.slice(i, i + 100) })
    });
  }
  return { conflicts: [] };
}

export function locateJob(keys, job) {
  if (!job) return '';
  const title = `'${String(job.title || '').replace(/'/g, "''")}'`;
  if (job.direct) return `${title}!${job.direct}`;
  if (!keys) return '';
  let col = keys.cols[job.colKey];
  if (!col && job.colKey === 'valor') col = 4;
  const row = keys.rows[job.rowKey];
  if (!col || !row) return '';
  return `${title}!${colLetter(col)}${row}`;
}

export function addressOf(sheetTitle, keys, rowKey, colKey) {
  const row = keys.rows[rowKey];
  const col = keys.cols[colKey];
  if (!row || !col) return '';
  return `'${String(sheetTitle).replace(/'/g, "''")}'!${colLetter(col)}${row}`;
}

export async function readKeys(token, spreadsheetId, sheetTitle) {
  const grid = await readRange(token, spreadsheetId, `'${String(sheetTitle).replace(/'/g, "''")}'!A1:AZ1`, 'FORMULA');
  const colA = await readRange(token, spreadsheetId, `'${String(sheetTitle).replace(/'/g, "''")}'!A1:A800`, 'FORMULA');
  const cols = {};
  (grid[0] || []).forEach((v, i) => { if (v) cols[String(v)] = i + 1; });
  const rows = {};
  colA.forEach((row, i) => { if (row && row[0] != null && row[0] !== '') rows[rowKey(row[0])] = i + 1; });
  return { cols, rows };
}

export async function backupFile(token, file) {
  const files = await listFiles(token);
  const existing = chooseFile(files, { role: 'backup', year: file.year });
  if (existing) return existing.id;
  const copy = await gfetch(token, `${DRIVE}/files/${file.id}/copy`, {
    method: 'POST',
    body: JSON.stringify({
      name: String(file.name || '').endsWith(' (cópia)') ? file.name : `${file.name} (cópia)`,
      appProperties: baseProps('backup', file.year, { ready: '1' })
    })
  });
  return copy.id;
}

export async function setColumnHidden(token, spreadsheetId, sheetId, colIndex, hidden) {
  await batch(token, spreadsheetId, [{
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: colIndex, endIndex: colIndex + 1 },
      properties: { hiddenByUser: hidden },
      fields: 'hiddenByUser'
    }
  }]);
}

export async function addSheetFromBook(token, spreadsheetId, ws, knownIds) {
  const maxId = Math.max(0, ...Object.values(knownIds).map(n => Number(n) || 0));
  ws.sheetId = maxId + 1;
  const meta = await gfetch(token, `${SHEETS}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`);
  const existing = new Map();
  for (const s of meta.sheets || []) existing.set(s.properties.title, s.properties.sheetId);
  await writeOneSheet(token, spreadsheetId, ws, existing);
  return ws.sheetId;
}

export { cellFromParts, ensureRecurring, keyIndex };
