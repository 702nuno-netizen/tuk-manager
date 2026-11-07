/* Google Identity Services. Âmbito drive.file, só os ficheiros que a app cria. */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
let clientId = '';
let tokenClient = null;
let pending = null;
let current = null;
let hintEmail = '';

/** Escolha explícita abre a lista. Com email guardado, pede a mesma conta sem a mostrar. */
export function authCall(kind, hint) {
  const email = String(hint || '').trim();
  if (kind === 'choose') return { prompt: 'select_account' };
  if (email) return { prompt: '', hint: email };
  if (kind === 'silent') return { prompt: '' };
  return { prompt: 'select_account' };
}

export function accountsDiffer(savedId, nextId) {
  if (!savedId || !nextId) return false;
  return String(savedId) !== String(nextId);
}

function restore() {
  try {
    const token = sessionStorage.getItem('tm.token');
    const exp = Number(sessionStorage.getItem('tm.exp') || 0);
    if (token && exp > Date.now() + 5000) current = { token, exp };
  } catch (e) { /* modo privado */ }
}

function remember(token, expiresIn) {
  current = { token, exp: Date.now() + (Number(expiresIn) || 3600) * 1000 };
  try {
    sessionStorage.setItem('tm.token', current.token);
    sessionStorage.setItem('tm.exp', String(current.exp));
  } catch (e) { /* ignore */ }
}

function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Não foi possível ligar à conta Google'));
    document.head.appendChild(s);
  });
}

function client() {
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        const wait = pending;
        pending = null;
        if (!wait) return;
        if (!resp || resp.error) wait.reject(new Error((resp && resp.error) || 'auth'));
        else { remember(resp.access_token, resp.expires_in); wait.resolve(resp.access_token); }
      }
    });
  }
  return tokenClient;
}

function request(prompt, timeoutMs, hint) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending && pending.reject === reject) pending = null;
      reject(new Error('timeout'));
    }, timeoutMs);
    pending = {
      resolve: (token) => { clearTimeout(timer); resolve(token); },
      reject: (err) => { clearTimeout(timer); reject(err); }
    };
    const opt = { prompt };
    if (hint) opt.hint = hint;
    client().requestAccessToken(opt);
  });
}

restore();

export const TMGoogle = {
  SCOPE,
  configured() { return !!clientId; },
  setClientId(id) { clientId = String(id || '').trim(); tokenClient = null; },
  setHint(email) { hintEmail = String(email || '').trim(); },
  hint() { return hintEmail; },
  async signIn(selectAccount) {
    await loadGis();
    if (selectAccount) return request('select_account', 120000, '');
    if (hintEmail) {
      try { return await request('', 20000, hintEmail); }
      catch (e) { /* a conta guardada não respondeu; a pessoa escolhe */ }
    }
    return request('select_account', 120000, '');
  },
  async silent() {
    if (!clientId) return null;
    if (current && current.exp > Date.now() + 60000) return current.token;
    try {
      await loadGis();
      const call = authCall('silent', hintEmail);
      return await request(call.prompt, 15000, call.hint || '');
    } catch (e) {
      return null;
    }
  },
  async getToken(force) {
    if (!force && current && current.exp > Date.now() + 60000) return current.token;
    await loadGis();
    try {
      const call = authCall('silent', hintEmail);
      return await request(call.prompt, force ? 20000 : 15000, call.hint || '');
    } catch (e) {
      if (current && !force) return current.token;
      throw e;
    }
  },
  forgetToken() {
    current = null;
    try { sessionStorage.removeItem('tm.token'); sessionStorage.removeItem('tm.exp'); } catch (e) { /* ignore */ }
  },
  signOut() {
    const token = current && current.token;
    hintEmail = '';
    this.forgetToken();
    if (token && window.google && google.accounts && google.accounts.oauth2 && google.accounts.oauth2.revoke) {
      try { google.accounts.oauth2.revoke(token, function () {}); } catch (e) { /* ignore */ }
    }
  },
  token() { return current ? current.token : ''; }
};
