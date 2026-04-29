// ─────────────────────────────────────────────────────────────────────────────
// statistics.js — ServiCell Belize Statistics Page (Manager only)
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyLNGR6L75MieV_R-s9yyjTfzpAAut_HIwhbZBBNyPxj9WDzRLNWics0FZ1ZayI3imx/exec';

// ── Utilities ─────────────────────────────────────────────────────────────────
function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }
function escH(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
function tryParseJSON(str, fb) { try { return JSON.parse(str); } catch(_) { return fb; } }

function setSyncState(state, text) {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    if (dot) dot.className = 'sync-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
    if (txt) txt.textContent = text;
}

// ── Date Range ────────────────────────────────────────────────────────────────
let _range = 'month';

function setRange(r) {
    _range = r;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    const map = { today: 0, week: 1, month: 2, custom: 3 };
    document.querySelectorAll('.range-btn')[map[r]]?.classList.add('active');
    document.getElementById('customRange').style.display = r === 'custom' ? 'flex' : 'none';
    if (r !== 'custom') loadStats();
}

function getDateRange() {
    const now = new Date();
    let from, to;
    to = now.toISOString().slice(0, 10);
    if (_range === 'today') {
        from = to;
    } else if (_range === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        from = d.toISOString().slice(0, 10);
    } else if (_range === 'month') {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else {
        from = document.getElementById('dateFrom').value || to;
        to   = document.getElementById('dateTo').value   || to;
    }
    return { from, to };
}

// ── Load All Data ─────────────────────────────────────────────────────────────
async function loadStats() {
    setSyncState('loading', 'Loading statistics…');
    const { from, to } = getDateRange();

    const [salesAllData, salesData, payoutsData, jobsData, invData, movData, closesData, billsData, custData] = await Promise.all([
        // All sales (including reversed) for reversal rate
        fetch(SCRIPT_URL + '?action=listsales&from=' + from + '&to=' + to).then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listsales&from=' + from + '&to=' + to).then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listpayouts&from=' + from + '&to=' + to).then(r => r.json()).catch(() => ({})),
        // Jobs: pass date range so GAS can filter when we add that support
        fetch(SCRIPT_URL + '?action=list').then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listinventory').then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listmovements&limit=1000').then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listdaycloses&from=' + from + '&to=' + to).then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listbills').then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listcustomers').then(r => r.json()).catch(() => ({}))
    ]);

    const allSalesRaw = salesAllData.sales || [];
    const sales   = allSalesRaw.filter(s => s.status !== 'reversed');
    const reversed = allSalesRaw.filter(s => s.status === 'reversed');
    const payouts = payoutsData.payouts || [];
    // Filter jobs by date range client-side (dateReceived within range)
    const allJobs = jobsData.jobs || [];
    const jobs    = allJobs.filter(j => {
        if (!j.dateReceived) return true;
        const d = j.dateReceived.slice(0, 10);
        return d >= from && d <= to;
    });
    const inv     = invData.items       || [];
    const movs    = movData.movements   || [];
    const closes  = closesData.closes   || [];
    const bills   = billsData.bills     || [];

    // Cache customers for lookup
    window._allCustomers = custData.customers || [];
    window._allJobs      = allJobs;
    window._allSales     = allSalesRaw;

    renderKPIs(sales, reversed, payouts, jobs, bills);
    renderRevenueChart(sales, from, to);
    renderPaymentMethods(sales);
    renderJobStatus(jobs);
    renderTopItems(sales, movs);
    renderInvHealth(inv);
    renderCashierPerf(sales, payouts, closes);
    renderTechPerf(jobs, from, to);
    renderShortHistory(closes);

    setSyncState('ok', 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs(sales, reversed, payouts, jobs, bills) {
    const gross    = sales.reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const pTotal   = payouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const net      = gross - pTotal;
    const completed = jobs.filter(j => ['resolved','ready'].includes((j.status||'').toLowerCase()));
    // Filter sales that have a valid jobId (not empty string)
    const jobSales = sales.filter(s => s.jobId && String(s.jobId).trim() !== '');
    const avgRepair = jobSales.length
        ? jobSales.reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0) / jobSales.length
        : 0;
    const openBills = bills.filter(b => b.status === 'open');
    const billsOwed = openBills.reduce((t, b) => t + Math.max(0, (parseFloat(b.totalOwed)||0) - (parseFloat(b.totalPaid)||0)), 0);
    const totalTx   = sales.length + reversed.length;
    const revRate   = totalTx > 0 ? Math.round((reversed.length / totalTx) * 100) : 0;

    document.getElementById('kpiRevenue').textContent    = bz(gross);
    document.getElementById('kpiRevenueSub').textContent = sales.length + ' transactions';
    document.getElementById('kpiPayouts').textContent    = bz(pTotal);
    document.getElementById('kpiPayoutsSub').textContent = payouts.length + ' payouts';
    document.getElementById('kpiNet').textContent        = bz(net);
    document.getElementById('kpiNetSub').textContent     = net >= 0 ? 'Positive' : 'Negative';
    document.getElementById('kpiJobs').textContent       = completed.length;
    document.getElementById('kpiJobsSub').textContent    = jobs.length + ' total in period';
    document.getElementById('kpiAvgRepair').textContent  = bz(avgRepair);
    document.getElementById('kpiBills').textContent      = bz(billsOwed);
    document.getElementById('kpiBillsSub').textContent   = openBills.length + ' open bills';
    document.getElementById('kpiReversals').textContent  = revRate + '%';
    document.getElementById('kpiReversalsSub').textContent = reversed.length + ' of ' + totalTx + ' reversed';
}

// ── Revenue by Day Chart ──────────────────────────────────────────────────────
function renderRevenueChart(sales, from, to) {
    const el = document.getElementById('revenueChart');
    // Build day buckets
    const days = {};
    const start = new Date(from), end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days[d.toISOString().slice(0, 10)] = 0;
    }
    sales.forEach(s => {
        const day = (s.shiftDate || (s.timestamp || '').slice(0, 10));
        if (days[day] !== undefined) days[day] += parseFloat(s.amountPaid) || 0;
    });
    const entries = Object.entries(days);
    if (!entries.length) { el.innerHTML = '<div class="empty-state">No sales in this period.</div>'; return; }
    const max = Math.max(...entries.map(e => e[1]), 1);
    el.innerHTML = entries.map(([day, val]) => {
        const pct  = Math.round((val / max) * 100);
        const lbl  = new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return '<div class="bar-wrap" title="' + lbl + ': ' + bz(val) + '">'
            + '<div class="bar" style="height:' + Math.max(pct, 2) + '%;background:' + (val > 0 ? 'var(--primary)' : 'var(--glass-border)') + ';"></div>'
            + '<div class="bar-label">' + escH(lbl) + '</div>'
            + '</div>';
    }).join('');
}

// ── Payment Methods ───────────────────────────────────────────────────────────
function renderPaymentMethods(sales) {
    const el = document.getElementById('paymentMethods');
    if (!sales.length) { el.innerHTML = '<div class="empty-state">No sales data.</div>'; return; }
    const counts = {};
    sales.forEach(s => { const m = s.method || 'cash'; counts[m] = (counts[m] || 0) + 1; });
    const total = sales.length;
    const colors = { cash: 'green', card: '', partial: 'yellow' };
    el.innerHTML = Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([m, c]) => {
        const pct = Math.round((c / total) * 100);
        return '<div class="progress-row">'
            + '<div class="progress-label"><span>' + escH(m.charAt(0).toUpperCase() + m.slice(1)) + '</span><span>' + c + ' (' + pct + '%)</span></div>'
            + '<div class="progress-track"><div class="progress-fill ' + (colors[m]||'') + '" style="width:' + pct + '%;"></div></div>'
            + '</div>';
    }).join('');
}

// ── Job Status ────────────────────────────────────────────────────────────────
function renderJobStatus(jobs) {
    const el = document.getElementById('jobStatus');
    if (!jobs.length) { el.innerHTML = '<div class="empty-state">No jobs data.</div>'; return; }
    const counts = {};
    jobs.forEach(j => { const s = (j.status||'received').toLowerCase(); counts[s] = (counts[s]||0) + 1; });
    const total = jobs.length;
    const colors = { resolved:'green', ready:'green', fixing:'yellow', testing:'yellow', received:'', abandoned:'red', unsuccessful:'red' };
    el.innerHTML = Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([s, c]) => {
        const pct = Math.round((c / total) * 100);
        return '<div class="progress-row">'
            + '<div class="progress-label"><span>' + escH(s.charAt(0).toUpperCase() + s.slice(1)) + '</span><span>' + c + ' (' + pct + '%)</span></div>'
            + '<div class="progress-track"><div class="progress-fill ' + (colors[s]||'') + '" style="width:' + pct + '%;"></div></div>'
            + '</div>';
    }).join('');
}

// ── Top Selling Items ─────────────────────────────────────────────────────────
function renderTopItems(sales, movs) {
    const el = document.getElementById('topItems');
    // Count item names from sales line items
    const counts = {};
    sales.forEach(s => {
        const items = tryParseJSON(s.items, []);
        items.forEach(i => {
            if (!i.name) return;
            counts[i.name] = (counts[i.name] || 0) + (i.qty || 1);
        });
    });
    const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 8);
    if (!sorted.length) { el.innerHTML = '<div class="empty-state">No sales data.</div>'; return; }
    const max = sorted[0][1];
    el.innerHTML = sorted.map(([name, qty]) => {
        const pct = Math.round((qty / max) * 100);
        return '<div class="progress-row">'
            + '<div class="progress-label"><span>' + escH(name) + '</span><span>' + qty + ' sold</span></div>'
            + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>'
            + '</div>';
    }).join('');
}

// ── Inventory Health ──────────────────────────────────────────────────────────
function renderInvHealth(inv) {
    const el = document.getElementById('invHealth');
    if (!inv.length) { el.innerHTML = '<div class="empty-state">No inventory data.</div>'; return; }
    const totalValue = inv.reduce((t, i) => t + (i.qty * i.costPrice), 0);
    const outOfStock = inv.filter(i => i.qty <= 0);
    const lowStock   = inv.filter(i => i.qty > 0 && i.qty <= i.minQty);
    const critical   = [...outOfStock, ...lowStock].slice(0, 6);
    let html = '<div class="stat-row"><span class="stat-row-label">Total Inventory Value</span><span class="stat-row-val green">' + bz(totalValue) + '</span></div>'
        + '<div class="stat-row"><span class="stat-row-label">Out of Stock</span><span class="stat-row-val red">' + outOfStock.length + ' items</span></div>'
        + '<div class="stat-row" style="border-bottom:none;"><span class="stat-row-label">Low Stock</span><span class="stat-row-val yellow">' + lowStock.length + ' items</span></div>';
    if (critical.length) {
        html += '<div style="margin-top:12px;border-top:1px solid var(--glass-border);padding-top:10px;">';
        html += critical.map(i => {
            const isOut = i.qty <= 0;
            return '<div class="inv-item">'
                + '<div class="inv-dot ' + (isOut ? 'red' : 'yellow') + '"></div>'
                + '<span class="inv-name">' + escH(i.name) + '</span>'
                + '<span class="inv-qty" style="color:' + (isOut ? 'var(--danger)' : 'var(--warning)') + ';">' + i.qty + ' left</span>'
                + '</div>';
        }).join('');
        html += '</div>';
    }
    el.innerHTML = html;
}

// ── Cashier Performance ───────────────────────────────────────────────────────
function renderCashierPerf(sales, payouts, closes) {
    const el = document.getElementById('cashierPerf');
    const cashiers = {};
    sales.forEach(s => {
        const c = s.cashier || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0, reversals: 0, payouts: 0, shorts: 0 };
        cashiers[c].sales++;
        cashiers[c].revenue += parseFloat(s.amountPaid) || 0;
    });
    // Count reversals from all sales (including reversed ones passed separately if needed)
    payouts.forEach(p => {
        const c = p.loggedBy || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0, reversals: 0, payouts: 0, shorts: 0 };
        cashiers[c].payouts += parseFloat(p.amount) || 0;
    });
    closes.forEach(c => {
        if ((parseFloat(c.variance) || 0) < -0.01) {
            const who = c.closedBy || 'Unknown';
            if (!cashiers[who]) cashiers[who] = { sales: 0, revenue: 0, reversals: 0, payouts: 0, shorts: 0 };
            cashiers[who].shorts++;
        }
    });
    const sorted = Object.entries(cashiers).sort((a,b) => b[1].revenue - a[1].revenue);
    if (!sorted.length) { el.innerHTML = '<div class="empty-state">No cashier data.</div>'; return; }
    el.innerHTML = sorted.map(([name, d]) =>
        '<div class="person-row">'
        + '<div class="person-avatar">&#x1F4B5;</div>'
        + '<div><div class="person-name">' + escH(name) + '</div>'
        + '<div class="person-meta">' + d.sales + ' sales &bull; ' + bz(d.payouts) + ' payouts' + (d.shorts ? ' &bull; <span style="color:var(--danger);">' + d.shorts + ' short</span>' : '') + '</div></div>'
        + '<div class="person-stats"><div class="person-stat-main">' + bz(d.revenue) + '</div><div class="person-stat-sub">gross</div></div>'
        + '</div>'
    ).join('');
}

// ── Technician Performance ────────────────────────────────────────────────────
function renderTechPerf(jobs, from, to) {
    const el = document.getElementById('techPerf');
    const techs = {};

    // Build a jobId → claimedBy map for revenue attribution
    const jobClaimMap = {};
    jobs.forEach(j => { if (j.claimedBy && j.id) jobClaimMap[String(j.id)] = j.claimedBy; });

    // Pull sales from cache and attribute revenue to the technician who claimed the job
    const allSales = (window._allSales || []).filter(s => s.status !== 'reversed');
    const techRevenue = {};
    allSales.forEach(s => {
        // Check for valid jobId (not empty string)
        if (!s.jobId || String(s.jobId).trim() === '') return;
        const claimer = jobClaimMap[String(s.jobId)];
        if (!claimer) return;
        techRevenue[claimer] = (techRevenue[claimer] || 0) + (parseFloat(s.amountPaid) || 0);
    });

    jobs.forEach(j => {
        const t = j.claimedBy || ((['resolved','ready'].includes((j.status||'').toLowerCase())) ? (j.technician || 'Unassigned') : 'Unassigned');
        if (!techs[t]) techs[t] = { assigned: 0, completed: 0, stale: 0, unclaimed: 0, totalMs: 0, countMs: 0 };
        techs[t].assigned++;
        const status = (j.status || '').toLowerCase();
        if (['resolved','ready'].includes(status)) {
            techs[t].completed++;
            if (j.dateReceived && j.dateCompleted) {
                const ms = new Date(j.dateCompleted).getTime() - new Date(j.dateReceived).getTime();
                if (ms > 0) { techs[t].totalMs += ms; techs[t].countMs++; }
            }
        }
        const STALE = 3 * 24 * 60 * 60 * 1000;
        const skip  = ['abandoned','unsuccessful','resolved','ready'];
        if (!skip.includes(status)) {
            const last = Math.max(
                j.dateReceived  ? new Date(j.dateReceived).getTime()  : 0,
                j.dateCompleted ? new Date(j.dateCompleted).getTime() : 0
            );
            if (last && (Date.now() - last) > STALE) {
                techs[t].stale++;
                if (!j.claimedBy && status === 'received') techs[t].unclaimed++;
            }
        }
    });

    const sorted = Object.entries(techs).sort((a,b) => b[1].completed - a[1].completed);
    if (!sorted.length) { el.innerHTML = '<div class="empty-state">No technician data.</div>'; return; }

    // Find top values for bonus highlighting — only award if there's a clear single winner
    const maxCompleted = Math.max(...sorted.map(([,d]) => d.completed));
    const maxRevenue   = Math.max(...sorted.map(([name]) => techRevenue[name] || 0));
    const completedWinners = sorted.filter(([name, d]) => !name.includes('Unassigned') && d.completed === maxCompleted && maxCompleted > 0);
    const revenueWinners   = sorted.filter(([name])    => !name.includes('Unassigned') && (techRevenue[name] || 0) === maxRevenue && maxRevenue > 0);
    const soloJobsWinner   = completedWinners.length === 1 ? completedWinners[0][0] : null;
    const soloRevWinner    = revenueWinners.length   === 1 ? revenueWinners[0][0]   : null;

    el.innerHTML = sorted.map(([name, d]) => {
        const avgDays    = d.countMs ? (d.totalMs / d.countMs / 86400000).toFixed(1) : '—';
        const revenue    = techRevenue[name] || 0;
        const isUnassigned = name === 'Unassigned';
        const topJobs    = name === soloJobsWinner;
        const topRev     = name === soloRevWinner;
        return '<div class="person-row">'
            + '<div class="person-avatar">' + (isUnassigned ? '❓' : '&#x1F527;') + '</div>'
            + '<div style="flex:1;min-width:0;">'
            +   '<div class="person-name">' + escH(name)
            +     (topJobs ? ' <span style="font-size:0.65rem;background:rgba(16,185,129,0.15);color:var(--success);padding:2px 7px;border-radius:99px;font-weight:800;">🏆 Most Jobs</span>' : '')
            +     (topRev  ? ' <span style="font-size:0.65rem;background:rgba(37,99,235,0.15);color:var(--primary);padding:2px 7px;border-radius:99px;font-weight:800;">💰 Top Revenue</span>' : '')
            +   '</div>'
            +   '<div class="person-meta">' + d.assigned + (isUnassigned ? ' unassigned' : ' assigned') + ' &bull; avg ' + avgDays + ' days'
            +     (d.stale    ? ' &bull; <span style="color:var(--warning);">' + d.stale + ' stale</span>' : '')
            +     (d.unclaimed ? ' &bull; <span style="color:var(--danger);">' + d.unclaimed + ' unclaimed</span>' : '')
            +   '</div>'
            + '</div>'
            + '<div style="display:flex;gap:16px;flex-shrink:0;text-align:right;">'
            +   '<div class="person-stats"><div class="person-stat-main">' + d.completed + '</div><div class="person-stat-sub">completed</div></div>'
            +   (revenue > 0 ? '<div class="person-stats"><div class="person-stat-main" style="font-size:0.95rem;color:var(--success);">' + bz(revenue) + '</div><div class="person-stat-sub">revenue</div></div>' : '')
            + '</div>'
            + '</div>';
    }).join('');
}

// ── Short Cashier History ─────────────────────────────────────────────────────
function renderShortHistory(closes) {
    const el = document.getElementById('shortHistory');
    const shorts = closes.filter(c => (parseFloat(c.variance) || 0) < -0.01)
        .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (!shorts.length) {
        el.innerHTML = '<div class="empty-state" style="color:var(--success);">&#x2713; No short closes in this period.</div>';
        return;
    }
    el.innerHTML = shorts.map(c => {
        const ts  = c.timestamp ? new Date(c.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        const variance = parseFloat(c.variance) || 0;
        return '<div class="stat-row">'
            + '<div><div style="font-size:0.85rem;font-weight:700;">' + escH(c.closedBy || 'Unknown') + '</div>'
            + '<div style="font-size:0.72rem;color:var(--text-dim);">' + escH(ts) + ' &bull; ' + escH(c.shift || '') + '</div></div>'
            + '<span class="stat-row-val red">' + bz(Math.abs(variance)) + ' short</span>'
            + '</div>';
    }).join('');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    // Set default custom date range to this month
    const now   = new Date();
    const from  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to    = now.toISOString().slice(0, 10);
    document.getElementById('dateFrom').value = from;
    document.getElementById('dateTo').value   = to;
    loadStats();
});

window.addEventListener('sc-back-online', loadStats);

// ── Customer Lookup ───────────────────────────────────────────────────────────
function searchCustomers() {
    const q  = (document.getElementById('customerSearch').value || '').trim().toLowerCase();
    const el = document.getElementById('customerResults');
    if (!q) { el.innerHTML = ''; return; }
    const customers = window._allCustomers || [];
    const matches = customers.filter(c =>
        (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 10);
    if (!matches.length) { el.innerHTML = '<div class="empty-state">No customers found.</div>'; return; }
    const allJobs  = window._allJobs  || [];
    const allSales = window._allSales || [];
    el.innerHTML = matches.map(c => {
        const cJobs  = allJobs.filter(j => (j.customerName||'').toLowerCase() === (c.name||'').toLowerCase());
        const cSales = allSales.filter(s => (s.customer||'').toLowerCase() === (c.name||'').toLowerCase());
        const spent  = cSales.filter(s => s.status !== 'reversed').reduce((t, s) => t + (parseFloat(s.amountPaid)||0), 0);
        const lastSeen = c.lastSeen ? new Date(c.lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        return '<div class="person-row">'
            + '<div class="person-avatar">&#x1F464;</div>'
            + '<div><div class="person-name">' + escH(c.name || '—') + '</div>'
            + '<div class="person-meta">' + escH(c.phone || 'No phone') + ' &bull; Last seen: ' + escH(lastSeen) + '</div></div>'
            + '<div class="person-stats"><div class="person-stat-main">' + bz(spent) + '</div>'
            + '<div class="person-stat-sub">' + cJobs.length + ' jobs &bull; ' + cSales.length + ' sales</div></div>'
            + '</div>';
    }).join('');
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
    const { from, to } = getDateRange();
    const sales = window._allSales || [];
    if (!sales.length) { alert('No sales data to export.'); return; }
    const rows = [['SaleID','Date','Shift','Cashier','Items','Total','Method','AmountPaid','JobID','Status']];
    sales.forEach(s => {
        const items = tryParseJSON(s.items, []).map(i => i.name + ' x' + i.qty).join('; ');
        rows.push([s.saleId, s.shiftDate, s.shift, s.cashier, items, s.total, s.method, s.amountPaid, s.jobId || '', s.status]);
    });
    const csv  = rows.map(r => r.map(v => '"' + String(v||'').replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ServiCell_Sales_' + from + '_to_' + to + '.csv';
    a.click(); URL.revokeObjectURL(url);
}

// ── Print Report (PDF) ────────────────────────────────────────────────────────
function exportPDF() {
    const { from, to } = getDateRange();
    const allS      = window._allSales || [];
    const allJobs   = window._allJobs  || [];
    const sales     = allS.filter(s => s.status !== 'reversed');
    const reversed  = allS.filter(s => s.status === 'reversed');
    const gross     = sales.reduce((t, s) => t + (parseFloat(s.amountPaid)||0), 0);
    const totalTx   = sales.length + reversed.length;
    const revRate   = totalTx > 0 ? Math.round((reversed.length / totalTx) * 100) : 0;

    // Jobs in period
    const jobs = allJobs.filter(j => {
        if (!j.dateReceived) return true;
        const d = j.dateReceived.slice(0, 10);
        return d >= from && d <= to;
    });
    const completedJobs = jobs.filter(j => ['resolved','ready'].includes((j.status||'').toLowerCase()));

    // Top items
    const itemCounts = {};
    sales.forEach(s => { tryParseJSON(s.items, []).forEach(i => { if (i.name) itemCounts[i.name] = (itemCounts[i.name]||0) + (i.qty||1); }); });
    const topItems = Object.entries(itemCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);

    // Technician performance
    const jobClaimMap = {};
    jobs.forEach(j => { if (j.claimedBy && j.id) jobClaimMap[String(j.id)] = j.claimedBy; });
    const techRevenue = {};
    sales.forEach(s => {
        // Check for valid jobId (not empty string)
        if (!s.jobId || String(s.jobId).trim() === '') return;
        const claimer = jobClaimMap[String(s.jobId)];
        if (!claimer) return;
        techRevenue[claimer] = (techRevenue[claimer] || 0) + (parseFloat(s.amountPaid)||0);
    });
    const techs = {};
    jobs.forEach(j => {
        const t = j.claimedBy || ((['resolved','ready'].includes((j.status||'').toLowerCase())) ? (j.technician || 'Unassigned') : 'Unassigned');
        if (!techs[t]) techs[t] = { completed: 0, assigned: 0 };
        techs[t].assigned++;
        if (['resolved','ready'].includes((j.status||'').toLowerCase())) techs[t].completed++;
    });
    const techSorted = Object.entries(techs).sort((a,b) => b[1].completed - a[1].completed);
    const maxCompleted = Math.max(...techSorted.map(([,d]) => d.completed), 0);
    const maxRevenue   = Math.max(...techSorted.map(([n]) => techRevenue[n]||0), 0);
    const soloJobsWinner = techSorted.filter(([n,d]) => n !== 'Unassigned' && d.completed === maxCompleted && maxCompleted > 0).length === 1
        ? techSorted.find(([n,d]) => n !== 'Unassigned' && d.completed === maxCompleted)[0] : null;
    const soloRevWinner  = techSorted.filter(([n]) => n !== 'Unassigned' && (techRevenue[n]||0) === maxRevenue && maxRevenue > 0).length === 1
        ? techSorted.find(([n]) => n !== 'Unassigned' && (techRevenue[n]||0) === maxRevenue)[0] : null;

    // Cashier performance
    const cashiers = {};
    sales.forEach(s => {
        const c = s.cashier || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0 };
        cashiers[c].sales++;
        cashiers[c].revenue += parseFloat(s.amountPaid)||0;
    });
    const cashierSorted = Object.entries(cashiers).sort((a,b) => b[1].revenue - a[1].revenue);

    // Job status breakdown
    const statusCounts = {};
    jobs.forEach(j => { const s = (j.status||'received').toLowerCase(); statusCounts[s] = (statusCounts[s]||0) + 1; });

    // ── HTML ──
    const css = `
        body{font-family:Arial,sans-serif;padding:28px 32px;max-width:760px;margin:0 auto;color:#1a1a1a;font-size:13px;}
        h1{font-size:1.5rem;font-weight:800;margin:0 0 2px;}
        .sub{color:#64748b;font-size:0.82rem;margin-bottom:6px;}
        .meta{color:#64748b;font-size:0.78rem;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;}
        h2{font-size:0.72rem;text-transform:uppercase;letter-spacing:1.5px;color:#2563eb;margin:22px 0 8px;font-weight:800;}
        .kpi-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px;}
        .kpi{flex:1;min-width:100px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;}
        .kpi-label{font-size:0.6rem;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px;}
        .kpi-val{font-size:1.25rem;font-weight:800;color:#1a1a1a;}
        table{width:100%;border-collapse:collapse;margin-bottom:4px;}
        th{text-align:left;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;padding:6px 8px;border-bottom:2px solid #e2e8f0;background:#f8fafc;}
        td{padding:7px 8px;border-bottom:1px solid #f1f5f9;font-size:0.85rem;vertical-align:middle;}
        tr:last-child td{border-bottom:none;}
        .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:0.65rem;font-weight:700;margin-left:6px;}
        .badge-jobs{background:#dcfce7;color:#166534;}
        .badge-rev{background:#dbeafe;color:#1e40af;}
        .right{text-align:right;}
        .footer{margin-top:28px;font-size:0.72rem;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;}
        @media print{@page{margin:15mm 18mm;}}
    `;

    const itemRows = topItems.map(([n,q]) =>
        '<tr><td>' + escH(n) + '</td><td class="right">' + q + '</td></tr>'
    ).join('') || '<tr><td colspan="2" style="color:#94a3b8;">No data</td></tr>';

    const techRows = techSorted.map(([name, d]) => {
        const rev = techRevenue[name] || 0;
        const badges = (name === soloJobsWinner ? '<span class="badge badge-jobs">🏆 Most Jobs</span>' : '')
                     + (name === soloRevWinner  ? '<span class="badge badge-rev">💰 Top Revenue</span>' : '');
        return '<tr><td>' + escH(name) + badges + '</td>'
            + '<td class="right">' + d.assigned + '</td>'
            + '<td class="right">' + d.completed + '</td>'
            + '<td class="right">' + (rev > 0 ? bz(rev) : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:#94a3b8;">No data</td></tr>';

    const cashierRows = cashierSorted.map(([name, d]) =>
        '<tr><td>' + escH(name) + '</td><td class="right">' + d.sales + '</td><td class="right">' + bz(d.revenue) + '</td></tr>'
    ).join('') || '<tr><td colspan="3" style="color:#94a3b8;">No data</td></tr>';

    const statusRows = Object.entries(statusCounts).sort((a,b) => b[1]-a[1]).map(([s,c]) =>
        '<tr><td>' + escH(s.charAt(0).toUpperCase() + s.slice(1)) + '</td><td class="right">' + c + '</td></tr>'
    ).join('') || '<tr><td colspan="2" style="color:#94a3b8;">No data</td></tr>';

    const html = '<html><head><title>ServiCell Report</title><style>' + css + '</style></head><body>'
        + '<h1>ServiCell Belize &mdash; Performance Report</h1>'
        + '<div class="sub">Period: <strong>' + from + '</strong> to <strong>' + to + '</strong></div>'
        + '<div class="meta">Generated: ' + new Date().toLocaleString() + ' &nbsp;&bull;&nbsp; Confidential &mdash; Manager Use Only</div>'

        + '<h2>Financial Summary</h2>'
        + '<div class="kpi-row">'
        + '<div class="kpi"><div class="kpi-label">Gross Revenue</div><div class="kpi-val">' + bz(gross) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-val">' + sales.length + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Reversals</div><div class="kpi-val">' + reversed.length + ' (' + revRate + '%)</div></div>'
        + '<div class="kpi"><div class="kpi-label">Jobs Completed</div><div class="kpi-val">' + completedJobs.length + '</div></div>'
        + '</div>'

        + '<h2>Technician Performance</h2>'
        + '<table><tr><th>Technician</th><th class="right">Assigned</th><th class="right">Completed</th><th class="right">Revenue</th></tr>'
        + techRows + '</table>'

        + '<h2>Cashier Performance</h2>'
        + '<table><tr><th>Cashier</th><th class="right">Sales</th><th class="right">Gross Revenue</th></tr>'
        + cashierRows + '</table>'

        + '<h2>Job Status Breakdown</h2>'
        + '<table><tr><th>Status</th><th class="right">Count</th></tr>'
        + statusRows + '</table>'

        + '<h2>Top Selling Items</h2>'
        + '<table><tr><th>Item</th><th class="right">Qty Sold</th></tr>'
        + itemRows + '</table>'

        + '<div class="footer">ServiCell Belize Staff Portal &bull; This report is confidential and intended for management use only.</div>'
        + '</body></html>';

    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { alert('Allow popups to print the report.'); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print();
    setTimeout(() => w.close(), 1500);
}
