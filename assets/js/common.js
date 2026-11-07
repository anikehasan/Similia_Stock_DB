const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmtDMY = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Accepts DD/MM/YYYY, YYYY-MM-DD, full ISO strings and Date objects.
function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
const dispDate = v => { const d = parseDate(v); return d ? fmtDMY(d) : esc(v || '—'); };

const Pref = {
  get: (k, d) => { try { return localStorage.getItem('ss_' + k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('ss_' + k, v); } catch { /* storage blocked */ } }
};
function applyTheme() {
  const p = Pref.get('theme', 'system');
  document.documentElement.dataset.theme = p === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : p;
}
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 4500);
}
function confirmDlg(msg) {
  const d = $('#dlg'); $('#dmsg').textContent = msg; d.returnValue = '';
  return new Promise(res => { d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true }); d.showModal(); });
}
