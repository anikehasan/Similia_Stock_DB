'use strict';
const NAV = [['dashboard', 'Dashboard', 'layout-dashboard'], ['inventory', 'Inventory', 'package'], ['sales', 'Sales', 'shopping-cart'],
  ['alerts', 'Stock Alerts', 'bell-ring'], ['expiry', 'Expiry Management', 'calendar-clock'], ['reports', 'Reports', 'bar-chart-3'], ['settings', 'Settings', 'settings']];
const S = { d: null, tx: [], prods: [], low: new Map(), exp: new Map(), loading: true, err: null, busy: false, ch: {},
  inv: { q: '', st: 'all', by: 'name', dir: 1, pg: 1 }, rp: null };
const rowsPer = () => +Pref.get('rows', 10);
const sum = a => a.reduce((x, t) => x + t.qty, 0);
const badge = (l, c) => `<span class="badge ${c}">${esc(l)}</span>`;
const empty = (m, i = 'inbox') => `<div class="empty"><i data-lucide="${i}"></i><p>${m}</p></div>`;

function derive() {
  const d = S.d;
  S.prods = d.products || [];
  S.tx = (d.recentTransactions || []).map(t => ({ ...t, _d: parseDate(t.date), qty: Number(t.quantity) || 0 }));
  S.low = new Map((d.lowStockDetails || []).map(x => [String(x.id), x]));
  S.exp = new Map((d.expiringDetails || []).map(x => [String(x.id), x]));
}
function status(p) {
  const e = S.exp.get(String(p.id));
  if (e && e.daysLeft < 0) return ['Expired', 'bad'];
  if ((+p.stock || 0) === 0) return ['Out of Stock', 'bad'];
  if (e) return ['Expiring Soon', 'warn'];
  if (S.low.has(String(p.id))) return ['Low Stock', 'warn'];
  return ['In Stock', 'ok'];
}
const tbl = (heads, body) => `<div class="tw"><table><thead><tr>${heads.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
function txTable(list) {
  if (!list.length) return empty('No transactions in this period.');
  return tbl(['Date', 'ID', 'Product', 'Type', 'Qty'], list.map(t =>
    `<tr><td>${dispDate(t.date)}</td><td><b>${esc(t.productId)}</b></td><td>${esc(t.productName)}</td><td>${badge(t.type, t.type === 'Buy' ? 'ok' : 'bad')}</td><td>${t.qty}</td></tr>`).join(''));
}
function chart(id, cfg, hasData) {
  const c = $('#' + id); if (!c) return;
  if (S.ch[id]) { S.ch[id].destroy(); delete S.ch[id]; }
  if (!hasData || typeof Chart === 'undefined') { c.parentNode.innerHTML = empty(hasData ? 'Chart library could not load.' : 'No data yet.', 'bar-chart-3'); return; }
  const cs = getComputedStyle(document.documentElement);
  Chart.defaults.color = cs.getPropertyValue('--muted').trim(); Chart.defaults.borderColor = cs.getPropertyValue('--line').trim();
  cfg.options = { responsive: true, maintainAspectRatio: false, ...cfg.options };
  S.ch[id] = new Chart(c, cfg);
}
const PAL = ['#0d9488', '#14b8a6', '#5eead4', '#0ea5e9', '#6366f1', '#f59e0b', '#94a3b8'];

/* ---------------- Views ---------------- */
const V = {};

V.dashboard = {
  t: 'Dashboard',
  html() {
    const d = S.d, qty = S.prods.reduce((a, p) => a + (+p.stock || 0), 0);
    const cards = [['Total Products', d.totalProducts ?? S.prods.length, 'layers', ''], ['Total Stock Quantity', qty, 'boxes', ''],
      ["Today's Sales", d.todaySales || 0, 'trending-up', ''], ['Low Stock Products', d.lowStockCount || 0, 'bell-ring', 'warn'], ['Expiring Products', d.expiringCount || 0, 'calendar-x', 'bad']];
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `<div class="hello"><h2>Welcome back, ${esc(CONFIG.USER.split(' ')[0])}</h2><p>${today}</p></div>
    <div class="stats">${cards.map(([l, v, i, c]) => `<div class="card stat ${c}"><i data-lucide="${i}"></i><div><p>${l}</p><strong>${esc(v)}</strong></div></div>`).join('')}</div>
    <div class="grid2">
      <section class="card"><div class="ch"><h3>Sales overview</h3><select id="rng" class="input sm" aria-label="Range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div><div class="cv"><canvas id="c1"></canvas></div></section>
      <section class="card"><h3>Top selling products (30 days)</h3><div class="cv"><canvas id="c2"></canvas></div></section>
      <section class="card"><h3>Inventory distribution</h3><div class="cv"><canvas id="c3"></canvas></div></section>
      <section class="card"><h3>Recent activity</h3>${txTable(S.tx.slice(-8).reverse())}</section>
    </div>`;
  },
  bind() {
    const sel = $('#rng'); sel.value = Pref.get('range', '7');
    const draw = () => {
      const days = +sel.value, labels = [], sold = [], bought = [], idx = {};
      for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); idx[keyOf(d)] = labels.length; labels.push(`${d.getDate()}/${d.getMonth() + 1}`); sold.push(0); bought.push(0); }
      S.tx.forEach(t => { const i = t._d ? idx[keyOf(t._d)] : undefined; if (i !== undefined) (t.type === 'Sell' ? sold : bought)[i] += t.qty; });
      chart('c1', { type: 'line', data: { labels, datasets: [{ label: 'Sold', data: sold, borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,.12)', fill: true, tension: .3 }, { label: 'Purchased', data: bought, borderColor: '#6366f1', tension: .3 }] } }, sold.some(Boolean) || bought.some(Boolean));
    };
    sel.onchange = draw; draw();
    const from = new Date(); from.setDate(from.getDate() - 29); const fk = keyOf(from), top = {};
    S.tx.forEach(t => { if (t.type === 'Sell' && t._d && keyOf(t._d) >= fk) top[t.productName] = (top[t.productName] || 0) + t.qty; });
    const tp = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6);
    chart('c2', { type: 'bar', data: { labels: tp.map(x => x[0]), datasets: [{ data: tp.map(x => x[1]), backgroundColor: '#0d9488', borderRadius: 6 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } }, tp.length > 0);
    const cat = {}; S.prods.forEach(p => { const c = p.category || 'Uncategorized'; cat[c] = (cat[c] || 0) + (+p.stock || 0); });
    const ce = Object.entries(cat).filter(x => x[1] > 0);
    chart('c3', { type: 'doughnut', data: { labels: ce.map(x => x[0]), datasets: [{ data: ce.map(x => x[1]), backgroundColor: PAL, borderWidth: 0 }] }, options: { plugins: { legend: { position: 'bottom' } } } }, ce.length > 0);
  }
};

function invRows() {
  const f = S.inv, q = f.q.toLowerCase();
  const k = { id: p => String(p.id).toLowerCase(), name: p => String(p.name).toLowerCase(), category: p => String(p.category).toLowerCase(), stock: p => +p.stock || 0 }[f.by];
  return S.prods.filter(p => (!q || `${p.id} ${p.name} ${p.category}`.toLowerCase().includes(q)) && (f.st === 'all' || status(p)[0] === f.st))
    .sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0) * f.dir);
}
function invTable() {
  const all = invRows(), n = rowsPer(), pages = Math.max(1, Math.ceil(all.length / n));
  S.inv.pg = Math.min(S.inv.pg, pages);
  if (!all.length) return empty('No products match your search or filter.', 'search-x');
  const th = (k, l) => `<th scope="col" aria-sort="${S.inv.by === k ? (S.inv.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button class="sort" data-sort="${k}">${l}</button></th>`;
  const body = all.slice((S.inv.pg - 1) * n, S.inv.pg * n).map(p => {
    const [l, c] = status(p), e = S.exp.get(String(p.id));
    return `<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${esc(p.stock)}</td><td>${badge(l, c)}</td><td>${e ? dispDate(e.expDate) : '—'}</td></tr>`;
  }).join('');
  return `<div class="tw"><table><thead><tr>${th('id', 'ID')}${th('name', 'Product')}${th('category', 'Category')}${th('stock', 'Quantity')}<th scope="col">Status</th><th scope="col">Expiry</th></tr></thead><tbody>${body}</tbody></table></div>
  <div class="pager"><span>${all.length} products</span><div><button class="btn" data-pg="-1" ${S.inv.pg <= 1 ? 'disabled' : ''}>Previous</button> <span>Page ${S.inv.pg} of ${pages}</span> <button class="btn" data-pg="1" ${S.inv.pg >= pages ? 'disabled' : ''}>Next</button></div></div>`;
}
V.inventory = {
  t: 'Inventory',
  html() {
    const o = ['all', 'In Stock', 'Low Stock', 'Out of Stock', 'Expiring Soon', 'Expired'].map(s => `<option value="${s}" ${S.inv.st === s ? 'selected' : ''}>${s === 'all' ? 'All statuses' : s}</option>`).join('');
    return `<div class="bar"><input class="input" id="iq" type="search" placeholder="Search by ID, name or category" aria-label="Search inventory" value="${esc(S.inv.q)}"><select class="input" id="ist" aria-label="Filter by status">${o}</select></div>
    <section class="card" id="iw">${invTable()}</section><p class="note">Expiry dates are shown for products the backend reports as expiring within 60 days.</p>`;
  },
  bind() {
    const w = $('#iw'), re = () => { w.innerHTML = invTable(); };
    $('#iq').oninput = e => { S.inv.q = e.target.value; S.inv.pg = 1; re(); };
    $('#ist').onchange = e => { S.inv.st = e.target.value; S.inv.pg = 1; re(); };
    w.onclick = e => {
      const s = e.target.closest('[data-sort]'), p = e.target.closest('[data-pg]');
      if (s) { const k = s.dataset.sort; S.inv.dir = S.inv.by === k ? -S.inv.dir : 1; S.inv.by = k; re(); }
      if (p) { S.inv.pg += +p.dataset.pg; re(); }
    };
  }
};

V.sales = {
  t: 'Sales',
  html() {
    return `<section class="card narrow"><h3>Record transaction</h3><form id="sf" novalidate>
      <div class="seg" role="radiogroup" aria-label="Transaction type"><label><input type="radio" name="ty" value="Sell" checked><span>Sell (out)</span></label><label><input type="radio" name="ty" value="Buy"><span>Buy (in)</span></label></div>
      <label>Product<input class="input" id="sp" list="pl" autocomplete="off" placeholder="Type or pick a product ID" required></label>
      <datalist id="pl">${S.prods.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</datalist>
      <div id="pi" class="info" hidden></div>
      <label>Quantity<input class="input" id="sq" type="number" min="1" step="1" inputmode="numeric" required></label>
      <label id="se" hidden>Expiry date<input class="input" id="sx" type="date"></label>
      <p id="ferr" class="err" role="alert" hidden></p>
      <button class="btn pri" id="sb" type="submit">Save transaction</button></form></section>`;
  },
  bind() {
    const f = $('#sf'), find = v => { v = v.trim().toLowerCase(); return S.prods.find(p => String(p.id).toLowerCase() === v) || S.prods.find(p => String(p.name).toLowerCase() === v); };
    const upd = () => {
      const p = find($('#sp').value), i = $('#pi');
      i.hidden = !p; if (p) i.innerHTML = `${esc(p.name)} · ${esc(p.category)} · Available: <b>${esc(p.stock)}</b>`;
      $('#se').hidden = f.ty.value !== 'Buy';
    };
    $('#sp').oninput = upd; f.querySelectorAll('[name=ty]').forEach(r => r.onchange = upd);
    f.onsubmit = async e => {
      e.preventDefault(); if (S.busy) return;
      const p = find($('#sp').value), q = Number($('#sq').value), t = f.ty.value, x = $('#sx').value, fe = $('#ferr');
      const err = !p ? 'Select a product from the list.' : (!Number.isInteger(q) || q < 1) ? 'Quantity must be a whole number, 1 or more.'
        : (t === 'Sell' && q > (+p.stock || 0)) ? `Only ${+p.stock || 0} in stock. Lower the quantity.` : (t === 'Buy' && !x) ? 'Enter the expiry date for this purchase.' : '';
      fe.hidden = !err; fe.textContent = err; if (err) return;
      if (!await confirmDlg(`${t === 'Sell' ? 'Sell' : 'Buy'} ${q} × ${p.name}?`)) return;
      S.busy = true; const b = $('#sb'); b.disabled = true; b.textContent = 'Saving…';
      try {
        await API.save({ date: fmtDMY(new Date()), productId: p.id, productName: p.name, category: p.category, type: t, quantity: q, expiryDate: t === 'Buy' ? x : '' });
        toast('Transaction saved.', 'ok'); await refresh(true);
      } catch (er) { toast('Not saved: ' + er.message, 'bad'); b.disabled = false; b.textContent = 'Save transaction'; }
      finally { S.busy = false; }
    };
  }
};

V.alerts = {
  t: 'Stock Alerts',
  html() {
    const l = S.prods.filter(p => ['Low Stock', 'Out of Stock'].includes(status(p)[0]));
    return `<section class="card"><h3>Products that need restocking</h3>${l.length ? tbl(['ID', 'Product', 'Quantity', 'Status'],
      l.map(p => { const [s, c] = status(p); return `<tr><td><b>${esc(p.id)}</b></td><td>${esc(p.name)}</td><td>${esc(p.stock)}</td><td>${badge(s, c)}</td></tr>`; }).join('')) : empty('All products have enough stock.', 'check-circle')}</section>`;
  }
};

const risk = d => d < 0 ? ['Expired', 'bad'] : d <= 7 ? ['Critical', 'bad'] : d <= 30 ? ['High', 'warn'] : ['Watch', 'info'];
const expTable = () => {
  const l = [...S.exp.values()].sort((a, b) => a.daysLeft - b.daysLeft);
  return l.length ? tbl(['Product', 'ID', 'Expiry date', 'Days left', 'Quantity', 'Risk'], l.map(x => { const [r, c] = risk(x.daysLeft);
    return `<tr><td>${esc(x.name)}</td><td><b>${esc(x.id)}</b></td><td>${dispDate(x.expDate)}</td><td>${esc(x.daysLeft)}</td><td>${esc(x.stock)}</td><td>${badge(r, c)}</td></tr>`; }).join(''))
    : empty('No products expire in the next 60 days.', 'check-circle');
};
V.expiry = { t: 'Expiry Management', html: () => `<section class="card"><h3>Expiring in the next 60 days</h3>${expTable()}</section><p class="note">Risk: Critical is 7 days or fewer, High is 30 days or fewer.</p>` };

const sevenAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return keyOf(d); };
function repData() {
  const { from, to } = S.rp, L = S.tx.filter(t => t._d && keyOf(t._d) >= from && keyOf(t._d) <= to);
  return { L, sold: L.filter(t => t.type === 'Sell'), bought: L.filter(t => t.type === 'Buy') };
}
function repHtml() {
  const { L, sold, bought } = repData(), g = S.rp.grp, pm = {}, per = {};
  L.forEach(t => { const o = pm[t.productId] ||= { n: t.productName, s: 0, b: 0 }; t.type === 'Sell' ? o.s += t.qty : o.b += t.qty; });
  const gk = d => { if (g === 'month') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; if (g === 'week') { const w = new Date(d); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); return 'Week of ' + keyOf(w); } return keyOf(d); };
  L.forEach(t => { const o = per[gk(t._d)] ||= { s: 0, b: 0 }; t.type === 'Sell' ? o.s += t.qty : o.b += t.qty; });
  const qty = S.prods.reduce((a, p) => a + (+p.stock || 0), 0);
  return `<div class="stats three"><div class="card stat"><i data-lucide="shopping-bag"></i><div><p>Total purchased</p><strong>${sum(bought)}</strong></div></div>
    <div class="card stat"><i data-lucide="tags"></i><div><p>Total sold</p><strong>${sum(sold)}</strong></div></div>
    <div class="card stat"><i data-lucide="scale"></i><div><p>Net flow</p><strong>${sum(bought) - sum(sold)}</strong></div></div></div>
  <section class="card"><h3>Summary by ${g}</h3>${Object.keys(per).length ? tbl(['Period', 'Sold', 'Purchased'], Object.entries(per).sort().map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.s}</td><td>${v.b}</td></tr>`).join('')) : empty('No transactions in this period.')}</section>
  <section class="card"><h3>Product-wise sales</h3>${Object.keys(pm).length ? tbl(['ID', 'Product', 'Sold', 'Purchased'], Object.entries(pm).sort((a, b) => b[1].s - a[1].s).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v.n)}</td><td>${v.s}</td><td>${v.b}</td></tr>`).join('')) : empty('No transactions in this period.')}</section>
  <section class="card"><h3>Stock summary</h3><p>${S.prods.length} products · ${qty} units in stock · ${S.d.lowStockCount || 0} low stock · ${S.prods.filter(p => !(+p.stock)).length} out of stock</p></section>
  <section class="card"><h3>Expiry report</h3>${expTable()}</section>
  <section class="card"><h3>Transactions</h3>${txTable(L)}</section>`;
}
V.reports = {
  t: 'Reports',
  html() {
    S.rp ||= { from: sevenAgo(29), to: keyOf(new Date()), grp: 'day' };
    const r = S.rp;
    return `<div class="bar noprint"><input class="input" type="date" id="rf" value="${r.from}" aria-label="From date"><span>to</span><input class="input" type="date" id="rt" value="${r.to}" aria-label="To date">
      <select class="input" id="rg" aria-label="Group by"><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select>
      <button class="btn" data-p="0">Today</button><button class="btn" data-p="6">7 days</button><button class="btn" data-p="29">30 days</button>
      <span class="grow"></span><button class="btn" id="csv"><i data-lucide="download"></i>CSV</button><button class="btn pri" id="prt"><i data-lucide="printer"></i>Print / PDF</button></div>
    <p class="pr-only">Similia Stock report: ${r.from} to ${r.to}</p><div id="rr">${repHtml()}</div>`;
  },
  bind() {
    const re = () => { $('#rr').innerHTML = repHtml(); window.lucide && lucide.createIcons(); };
    $('#rg').value = S.rp.grp;
    $('#rf').onchange = e => { S.rp.from = e.target.value; re(); };
    $('#rt').onchange = e => { S.rp.to = e.target.value; re(); };
    $('#rg').onchange = e => { S.rp.grp = e.target.value; re(); };
    document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { S.rp.from = sevenAgo(+b.dataset.p); S.rp.to = keyOf(new Date()); $('#rf').value = S.rp.from; $('#rt').value = S.rp.to; re(); });
    $('#prt').onclick = () => window.print();
    $('#csv').onclick = () => {
      const c = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
      const out = ['Date,Product ID,Product,Type,Quantity', ...repData().L.map(t => [fmtDMY(t._d), t.productId, t.productName, t.type, t.qty].map(c).join(','))].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + out], { type: 'text/csv' }));
      a.download = `similia-stock-${S.rp.from}_to_${S.rp.to}.csv`; a.click(); URL.revokeObjectURL(a.href);
    };
  }
};

V.settings = {
  t: 'Settings',
  html() {
    const th = Pref.get('theme', 'system'), r = Pref.get('rows', '10'), rg = Pref.get('range', '7');
    const rad = (v, l) => `<label><input type="radio" name="th" value="${v}" ${th === v ? 'checked' : ''}><span>${l}</span></label>`;
    const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
    return `<section class="card narrow"><h3>Appearance</h3><div class="seg" role="radiogroup" aria-label="Theme">${rad('system', 'System')}${rad('light', 'Light')}${rad('dark', 'Dark')}</div>
      <h3>Preferences</h3><label>Table rows per page<select class="input" id="srow">${opt('10', '10', r)}${opt('25', '25', r)}${opt('50', '50', r)}</select></label>
      <label>Default dashboard range<select class="input" id="srg">${opt('7', 'Last 7 days', rg)}${opt('30', 'Last 30 days', rg)}</select></label>
      <h3>Profile</h3><p>${esc(CONFIG.USER)}</p><p class="note">Preferences are saved in this browser only. Business data always comes from your Google Sheet.</p></section>`;
  },
  bind() {
    document.querySelectorAll('[name=th]').forEach(r => r.onchange = () => { Pref.set('theme', r.value); applyTheme(); toast('Theme updated.'); });
    $('#srow').onchange = e => { Pref.set('rows', e.target.value); toast('Preference saved.'); };
    $('#srg').onchange = e => { Pref.set('range', e.target.value); toast('Preference saved.'); };
  }
};

/* ---------------- Router & boot ---------------- */
function route() {
  Object.values(S.ch).forEach(c => c.destroy()); S.ch = {};
  const n = location.hash.slice(1).split('?')[0], k = V[n] ? n : 'dashboard', v = V[k], m = $('#view');
  $('#title').textContent = v.t; document.title = v.t + ' · Similia Stock';
  document.querySelectorAll('#nav a').forEach(a => a.getAttribute('href') === '#' + k ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (S.loading) m.innerHTML = `<div class="stats">${'<div class="card sk"></div>'.repeat(5)}</div><div class="grid2">${'<div class="card sk big"></div>'.repeat(4)}</div>`;
  else if (S.err && !S.d) m.innerHTML = `<section class="card">${empty('Could not load data: ' + esc(S.err) + '. Check your connection and the Apps Script access setting.', 'wifi-off')}<p class="center"><button class="btn pri" id="retry">Try again</button></p></section>`;
  else { m.innerHTML = v.html(); v.bind && v.bind(); }
  const bc = $('#bc'), cnt = S.d ? (S.d.lowStockCount || 0) + (S.d.expiringCount || 0) : 0; bc.hidden = !cnt; bc.textContent = cnt;
  const rt = $('#retry'); if (rt) rt.onclick = () => refresh();
  window.lucide && lucide.createIcons();
}
async function refresh(silent) {
  if (!silent) { S.loading = true; route(); }
  try { S.d = await API.load(); derive(); S.err = null; }
  catch (e) { S.err = e.message || 'Unknown error'; if (silent) toast('Saved, but the data could not be refreshed: ' + S.err, 'warn'); }
  S.loading = false; route();
}
applyTheme(); matchMedia('(prefers-color-scheme:dark)').addEventListener('change', applyTheme);
$('#nav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}"><i data-lucide="${i}"></i><span>${l}</span></a>`).join('');
$('#uname').textContent = CONFIG.USER;
const app = $('#app'), mob = () => matchMedia('(max-width:900px)').matches;
if (Pref.get('collapsed', '0') === '1') app.classList.add('collapsed');
$('#menu').onclick = () => { if (mob()) app.classList.toggle('open'); else { app.classList.toggle('collapsed'); Pref.set('collapsed', app.classList.contains('collapsed') ? '1' : '0'); } };
$('#scrim').onclick = () => app.classList.remove('open');
$('#nav').onclick = () => app.classList.remove('open');
document.addEventListener('keydown', e => { if (e.key === 'Escape') app.classList.remove('open'); });
$('#gs').onkeydown = e => { if (e.key === 'Enter') { S.inv.q = e.target.value; S.inv.pg = 1; e.target.value = ''; location.hash === '#inventory' ? route() : location.hash = 'inventory'; } };
window.onhashchange = route;
refresh();
