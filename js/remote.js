/* Drive e Sheets a partir do browser. Lê e escreve pela chave, não pela posição. */

import { cellFromParts, partsFromCell, round2 } from './format.js';
import { blankYear, ensureRecurring } from './model.js';
import { buildBook, colLetter, contextFromModel, keyIndex } from './sheet.js';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const APP_MARK = 'tuk-manager';

async function gfetch(token, url, opt = {}) {
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

function formatRequests(ws) {
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
  const painted = new Map();
  for (const c of ws.cells) {
    if (!c.bg && !c.nf && !c.bold && !c.color) continue;
    const sig = [c.bg || '', c.nf || '', c.bold ? 1 : 0, c.color || '', c.align || ''].join('|');
    if (!painted.has(sig)) painted.set(sig, []);
    painted.get(sig).push(c);
  }
  for (const [sig, cells] of painted) {
    const [bg, nf, bold, color, align] = sig.split('|');
    const byCol = new Map();
    for (const c of cells) {
      if (!byCol.has(c.c)) byCol.set(c.c, []);
      byCol.get(c.c).push(c.r);
    }
    const format = { textFormat: { fontFamily: 'Arial', fontSize: 10, bold: bold === '1', foregroundColor: color ? hexColor(color) : { red: 0, green: 0, blue: 0 } } };
    if (bg) format.backgroundColor = hexColor(bg);
    if (nf) format.numberFormat = { type: nf.includes('%') ? 'PERCENT' : 'NUMBER', pattern: nf };
    if (align) format.horizontalAlignment = align === 'center' ? 'CENTER' : align === 'right' ? 'RIGHT' : 'LEFT';
    for (const [col, rows] of byCol) {
      for (const run of runs(rows)) {
        req.push({ repeatCell: { range: { sheetId: id, startRowIndex: run.start - 1, endRowIndex: run.end, startColumnIndex: col - 1, endColumnIndex: col }, cell: { userEnteredFormat: format }, fields: 'userEnteredFormat(backgroundColor,textFormat,numberFormat,horizontalAlignment)' } });
      }
    }
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
  const q = encodeURIComponent(`appProperties has { key='tmApp' and value='${APP_MARK}' } and trashed=false`);
  const data = await gfetch(token, `${DRIVE}/files?q=${q}&fields=files(id,name,modifiedTime,appProperties)&pageSize=100`);
  return data.files || [];
}

export async function createBook(token, model) {
  const book = fillGids(buildBook(contextFromModel(model)));
  const title = `${model.businessName} · ${model.year}`;
  const created = await gfetch(token, SHEETS, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title, locale: 'pt_PT' },
      sheets: book.sheets.map(ws => ({
        properties: {
          sheetId: ws.sheetId,
          title: ws.title,
          hidden: !!ws.hidden,
          tabColor: hexColor(ws.color)
        }
      }))
    })
  });
  const id = created.spreadsheetId;
  await gfetch(token, `${DRIVE}/files/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ appProperties: { tmApp: APP_MARK, role: 'main', year: String(model.year) } })
  });
  const data = [];
  for (const ws of book.sheets) {
    data.push({ range: `'${ws.title.replace(/'/g, "''")}'!A1`, majorDimension: 'ROWS', values: gridOf(ws) });
  }
  for (let i = 0; i < data.length; i += 8) {
    await gfetch(token, `${SHEETS}/${id}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: data.slice(i, i + 8) })
    });
  }
  let formats = [];
  for (const ws of book.sheets) formats = formats.concat(formatRequests(ws));
  await batch(token, id, formats);
  return { id, name: title, url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
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
  grid.forEach((row, i) => { if (row && row[0]) rows[String(row[0])] = i + 1; });
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
    if (c.c === 1 && c.r > 1 && c.v) rows[String(c.v)] = c.r;
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
    const norm = (v) => v == null || v === '' ? '' : String(v);
    if (norm(current) !== norm(base)) conflicts.push({ ...jobs[i], current });
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
  colA.forEach((row, i) => { if (row && row[0]) rows[String(row[0])] = i + 1; });
  return { cols, rows };
}

export async function backupFile(token, file) {
  const copy = await gfetch(token, `${DRIVE}/files/${file.id}/copy`, {
    method: 'POST',
    body: JSON.stringify({
      name: `${file.name} (cópia)`,
      appProperties: { tmApp: APP_MARK, role: 'backup', year: String(file.year) }
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
