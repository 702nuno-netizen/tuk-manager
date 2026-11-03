/* Drive e Sheets a partir do browser. Lê e escreve pela chave, não pela posição. */

import { cellFromParts, partsFromCell, round2, rowKey } from './format.js';
import { blankYear, ensureRecurring } from './model.js';
import { buildBook, colLetter, contextFromModel, keyIndex } from './sheet.js';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const APP_MARK = 'tuk-manager';

async function gfetch(token, url, opt = {}, attempt = 0) {
  let res;
  try {
    res = await fetch(url, {
      ...opt,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opt.headers || {}) }
    });
  } catch (e) {
    const err = new Error('sem rede');
    err.offline = true;
    throw err;
  }
  if ((res.status === 429 || res.status === 503) && attempt < 6) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = Math.min(8000, (retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt));
    await new Promise(r => setTimeout(r, wait));
    return gfetch(token, url, opt, attempt + 1);
  }
  if (!res.ok) {
    const err = new Error('Google ' + res.status);
    err.status = res.status;
    err.body = (await res.text()).slice(0, 400);
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
  for (const [r1, c1, r2, c2] of ws.merges) {
    req.push({ mergeCells: { range: { sheetId: id, startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: c1 - 1, endColumnIndex: c2 }, mergeType: 'MERGE_ALL' } });
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

function sheetUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function assignGids(book, existingByTitle) {
  let maxId = 0;
  for (const id of existingByTitle.values()) maxId = Math.max(maxId, Number(id) || 0);
  for (const ws of book.sheets) {
    if (existingByTitle.has(ws.title)) ws.sheetId = existingByTitle.get(ws.title);
    else { maxId += 1; ws.sheetId = maxId; }
  }
  const ids = {};
  for (const ws of book.sheets) if (ws.ref) ids[ws.ref] = ws.sheetId;
  for (const ws of book.sheets) bindGids(ws, ws.sheetId, ids);
  return book;
}

async function stampFile(token, id, year, ready) {
  await gfetch(token, `${DRIVE}/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties: { tmApp: APP_MARK, role: 'main', year: String(year), ready: ready ? '1' : '0' } })
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

async function writeBookValues(token, fileId, book) {
  const sheets = book.sheets.slice().sort((a, b) => (a.title === '⚙ Config') - (b.title === '⚙ Config'));
  const data = sheets.map(ws => ({ range: `${qTitle(ws.title)}!A1`, majorDimension: 'ROWS', values: gridOf(ws) }));
  for (let i = 0; i < data.length; i += 3) {
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: data.slice(i, i + 3) })
    });
  }
}

async function clearDecorations(token, fileId) {
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=sheets(properties(sheetId),protectedRanges(protectedRangeId),conditionalFormats)`);
  const req = [];
  for (const s of meta.sheets || []) {
    for (const pr of s.protectedRanges || []) {
      if (pr.protectedRangeId != null) req.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } });
    }
    const rules = (s.conditionalFormats || []).length;
    for (let i = rules - 1; i >= 0; i--) req.push({ deleteConditionalFormatRule: { sheetId: s.properties.sheetId, index: i } });
  }
  if (req.length) await batch(token, fileId, req);
}

async function batchLoose(token, id, requests) {
  const run = async (list) => {
    if (!list.length) return;
    try {
      await gfetch(token, `${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: list }) });
    } catch (e) {
      if (e.status === 400 && list.length > 1) {
        const mid = Math.ceil(list.length / 2);
        await run(list.slice(0, mid));
        await run(list.slice(mid));
        return;
      }
      if (e.status === 400) return;
      throw e;
    }
  };
  for (let i = 0; i < requests.length; i += 40) await run(requests.slice(i, i + 40));
}

async function ensureBook(token, fileId, model) {
  const title = `${model.businessName} · ${model.year}`;
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=properties(locale,title),sheets.properties(sheetId,title)`);
  const existing = new Map();
  for (const s of meta.sheets || []) existing.set(s.properties.title, s.properties.sheetId);
  const book = assignGids(buildBook(contextFromModel(model)), existing);
  const requests = [];
  if (!meta.properties || meta.properties.locale !== 'pt_PT' || meta.properties.title !== title) {
    requests.push({ updateSpreadsheetProperties: { properties: { title, locale: 'pt_PT' }, fields: 'title,locale' } });
  }
  for (const ws of book.sheets) {
    if (existing.has(ws.title)) {
      requests.push({ updateSheetProperties: { properties: { sheetId: ws.sheetId, hidden: !!ws.hidden, tabColor: hexColor(ws.color) }, fields: 'hidden,tabColor' } });
    } else {
      requests.push({ addSheet: { properties: { sheetId: ws.sheetId, title: ws.title, hidden: !!ws.hidden, tabColor: hexColor(ws.color) } } });
    }
  }
  if (requests.length) await batch(token, fileId, requests);
  const defaults = [];
  for (const [name, id] of existing) {
    if (DEFAULT_TITLES.has(name)) defaults.push({ deleteSheet: { sheetId: id } });
  }
  if (defaults.length) {
    try { await batch(token, fileId, defaults); } catch (e) { /* a folha de origem pode ser a única */ }
  }
  const schema = await hasSchema(token, fileId);
  if (!schema) await writeBookValues(token, fileId, book);
  await clearDecorations(token, fileId);
  let formats = [];
  for (const ws of book.sheets) formats = formats.concat(formatRequests(ws));
  await batchLoose(token, fileId, formats);
  return { id: fileId, name: title, url: sheetUrl(fileId) };
}

export async function createBook(token, model, preferredId) {
  const year = model.year;
  const title = `${model.businessName} · ${year}`;
  const files = await listFiles(token);
  let chosen = chooseFile(files, { role: 'main', year, preferredId, title });
  if (!chosen) {
    await driveCreate(token, title, 'main', year);
    const again = await listFiles(token);
    chosen = chooseFile(again, { role: 'main', year, preferredId, title });
  }
  if (!chosen) throw new Error('sem folha');
  try {
    if ((chosen.appProperties || {}).ready === '1' && (chosen.appProperties || {}).role === 'main') {
      return { id: chosen.id, name: chosen.name || title, url: sheetUrl(chosen.id) };
    }
    await stampFile(token, chosen.id, year, false);
    const done = await ensureBook(token, chosen.id, model);
    await stampFile(token, chosen.id, year, true);
    return done;
  } catch (e) {
    e.fileId = chosen.id;
    e.fileName = chosen.name || title;
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

export async function repaintBook(token, fileId, model) {
  const meta = await gfetch(token, `${SHEETS}/${fileId}?fields=sheets.properties(sheetId,title),sheets.protectedRanges.protectedRangeId`);
  const byTitle = {};
  const deletes = [];
  for (const s of meta.sheets || []) {
    byTitle[s.properties.title] = s.properties.sheetId;
    for (const pr of s.protectedRanges || []) deletes.push({ deleteProtectedRange: { protectedRangeId: pr.protectedRangeId } });
  }
  const book = buildBook(contextFromModel(model));
  const idByRef = { painel: byTitle['📊 Painel'] || 0 };
  for (const d of model.drivers || []) if (d.sheetId) idByRef[d.id] = d.sheetId;
  for (const t of model.tuks || []) if (t.sheetId) idByRef[t.id] = t.sheetId;
  const missing = [];
  for (const ws of book.sheets) {
    if (!byTitle[ws.title]) { if (!ws.hidden) missing.push(ws.title); continue; }
    ws.sheetId = byTitle[ws.title];
    for (const c of ws.cells) {
      if (typeof c.v === 'string' && c.v.includes('{{gid:')) {
        c.v = c.v.replace(/\{\{gid:([^}]+)\}\}/g, (_, k) => String(k === 'self' ? ws.sheetId : (idByRef[k] || 0)));
      }
    }
    fillInputs(ws, model);
  }
  if (missing.length) return { missing };
  if (deletes.length) await batch(token, fileId, deletes);
  const data = book.sheets.filter(ws => byTitle[ws.title]).map(ws => ({
    range: `'${ws.title.replace(/'/g, "''")}'!A1`,
    majorDimension: 'ROWS',
    values: gridOf(ws)
  }));
  for (let i = 0; i < data.length; i += 4) {
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: data.slice(i, i + 4) })
    });
  }
  let formats = [];
  for (const ws of book.sheets) if (byTitle[ws.title]) formats = formats.concat(formatRequests(ws));
  await batch(token, fileId, formats);
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
  const book = buildBook(contextFromModel(model));
  for (const ws of book.sheets) {
    if (ws.role !== 'motorista' && ws.role !== 'tuk') continue;
    if (byTitle[ws.title]) {
      const ent = (ws.role === 'motorista' ? model.drivers : model.tuks).find(x => x.id === ws.ref);
      if (ent) { ent.sheetId = byTitle[ws.title]; ent.sheetTitle = ws.title; idByRef[ws.ref] = byTitle[ws.title]; }
      continue;
    }
    maxId += 1;
    ws.sheetId = maxId;
    bindGids(ws, ws.sheetId, idByRef);
    idByRef[ws.ref] = ws.sheetId;
    byTitle[ws.title] = ws.sheetId;
    await batch(token, fileId, [{ addSheet: { properties: { sheetId: ws.sheetId, title: ws.title, hidden: false, tabColor: hexColor(ws.color) } } }]);
    await gfetch(token, `${SHEETS}/${fileId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [{ range: `${qTitle(ws.title)}!A1`, majorDimension: 'ROWS', values: gridOf(ws) }] })
    });
    await batch(token, fileId, formatRequests(ws));
    const ent = (ws.role === 'motorista' ? model.drivers : model.tuks).find(x => x.id === ws.ref);
    if (ent) { ent.sheetId = ws.sheetId; ent.sheetTitle = ws.title; }
    added = true;
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
  const ranges = jobs.map(j => j.a1);
  const q = ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
  const data = await gfetch(token, `${SHEETS}/${spreadsheetId}/values:batchGet?valueRenderOption=FORMULA&${q}`);
  const conflicts = [];
  const updates = [];
  (data.valueRanges || []).forEach((vr, i) => {
    const current = vr.values && vr.values[0] ? vr.values[0][0] : '';
    const base = jobs[i].baseline == null ? '' : jobs[i].baseline;
    if (!cellSame(current, base)) conflicts.push({ ...jobs[i], current });
    else updates.push({ range: jobs[i].a1, values: [[jobs[i].value == null ? '' : jobs[i].value]] });
  });
  for (let i = 0; i < updates.length; i += 100) {
    await gfetch(token, `${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates.slice(i, i + 100) })
    });
  }
  return { conflicts };
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
      name: `${file.name} (cópia)`,
      appProperties: { tmApp: APP_MARK, role: 'backup', year: String(file.year), ready: '1' }
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
  const maxId = Math.max(0, ...Object.values(knownIds));
  ws.sheetId = maxId + 1;
  await batch(token, spreadsheetId, [{
    addSheet: { properties: { sheetId: ws.sheetId, title: ws.title, hidden: !!ws.hidden, tabColor: hexColor(ws.color) } }
  }]);
  await gfetch(token, `${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [{ range: `'${ws.title.replace(/'/g, "''")}'!A1`, values: gridOf(ws) }] })
  });
  await batch(token, spreadsheetId, formatRequests(ws));
  return ws.sheetId;
}

export { cellFromParts, ensureRecurring, keyIndex };
