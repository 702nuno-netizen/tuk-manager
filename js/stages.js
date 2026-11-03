/* Passos da criação da folha. Sem rede: dá para testar a retoma e a pausa. */

export const STEP_GAP_MS = 5000;

export function backoffMs(attempt, retryAfterSec) {
  const n = Number(retryAfterSec);
  if (n > 0) return Math.min(20000, Math.round(n * 1000));
  return Math.min(20000, 500 * 2 ** Math.max(0, attempt));
}

export function explainError(e) {
  if (!e || e.offline) return 'sem ligação';
  const status = Number(e.status) || 0;
  if (status === 429) return 'limite do Google (429)';
  if (status >= 500) return 'o Google não respondeu (' + status + ')';
  if (status === 401 || status === 403) return 'a sessão Google expirou';
  if (status === 400) {
    const bit = String(e.body || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    return bit ? 'pedido recusado: ' + bit : 'pedido recusado (400)';
  }
  if (status) return 'erro do Google (' + status + ')';
  return 'sem ligação';
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
