// ─────────────────────────────────────────────────────────────────────────────
// statistics.js — ServiCell Belize Statistics Page (Manager only)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// statistics.js — ServiCell Belize Statistics Page
// SCRIPT_URL is provided globally by js/api.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Utilities ─────────────────────────────────────────────────────────────────
function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }
function escH(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
function tryParseJSON(str, fb) { try { return JSON.parse(str); } catch(_) { return fb; } }

/** Mirrors sales.js — collected revenue per sale (excludes reversed). */
function saleCollectedAmount(s) {
    if (!s || s.status === 'reversed') return 0;
    const total = parseFloat(s.total) || 0;
    const paid  = parseFloat(s.amountPaid) || 0;
    if (s.method === 'partial') return paid;
    return total;
}

/** Cash in drawer from this sale (excludes card). */
function saleDrawerCash(s) {
    if (!s || s.status === 'reversed') return 0;
    if (s.method === 'card') return 0;
    const total = parseFloat(s.total) || 0;
    const paid  = parseFloat(s.amountPaid) || 0;
    if (s.method === 'partial') return paid;
    return total;
}

function sumCollected(sales) {
    return sales.filter(s => s.status !== 'reversed').reduce((t, s) => t + saleCollectedAmount(s), 0);
}

function sumCash(sales) {
    return sales.filter(s => s.status !== 'reversed').reduce((t, s) => t + saleDrawerCash(s), 0);
}

function sumCard(sales) {
    return sales
        .filter(s => s.status !== 'reversed' && s.method === 'card')
        .reduce((t, s) => t + saleCollectedAmount(s), 0);
}

function saleShiftDate(s) {
    return s.shiftDate || (s.timestamp || '').slice(0, 10);
}

function saleInDateRange(s, from, to) {
    const d = saleShiftDate(s);
    return d && d >= from && d <= to;
}

function jobInDateRange(j, from, to) {
    if (!j.dateReceived) return false;
    const d = j.dateReceived.slice(0, 10);
    return d >= from && d <= to;
}

/**
 * Who should be credited for a job's revenue.
 * Prefer the person who claimed (did) the job; fall back to the assigned technician.
 * Returns null when there is no real person to credit (so that revenue stays unattributed
 * rather than being dumped on a placeholder like "Unknown" or "Unassigned").
 */
function techCreditFor(job) {
    if (!job) return null;
    const claimer = String(job.claimedBy || '').trim();
    if (claimer) return claimer;
    const tech = String(job.technician || '').trim();
    if (tech && !['unknown', 'unassigned'].includes(tech.toLowerCase())) return tech;
    return null;
}

/**
 * Attribute each in-period sale's collected revenue to the technician of its job.
 * The job→tech map is built from ALL jobs (window._allJobs), not just jobs received in the
 * period, so a payment collected now still credits the tech even if the job came in earlier.
 * This keeps technician revenue reconciled with the shop's collected (job-linked) revenue.
 */
function buildTechRevenue(salesInRange) {
    const allJobs = window._allJobs || [];
    const creditByJob = {};
    allJobs.forEach(j => {
        const credit = techCreditFor(j);
        if (credit && j.id != null) creditByJob[String(j.id)] = credit;
    });
    const rev = {};
    (salesInRange || []).forEach(s => {
        if (!s || s.status === 'reversed') return;
        if (!s.jobId || String(s.jobId).trim() === '') return;
        const credit = creditByJob[String(s.jobId)];
        if (!credit) return;
        rev[credit] = (rev[credit] || 0) + saleCollectedAmount(s);
    });
    return rev;
}

function formatPeriodLabel(from, to) {
    const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return from === to ? fmt(from) : fmt(from) + ' – ' + fmt(to);
}

function statIcon(name, size) {
    return typeof scIcon === 'function' ? scIcon(name, size || 16) : '';
}

function statBadge(text, type) {
    const cls = type === 'primary' ? 'stat-badge-primary' : 'stat-badge-success';
    return '<span class="stat-badge ' + cls + '">' + statIcon('trophy', 11) + ' ' + escH(text) + '</span>';
}

const METHOD_LABELS = { cash: 'Cash', card: 'Card', partial: 'Partial' };
const STATUS_LABELS = { resolved: 'Resolved', ready: 'Ready', fixing: 'Fixing', testing: 'Testing', received: 'Received', abandoned: 'Abandoned', unsuccessful: 'Unsuccessful' };

function saleOutstanding(s) {
    if (!s || s.status === 'reversed' || s.method !== 'partial') return 0;
    return Math.max(0, (parseFloat(s.total) || 0) - (parseFloat(s.amountPaid) || 0));
}

function sumPartialOutstandingStats(sales) {
    return sales.filter(s => s.status !== 'reversed' && s.method === 'partial').reduce((t, s) => t + saleOutstanding(s), 0);
}

/**
 * True money still owed by customers, as of now.
 *
 * Job repairs are measured PER JOB (invoice total vs. everything ever collected on that job),
 * so a repair settled across several visits — or a job whose payment status is already "paid" —
 * no longer shows a phantom balance. Summing each partial sale on its own would double-count a
 * job paid over multiple visits and never clear a job that was later paid in full.
 * Retail partial sales (no job attached) are still measured per sale.
 *
 * Returns { owed, count }.
 */
function computePartialOutstanding(allSales) {
    const jobById = {};
    (window._allJobs || []).forEach(j => { if (j.id != null) jobById[String(j.id)] = j; });

    const collectedByJob = {};
    let retailOwed = 0, retailCount = 0;
    (allSales || []).filter(s => s && s.status !== 'reversed').forEach(s => {
        const jid = s.jobId != null ? String(s.jobId).trim() : '';
        if (jid && jobById[jid]) {
            collectedByJob[jid] = (collectedByJob[jid] || 0) + saleCollectedAmount(s);
        } else if (s.method === 'partial') {
            const out = saleOutstanding(s);
            if (out > 0.009) { retailOwed += out; retailCount++; }
        }
    });

    let jobOwed = 0, jobCount = 0;
    Object.keys(collectedByJob).forEach(jid => {
        const j = jobById[jid];
        const invoiceTotal = (tryParseJSON(j.invoiceItems, []) || []).reduce((t, i) => t + (parseFloat(i.price) || 0), 0);
        const collected = collectedByJob[jid];
        const fullyPaid = String(j.payStatus || j.payment || '').toLowerCase() === 'paid';
        const remaining = invoiceTotal - collected;
        // Only a genuine partial: some money in, not fully paid, still something left.
        if (!fullyPaid && collected > 0.009 && remaining > 0.009) { jobOwed += remaining; jobCount++; }
    });

    return { owed: jobOwed + retailOwed, count: jobCount + retailCount };
}

function gstFromInclusive(gross) {
    return (parseFloat(gross) || 0) * 12.5 / 112.5;
}

function getPreviousPeriod(from, to) {
    const startMs = new Date(from + 'T12:00:00').getTime();
    const endMs = new Date(to + 'T12:00:00').getTime();
    const days = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);
    const prevEnd = new Date(startMs);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    return { from: prevStart.toISOString().slice(0, 10), to: prevEnd.toISOString().slice(0, 10) };
}

function computeDrawerVariance(closes) {
    let net = 0, totalShort = 0, totalOver = 0;
    (closes || []).forEach(c => {
        const v = parseFloat(c.variance) || 0;
        net += v;
        if (v < -0.01) totalShort += Math.abs(v);
        else if (v > 0.01) totalOver += v;
    });
    return { net, totalShort, totalOver };
}

function formatDelta(current, previous, invert) {
    if (previous == null || previous === undefined) return { text: '', cls: 'neutral' };
    if (Math.abs(previous) < 0.01 && Math.abs(current) < 0.01) return { text: 'Same as prior period', cls: 'neutral' };
    if (Math.abs(previous) < 0.01) return { text: current > 0 ? 'New this period' : '', cls: 'neutral' };
    const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
    if (pct === 0) return { text: 'Same as prior period', cls: 'neutral' };
    const isUp = pct > 0;
    const good = invert ? !isUp : isUp;
    return { text: (isUp ? '↑ ' : '↓ ') + Math.abs(pct) + '% vs prior period', cls: good ? 'up' : 'down' };
}

function setKpiDelta(id, delta) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!delta || !delta.text) { el.textContent = ''; el.className = 'kpi-delta'; return; }
    el.textContent = delta.text;
    el.className = 'kpi-delta ' + (delta.cls || 'neutral');
}

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

    const prev = getPreviousPeriod(from, to);

    const [salesData, prevSalesData, payoutsData, prevPayoutsData, jobsData, invData, movData, closesData, billsData, custData] = await Promise.all([
        apiGet({ action: 'listsales', from, to, includeReversed: '1' }).catch(() => ({})),
        apiGet({ action: 'listsales', from: prev.from, to: prev.to, includeReversed: '1' }).catch(() => ({})),
        apiGet({ action: 'listpayouts', from, to }).catch(() => ({})),
        apiGet({ action: 'listpayouts', from: prev.from, to: prev.to }).catch(() => ({})),
        apiGet({ action: 'list' }).catch(() => ({})),
        apiGet({ action: 'listinventory' }).catch(() => ({})),
        apiGet({ action: 'listmovements', limit: 1000 }).catch(() => ({})),
        apiGet({ action: 'listdaycloses', from, to }).catch(() => ({})),
        apiGet({ action: 'listbills' }).catch(() => ({})),
        apiGet({ action: 'listcustomers' }).catch(() => ({}))
    ]);

    const allSalesRaw = salesData.sales || [];
    const sales    = allSalesRaw.filter(s => s.status !== 'reversed');
    const reversed = allSalesRaw.filter(s => s.status === 'reversed');
    const payouts  = payoutsData.payouts || [];
    const allJobs  = jobsData.jobs || [];
    const jobs     = allJobs.filter(j => jobInDateRange(j, from, to));
    const inv     = invData.items       || [];
    const movs    = movData.movements   || [];
    const closes  = closesData.closes   || [];
    const bills   = billsData.bills     || [];

    // Cache customers for lookup
    window._allCustomers = custData.customers || [];
    window._allJobs      = allJobs;
    window._allSales     = allSalesRaw;
    window._allPayouts   = payouts;
    window._statRange    = { from, to };
    window._prevPeriod   = prev;
    window._prevSales    = (prevSalesData.sales || []).filter(s => s.status !== 'reversed');
    window._prevPayoutsTotal = (prevPayoutsData.payouts || []).reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    window._prevJobsCompleted = allJobs.filter(j =>
        jobInDateRange(j, prev.from, prev.to) && ['resolved', 'ready'].includes((j.status || '').toLowerCase())
    ).length;
    window._allCloses    = closes;

    renderKPIs(sales, reversed, payouts, jobs, bills, closes, window._prevSales);
    renderRevenueChart(sales, from, to);
    renderPaymentMethods(sales);
    renderJobStatus(jobs);
    renderTopItems(sales, movs);
    renderInvHealth(inv);
    renderCashierPerf(sales, reversed, payouts, closes);
    renderTechPerf(jobs, from, to);
    renderShortHistory(closes);

    setSyncState('ok', formatPeriodLabel(from, to) + ' · Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs(sales, reversed, payouts, jobs, bills, closes, prevSales) {
    const gross     = sumCollected(sales);
    const cashColl  = sumCash(sales);
    const cardColl  = sumCard(sales);
    const pTotal    = payouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const netCash   = cashColl - pTotal;
    const completed = jobs.filter(j => ['resolved','ready'].includes((j.status||'').toLowerCase()));
    const jobSales  = sales.filter(s => s.jobId && String(s.jobId).trim() !== '');
    // Average per repair, not per transaction — a job paid over several visits is still one repair.
    const uniqueJobIds = new Set(jobSales.map(s => String(s.jobId).trim()));
    const avgRepair = uniqueJobIds.size
        ? jobSales.reduce((t, s) => t + saleCollectedAmount(s), 0) / uniqueJobIds.size
        : 0;
    const openBills = bills.filter(b => b.status === 'open');
    const billsOwed = openBills.reduce((t, b) => t + Math.max(0, (parseFloat(b.totalOwed)||0) - (parseFloat(b.totalPaid)||0)), 0);
    const totalTx   = sales.length + reversed.length;
    const revRate   = totalTx > 0 ? Math.round((reversed.length / totalTx) * 100) : 0;
    // Outstanding balances are an as-of-now figure (all time), measured per job — see computePartialOutstanding.
    const partialBal   = computePartialOutstanding(window._allSales || sales);
    const partialOwed  = partialBal.owed;
    const partialCount = partialBal.count;
    const gstTotal = gstFromInclusive(gross);
    const variance = computeDrawerVariance(closes);

    const prevGross = sumCollected(prevSales || []);
    const prevCash = sumCash(prevSales || []);
    const prevPTotal = window._prevPayoutsTotal || 0;
    const prevNet = prevCash - prevPTotal;
    const prevCompleted = window._prevJobsCompleted || 0;

    document.getElementById('kpiRevenue').textContent    = bz(gross);
    document.getElementById('kpiRevenueSub').textContent = sales.length + ' tx · ' + bz(cashColl) + ' cash · ' + bz(cardColl) + ' card';
    setKpiDelta('kpiRevenueDelta', formatDelta(gross, prevGross));
    document.getElementById('kpiPayouts').textContent    = bz(pTotal);
    document.getElementById('kpiPayoutsSub').textContent = payouts.length + ' payouts';
    setKpiDelta('kpiPayoutsDelta', formatDelta(pTotal, prevPTotal, true));
    document.getElementById('kpiNet').textContent        = bz(netCash);
    document.getElementById('kpiNetSub').textContent      = 'Cash collected − payouts (matches EOD)';
    setKpiDelta('kpiNetDelta', formatDelta(netCash, prevNet));
    document.getElementById('kpiJobs').textContent       = completed.length;
    document.getElementById('kpiJobsSub').textContent    = jobs.length + ' received in period';
    setKpiDelta('kpiJobsDelta', formatDelta(completed.length, prevCompleted));
    document.getElementById('kpiAvgRepair').textContent  = bz(avgRepair);
    document.getElementById('kpiBills').textContent      = bz(billsOwed);
    document.getElementById('kpiBillsSub').textContent   = openBills.length + ' open bills (all time)';
    document.getElementById('kpiReversals').textContent  = revRate + '%';
    document.getElementById('kpiReversalsSub').textContent = reversed.length + ' of ' + totalTx + ' reversed';
    document.getElementById('kpiPartialOwed').textContent = bz(partialOwed);
    document.getElementById('kpiPartialSub').textContent = partialCount + ' open balance' + (partialCount === 1 ? '' : 's') + ' (all time)';
    document.getElementById('kpiGST').textContent = bz(gstTotal);
    document.getElementById('kpiGSTSub').textContent = 'Pre-tax approx. ' + bz(gross - gstTotal);
    const varEl = document.getElementById('kpiVariance');
    const varSub = document.getElementById('kpiVarianceSub');
    if (varEl) {
        varEl.textContent = bz(variance.net);
        varEl.style.color = variance.net < -0.01 ? 'var(--danger)' : variance.net > 0.01 ? 'var(--success)' : 'var(--text-main)';
    }
    if (varSub) {
        varSub.textContent = (closes || []).length
            ? bz(variance.totalShort) + ' short · ' + bz(variance.totalOver) + ' over · ' + closes.length + ' closes'
            : 'No EOD closes in period';
    }
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
        const day = saleShiftDate(s);
        if (days[day] !== undefined) days[day] += saleCollectedAmount(s);
    });
    const entries = Object.entries(days);
    if (!entries.length) { el.innerHTML = '<div class="empty-state">No sales in this period.</div>'; return; }
    const max = Math.max(...entries.map(e => e[1]), 1);
    el.innerHTML = entries.map(([day, val]) => {
        const pct  = Math.round((val / max) * 100);
        const lbl  = new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return '<div class="bar-wrap drillable" onclick="openStatDrill(\'day\',\'' + day + '\')" title="' + escH(lbl) + ': ' + bz(val) + ' — click for details">'
            + '<div class="bar" style="height:' + Math.max(pct, 2) + '%;background:' + (val > 0 ? 'var(--primary)' : 'var(--glass-border)') + ';"></div>'
            + '<div class="bar-label">' + escH(lbl) + '</div>'
            + '</div>';
    }).join('');
}

// ── Payment Methods ───────────────────────────────────────────────────────────
function renderPaymentMethods(sales) {
    const el = document.getElementById('paymentMethods');
    if (!sales.length) { el.innerHTML = '<div class="empty-state">No sales data.</div>'; return; }
    const methods = {};
    sales.forEach(s => {
        const m = s.method || 'cash';
        if (!methods[m]) methods[m] = { count: 0, revenue: 0 };
        methods[m].count++;
        methods[m].revenue += saleCollectedAmount(s);
    });
    const totalRev = sumCollected(sales);
    const colors = { cash: 'green', card: '', partial: 'yellow' };
    el.innerHTML = Object.entries(methods).sort((a,b) => b[1].revenue - a[1].revenue).map(([m, d]) => {
        const pct = totalRev > 0 ? Math.round((d.revenue / totalRev) * 100) : 0;
        const label = METHOD_LABELS[m] || (m.charAt(0).toUpperCase() + m.slice(1));
        return '<div class="progress-row">'
            + '<div class="progress-label"><span>' + escH(label) + '</span><span>' + d.count + ' tx · ' + bz(d.revenue) + ' (' + pct + '%)</span></div>'
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
        const label = STATUS_LABELS[s] || (s.charAt(0).toUpperCase() + s.slice(1));
        return '<div class="progress-row">'
            + '<div class="progress-label"><span>' + escH(label) + '</span><span>' + c + ' (' + pct + '%)</span></div>'
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
    const totalValue = inv.reduce((t, i) => t + (parseFloat(i.qty) || 0) * (parseFloat(i.costPrice) || 0), 0);
    const outOfStock = inv.filter(i => (parseFloat(i.qty) || 0) <= 0);
    const lowStock   = inv.filter(i => {
        const q = parseFloat(i.qty) || 0;
        const min = parseFloat(i.minQty) || 0;
        return q > 0 && min > 0 && q <= min;
    });
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
function renderCashierPerf(sales, reversed, payouts, closes) {
    const el = document.getElementById('cashierPerf');
    const cashiers = {};
    sales.forEach(s => {
        const c = s.cashier || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0, reversals: 0, payouts: 0, shorts: 0 };
        cashiers[c].sales++;
        cashiers[c].revenue += saleCollectedAmount(s);
    });
    reversed.forEach(s => {
        const c = s.cashier || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0, reversals: 0, payouts: 0, shorts: 0 };
        cashiers[c].reversals++;
    });
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
    el.innerHTML = sorted.map(([name, d]) => {
        const revNote = d.reversals ? ' &bull; <span style="color:var(--danger);">' + d.reversals + ' reversed</span>' : '';
        return '<div class="person-row drill-row" data-drill-cashier="' + escH(name) + '" onclick="openStatDrill(\'cashier\', this.dataset.drillCashier)" title="View sales">'
        + '<div class="person-avatar">' + statIcon('dollar', 16) + '</div>'
        + '<div><div class="person-name">' + escH(name) + '</div>'
        + '<div class="person-meta">' + d.sales + ' sales &bull; ' + bz(d.payouts) + ' payouts' + revNote + (d.shorts ? ' &bull; <span style="color:var(--danger);">' + d.shorts + ' short</span>' : '') + '</div></div>'
        + '<div class="person-stats"><div class="person-stat-main">' + bz(d.revenue) + '</div><div class="person-stat-sub">collected</div></div>'
        + '</div>';
    }).join('');
}

// ── Technician Performance ────────────────────────────────────────────────────
function renderTechPerf(jobs, from, to) {
    const el = document.getElementById('techPerf');
    const techs = {};

    // Attribute revenue from ALL sales in the period to each job's technician (claimed → assigned).
    const salesInRange = (window._allSales || []).filter(s => s.status !== 'reversed' && saleInDateRange(s, from, to));
    const techRevenue = buildTechRevenue(salesInRange);

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

    // A tech may have earned revenue this period from a job received earlier (so it isn't in
    // the job-count loop above). Make sure they still appear and can win "Top Revenue".
    Object.keys(techRevenue).forEach(name => {
        if (!techs[name]) techs[name] = { assigned: 0, completed: 0, stale: 0, unclaimed: 0, totalMs: 0, countMs: 0 };
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
            + '<div class="person-avatar">' + statIcon(isUnassigned ? 'info' : 'wrench', 16) + '</div>'
            + '<div style="flex:1;min-width:0;">'
            +   '<div class="person-name">' + escH(name)
            +     (topJobs ? ' ' + statBadge('Most Jobs', 'success') : '')
            + (topRev  ? ' ' + statBadge('Top Revenue', 'primary') : '')
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
        el.innerHTML = '<div class="empty-state" style="color:var(--success);display:flex;align-items:center;justify-content:center;gap:6px;">' + statIcon('check', 16) + ' No short closes in this period.</div>';
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
    const now   = new Date();
    const from  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to    = now.toISOString().slice(0, 10);
    document.getElementById('dateFrom').value = from;
    document.getElementById('dateTo').value   = to;
    if (typeof initDataIcons === 'function') initDataIcons(document);
    loadStats();
});

window.addEventListener('sc-back-online', loadStats);

// ── Partial Sales Modal (Statistics) ───────────────────────────────────────────
function openStatsPartialSales() {
    const { from, to } = window._statRange || getDateRange();
    openPartialSalesModal(window._allSales || [], {
        from, to,
        emptyText: 'No partial sales with balance due in this period.'
    });
}

// ── Drill-down Modal ──────────────────────────────────────────────────────────
function openStatDrill(type, key) {
    const active = (window._allSales || []).filter(s => s.status !== 'reversed');
    let filtered = [];
    let title = 'Details';
    if (type === 'day') {
        filtered = active.filter(s => saleShiftDate(s) === key);
        title = 'Sales — ' + new Date(key + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } else if (type === 'cashier') {
        filtered = active.filter(s => (s.cashier || 'Unknown') === key);
        title = 'Sales — ' + key;
    }
    const titleEl = document.getElementById('statDrillTitle');
    if (titleEl) titleEl.textContent = title;
    const body = document.getElementById('statDrillBody');
    if (!body) return;
    if (!filtered.length) {
        body.innerHTML = '<div class="empty-state">No sales found.</div>';
    } else {
        const total = filtered.reduce((t, s) => t + saleCollectedAmount(s), 0);
        body.innerHTML = '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:10px;font-weight:700;">'
            + filtered.length + ' sale' + (filtered.length === 1 ? '' : 's') + ' · ' + bz(total) + ' collected</div>'
            + filtered.map(s => {
                const items = tryParseJSON(s.items, []);
                const desc = items.map(i => i.name).slice(0, 2).join(', ') + (items.length > 2 ? '…' : '') || 'Sale';
                const ts = s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return '<div class="drill-sale-row">'
                    + '<div><div style="font-weight:700;">' + escH(desc) + '</div>'
                    + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">' + escH(s.method || 'cash') + (ts ? ' · ' + escH(ts) : '') + '</div></div>'
                    + '<div style="font-weight:800;text-align:right;">' + bz(saleCollectedAmount(s)) + '</div>'
                    + '</div>';
            }).join('');
    }
    document.getElementById('statDrillModal').classList.add('open');
    document.body.classList.add('modal-open');
    if (typeof initDataIcons === 'function') initDataIcons(document.getElementById('statDrillModal'));
}

function closeStatDrill() {
    const el = document.getElementById('statDrillModal');
    if (el) el.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
}

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
    let allSales = window._allSales || [];
    const periodOnly = document.getElementById('customerPeriodToggle')?.checked;
    const range = window._statRange || getDateRange();
    if (periodOnly) {
        allSales = allSales.filter(s => saleInDateRange(s, range.from, range.to));
    }
    el.innerHTML = matches.map(c => {
        const cJobs  = allJobs.filter(j => (j.customerName||'').toLowerCase() === (c.name||'').toLowerCase());
        let cSales = allSales.filter(s => (s.customer||'').toLowerCase() === (c.name||'').toLowerCase());
        const spent  = cSales.filter(s => s.status !== 'reversed').reduce((t, s) => t + saleCollectedAmount(s), 0);
        const lastSeen = c.lastSeen ? new Date(c.lastSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const periodNote = periodOnly ? ' · this period' : ' · all time';
        return '<div class="person-row">'
            + '<div class="person-avatar">' + statIcon('users', 16) + '</div>'
            + '<div><div class="person-name">' + escH(c.name || '—') + '</div>'
            + '<div class="person-meta">' + escH(c.phone || 'No phone') + ' &bull; Last seen: ' + escH(lastSeen) + '</div></div>'
            + '<div class="person-stats"><div class="person-stat-main">' + bz(spent) + '</div>'
            + '<div class="person-stat-sub">' + cJobs.length + ' jobs &bull; ' + cSales.filter(s => s.status !== 'reversed').length + ' sales' + periodNote + '</div></div>'
            + '</div>';
    }).join('');
}

function csvEscape(v) {
    return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function csvSection(title, headers, rows) {
    let out = title + '\n' + headers.map(csvEscape).join(',') + '\n';
    rows.forEach(r => { out += r.map(csvEscape).join(',') + '\n'; });
    return out + '\n';
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportCSV() {
    const { from, to } = getDateRange();
    const allSales = window._allSales || [];
    const payouts = window._allPayouts || [];
    if (!allSales.length && !payouts.length) { alert('No data to export for this period.'); return; }

    const sales = allSales.filter(s => s.status !== 'reversed');
    const reversed = allSales.filter(s => s.status === 'reversed');

    const salesRows = sales.map(s => {
        const items = tryParseJSON(s.items, []).map(i => i.name + ' x' + i.qty).join('; ');
        return [s.saleId, s.shiftDate, s.shift, s.cashier, items, s.total, s.method, s.amountPaid, s.jobId || '', s.status];
    });

    const payoutRows = payouts.map(p => [
        p.payoutId, p.shiftDate, p.shift, p.loggedBy, p.takenBy, p.amount, p.reason
    ]);

    const reversalRows = reversed.map(s => {
        const items = tryParseJSON(s.items, []).map(i => i.name + ' x' + i.qty).join('; ');
        return [s.saleId, s.shiftDate, s.cashier, items, s.total, s.amountPaid, s.status];
    });

    const partialRows = sales.filter(s => s.method === 'partial' && saleOutstanding(s) > 0.009).map(s => {
        const items = tryParseJSON(s.items, []).map(i => i.name + ' x' + i.qty).join('; ');
        return [s.saleId, s.shiftDate, s.cashier, s.customer || '', items, s.total, s.amountPaid, saleOutstanding(s)];
    });

    let csv = csvSection('=== SALES ===', ['SaleID','Date','Shift','Cashier','Items','Total','Method','AmountPaid','JobID','Status'], salesRows);
    csv += csvSection('=== PAYOUTS ===', ['PayoutID','Date','Shift','LoggedBy','TakenBy','Amount','Reason'], payoutRows);
    csv += csvSection('=== REVERSALS ===', ['SaleID','Date','Cashier','Items','Total','AmountPaid','Status'], reversalRows);
    csv += csvSection('=== PARTIAL BALANCES ===', ['SaleID','Date','Cashier','Customer','Items','Total','Paid','StillOwed'], partialRows);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ServiCell_Report_' + from + '_to_' + to + '.csv';
    a.click(); URL.revokeObjectURL(url);
}

// ── Print Report (PDF) ────────────────────────────────────────────────────────
function exportPDF() {
    const { from, to } = getDateRange();
    const allS      = window._allSales || [];
    const allJobs   = window._allJobs  || [];
    const payouts   = window._allPayouts || [];
    const sales     = allS.filter(s => s.status !== 'reversed');
    const reversed  = allS.filter(s => s.status === 'reversed');
    const gross     = sumCollected(sales);
    const cashColl  = sumCash(sales);
    const cardColl  = sumCard(sales);
    const pTotal    = payouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const netCash   = cashColl - pTotal;
    const totalTx   = sales.length + reversed.length;
    const revRate   = totalTx > 0 ? Math.round((reversed.length / totalTx) * 100) : 0;
    const partialOwed = computePartialOutstanding(window._allSales || sales).owed;
    const gstTotal = gstFromInclusive(gross);
    const variance = computeDrawerVariance(window._allCloses || []);

    const jobs = allJobs.filter(j => jobInDateRange(j, from, to));
    const completedJobs = jobs.filter(j => ['resolved','ready'].includes((j.status||'').toLowerCase()));

    const itemCounts = {};
    sales.forEach(s => { tryParseJSON(s.items, []).forEach(i => { if (i.name) itemCounts[i.name] = (itemCounts[i.name]||0) + (i.qty||1); }); });
    const topItems = Object.entries(itemCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);

    const techRevenue = buildTechRevenue(sales.filter(s => saleInDateRange(s, from, to)));
    const techs = {};
    jobs.forEach(j => {
        const t = j.claimedBy || ((['resolved','ready'].includes((j.status||'').toLowerCase())) ? (j.technician || 'Unassigned') : 'Unassigned');
        if (!techs[t]) techs[t] = { completed: 0, assigned: 0 };
        techs[t].assigned++;
        if (['resolved','ready'].includes((j.status||'').toLowerCase())) techs[t].completed++;
    });
    // Include techs who earned revenue from earlier jobs so they still show / can win Top Revenue.
    Object.keys(techRevenue).forEach(name => { if (!techs[name]) techs[name] = { completed: 0, assigned: 0 }; });
    const techSorted = Object.entries(techs).sort((a,b) => b[1].completed - a[1].completed);
    const maxCompleted = Math.max(...techSorted.map(([,d]) => d.completed), 0);
    const maxRevenue   = Math.max(...techSorted.map(([n]) => techRevenue[n]||0), 0);
    const soloJobsWinner = techSorted.filter(([n,d]) => n !== 'Unassigned' && d.completed === maxCompleted && maxCompleted > 0).length === 1
        ? techSorted.find(([n,d]) => n !== 'Unassigned' && d.completed === maxCompleted)[0] : null;
    const soloRevWinner  = techSorted.filter(([n]) => n !== 'Unassigned' && (techRevenue[n]||0) === maxRevenue && maxRevenue > 0).length === 1
        ? techSorted.find(([n]) => n !== 'Unassigned' && (techRevenue[n]||0) === maxRevenue)[0] : null;

    const cashiers = {};
    sales.forEach(s => {
        const c = s.cashier || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0 };
        cashiers[c].sales++;
        cashiers[c].revenue += saleCollectedAmount(s);
    });
    reversed.forEach(s => {
        const c = s.cashier || 'Unknown';
        if (!cashiers[c]) cashiers[c] = { sales: 0, revenue: 0, reversals: 0 };
        cashiers[c].reversals = (cashiers[c].reversals || 0) + 1;
    });
    const cashierSorted = Object.entries(cashiers).sort((a,b) => b[1].revenue - a[1].revenue);

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
        const badges = (name === soloJobsWinner ? '<span class="badge badge-jobs">Most Jobs</span>' : '')
                     + (name === soloRevWinner  ? '<span class="badge badge-rev">Top Revenue</span>' : '');
        return '<tr><td>' + escH(name) + badges + '</td>'
            + '<td class="right">' + d.assigned + '</td>'
            + '<td class="right">' + d.completed + '</td>'
            + '<td class="right">' + (rev > 0 ? bz(rev) : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:#94a3b8;">No data</td></tr>';

    const cashierRows = cashierSorted.map(([name, d]) =>
        '<tr><td>' + escH(name) + '</td><td class="right">' + d.sales + '</td><td class="right">' + bz(d.revenue) + '</td></tr>'
    ).join('') || '<tr><td colspan="3" style="color:#94a3b8;">No data</td></tr>';

    const statusRows = Object.entries(statusCounts).sort((a,b) => b[1]-a[1]).map(([s,c]) =>
        '<tr><td>' + escH(STATUS_LABELS[s] || (s.charAt(0).toUpperCase() + s.slice(1))) + '</td><td class="right">' + c + '</td></tr>'
    ).join('') || '<tr><td colspan="2" style="color:#94a3b8;">No data</td></tr>';

    const html = '<html><head><title>ServiCell Report</title><style>' + css + '</style></head><body>'
        + '<h1>ServiCell Belize &mdash; Performance Report</h1>'
        + '<div class="sub">Period: <strong>' + from + '</strong> to <strong>' + to + '</strong></div>'
        + '<div class="meta">Generated: ' + new Date().toLocaleString() + ' &nbsp;&bull;&nbsp; Confidential &mdash; Manager Use Only</div>'

        + '<h2>Financial Summary</h2>'
        + '<div class="kpi-row">'
        + '<div class="kpi"><div class="kpi-label">Gross Collected</div><div class="kpi-val">' + bz(gross) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Cash / Card</div><div class="kpi-val">' + bz(cashColl) + ' / ' + bz(cardColl) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Net Cash</div><div class="kpi-val">' + bz(netCash) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Payouts</div><div class="kpi-val">' + bz(pTotal) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Transactions</div><div class="kpi-val">' + sales.length + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Reversals</div><div class="kpi-val">' + reversed.length + ' (' + revRate + '%)</div></div>'
        + '<div class="kpi"><div class="kpi-label">Partial Owed</div><div class="kpi-val">' + bz(partialOwed) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">GST Included</div><div class="kpi-val">' + bz(gstTotal) + '</div></div>'
        + '<div class="kpi"><div class="kpi-label">Drawer Variance</div><div class="kpi-val">' + bz(variance.net) + '</div></div>'
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
