// Only file that talks to the backend. Contracts are identical to the original script.js:
// GET  -> { todaySales,totalProducts,lowStockCount,lowStockDetails[],expiringCount,expiringDetails[],products[],recentTransactions[] }
// POST -> body JSON.stringify({date,productId,productName,category,type,quantity,expiryDate}) -> { result:"success" }
const API = {
  async load() {
    const r = await fetch(CONFIG.APPS_SCRIPT_URL);
    if (!r.ok) throw new Error('Server responded with ' + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  },
  async save(payload) {
    const r = await fetch(CONFIG.APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('Server responded with ' + r.status);
    const j = await r.json();
    if (j.result !== 'success') throw new Error(j.error || 'Backend did not confirm the save');
    return j;
  }
};
