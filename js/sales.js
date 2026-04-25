// ─────────────────────────────────────────────────────────────────────────────
// sales.js — ServiCell Belize Sales Page
// ─────────────────────────────────────────────────────────────────────────────

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyLNGR6L75MieV_R-s9yyjTfzpAAut_HIwhbZBBNyPxj9WDzRLNWics0FZ1ZayI3imx/exec';

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser    = '';
let isManager      = false;
let allSales       = [];
let allPayouts     = [];
let allBills       = [];
let allJobs        = [];
let editingSaleId  = null;
let settlingBillId = null;
let selectedJobId  = null;

// ── Utilities ─────────────────────────────────────────────────────────────────
function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }

// ── Perf: reuse a single element for HTML escaping ────────────────────────────
const _escDiv = document.createElement('div');
function escH(s) { _escDiv.textContent = String(s || ''); return _escDiv.innerHTML; }

// ── Perf: debounce helper for search inputs ───────────────────────────────────
const _debounceTimers = {};
function debounce(key, fn, ms) {
    clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(fn, ms);
}

function tryParseJSON(str, fallback) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
}

// ── Shift Logic ───────────────────────────────────────────────────────────────
function getCurrentShift() {
    const now = new Date();
    const day = now.getDay();
    const h   = now.getHours() + now.getMinutes() / 60;
    if (day === 0) return null;
    const nightEnd = day === 6 ? 19 : 20;
    if (h >= 8  && h < 15)       return { label: 'Morning Shift', start: 8,  end: 15 };
    if (h >= 15 && h < nightEnd) return { label: 'Night Shift',   start: 15, end: nightEnd };
    return null;
}

function getShiftDate() { return new Date().toISOString().slice(0, 10); }

function updateShiftBanner() {
    const shift     = getCurrentShift();
    const dot       = document.getElementById('shiftDot');
    const status    = document.getElementById('shiftStatus');
    const countdown = document.getElementById('shiftCountdown');
    const label     = document.getElementById('shiftLabel');
    if (!shift) {
        dot.className         = 'shift-dot off';
        status.textContent    = new Date().getDay() === 0 ? 'Sunday — Closed' : 'Shop is closed';
        countdown.textContent = '';
        countdown.className   = 'shift-off';
        if (label) label.textContent = 'No active shift';
        return;
    }
    const now      = new Date();
    const endTime  = new Date(now);
    endTime.setHours(shift.end, 0, 0, 0);
    const msLeft   = endTime - now;
    const minsLeft = Math.floor(msLeft / 60000);
    const hoursLeft = Math.floor(minsLeft / 60);
    const minsRem   = minsLeft % 60;
    if (label) label.textContent = shift.label + ' · ' + getShiftDate();
    status.textContent = shift.label;
    if (minsLeft <= 0) {
        dot.className = 'shift-dot off'; countdown.textContent = 'Shift ended'; countdown.className = 'shift-off';
    } else if (minsLeft <= 30) {
        dot.className = 'shift-dot warn';
        countdown.textContent = '⚠️ Shift ends in ' + minsLeft + ' minutes';
        countdown.className = 'shift-warn';
    } else {
        dot.className = 'shift-dot';
        countdown.textContent = hoursLeft > 0 ? (hoursLeft + 'h ' + minsRem + 'm remaining') : (minsLeft + 'm remaining');
        countdown.className = 'shift-time';
    }
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(name) {
    const tabs = ['sales', 'payouts', 'bills', 'eod'];
    document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', tabs[i] === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    // Keep dropdown in sync
    const sel = document.getElementById('tabSelect');
    if (sel) sel.value = name;
    if (name === 'eod') updateEOD();
}

// ── Load All Data ─────────────────────────────────────────────────────────────
async function loadAll() {
    setSyncState('loading', 'Syncing...');
    const date = getShiftDate();
    const [sData, pData, bData, eData] = await Promise.all([
        fetch(SCRIPT_URL + '?action=listsales&date='     + date).then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listpayouts&date='   + date).then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listbills')           .then(r => r.json()).catch(() => ({})),
        fetch(SCRIPT_URL + '?action=listdaycloses&date=' + date).then(r => r.json()).catch(() => ({}))
    ]);
    allSales   = sData.sales   || [];
    allPayouts = pData.payouts || [];
    allBills   = bData.bills   || [];
    renderSales(); renderPayouts(); renderBills(); updateEOD();
    renderEODHistory(eData.closes || []);
    const anyFailed = [sData, pData, bData, eData].some(d => !d || d.error);
    if (anyFailed) {
        setSyncState('error', 'Some data failed to load — tap Refresh');
    } else {
        setSyncState('ok', 'Last sync: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
}

// Jobs are only needed for the job pickup modal — load lazily
async function ensureJobsLoaded() {
    if (allJobs.length) return;
    try {
        const d = await fetch(SCRIPT_URL + '?action=list').then(r => r.json());
        allJobs = d.jobs || [];
    } catch (_) {}
}

// ── Date Filter & Show Settled ────────────────────────────────────────────────
let _salesDateFilter = '';
let _showSettled     = false;
let _salesPage       = 1;
let _salesPerPage    = 10;

// ── Reusable pagination renderer ─────────────────────────────────────────────
function renderPagination(containerId, total, page, perPage, onPage, onPerPage) {
    const container  = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const start      = (page - 1) * perPage + 1;
    const end        = Math.min(page * perPage, total);
    container.style.display = total > 0 ? 'flex' : 'none';
    container.className = 'pagination';
    container.innerHTML =
        '<span class="pagination-info">Showing ' + start + '–' + end + ' of ' + total + '</span>'
        + '<div class="pagination-controls">'
        + '<button class="page-btn" id="' + containerId + '_prev" ' + (page <= 1 ? 'disabled' : '') + '>&#x2039;</button>'
        + '<div class="page-jump"><span>Page</span><input type="number" min="1" max="' + totalPages + '" value="' + page + '" onchange="var p=Math.max(1,Math.min(' + totalPages + ',parseInt(this.value)||1));this.value=p;document.getElementById(\'' + containerId + '\')._cb(p);" style="width:44px;"></div><span>of ' + totalPages + '</span>'
        + '</div>'
        + '<button class="page-btn" id="' + containerId + '_next" ' + (page >= totalPages ? 'disabled' : '') + '>&#x203A;</button>'
        + '</div>'
        + '<select class="per-page-select" onchange="document.getElementById(\'' + containerId + '\')._pp(parseInt(this.value));">'
        + [10,20,50,100].map(n => '<option value="' + n + '"' + (n === perPage ? ' selected' : '') + '>' + n + ' per page</option>').join('')
        + '</select>';
    container._cb = onPage;
    container._pp = onPerPage;
    const prev = document.getElementById(containerId + '_prev');
    const next = document.getElementById(containerId + '_next');
    if (prev) prev.onclick = () => { if (page > 1) onPage(page - 1); };
    if (next) next.onclick = () => { if (page < totalPages) onPage(page + 1); };
}

function onSalesDateChange() {
    _salesDateFilter = document.getElementById('salesDateFilter').value;
    if (_salesDateFilter && _salesDateFilter !== getShiftDate()) {
        setSyncState('loading', 'Loading...');
        fetch(SCRIPT_URL + '?action=listsales&date=' + _salesDateFilter)
            .then(r => r.json())
            .then(d => { allSales = d.sales || []; renderSales(); setSyncState('ok', 'Showing: ' + _salesDateFilter); })
            .catch(() => setSyncState('error', 'Failed to load'));
    } else {
        _salesDateFilter = '';
        loadAll();
    }
}

function toggleShowSettled() {
    _showSettled = !_showSettled;
    const btn = document.getElementById('showSettledBtn');
    if (btn) {
        btn.innerHTML = _showSettled ? '&#x1F4CB; Hide Settled' : '&#x1F4CB; Show Settled';
        btn.style.borderColor = _showSettled ? 'var(--primary)' : '';
    }
    renderBills();
}

// Debounced search handlers — called from oninput in the HTML
function onSalesSearch()  { debounce('salesSearch',  renderSales, 120); }
function onBillsSearch()  { debounce('billsSearch',  renderBills, 120); }

// ── Render: Sales ─────────────────────────────────────────────────────────────
function renderSales() {
    const q      = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
    const active = allSales.filter(s => s.status !== 'reversed');
    const gross  = active.reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    document.getElementById('sumGross').textContent    = bz(gross);
    document.getElementById('sumCount').textContent    = active.length;
    document.getElementById('sumPartial').textContent  = active.filter(s => s.method === 'partial').length;
    document.getElementById('sumReversed').textContent = allSales.filter(s => s.status === 'reversed').length;
    const el = document.getElementById('salesList');
    let list = [...allSales].reverse();
    if (q) {
        list = list.filter(s => {
            const items = tryParseJSON(s.items, []);
            const desc  = items.map(i => i.name).join(' ').toLowerCase();
            return desc.includes(q)
                || (s.cashier || '').toLowerCase().includes(q)
                || bz(s.amountPaid).includes(q)
                || (s.saleId || '').toLowerCase().includes(q)
                || (s.method || '').toLowerCase().includes(q);
        });
    }
    if (!list.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F6D2;</div><p>' + (q ? 'No results for "' + escH(q) + '"' : 'No sales yet today.') + '</p></div>';
        const pg = document.getElementById('salesPagination');
        if (pg) pg.style.display = 'none';
        return;
    }
    // Reset page if filters changed and page is out of range
    const totalPages = Math.max(1, Math.ceil(list.length / _salesPerPage));
    if (_salesPage > totalPages) _salesPage = 1;
    const start  = (_salesPage - 1) * _salesPerPage;
    const paged  = list.slice(start, start + _salesPerPage);
    el.innerHTML = paged.map(s => {
        const isRev   = s.status === 'reversed';
        const items   = tryParseJSON(s.items, []);
        const desc    = items.map(i => i.name).join(', ') || s.customer || 'Sale';
        const ts      = s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const mBadge  = '<span class="badge badge-' + escH(s.method || 'cash') + '">' + escH(s.method || 'cash') + '</span>';
        const sBadge  = isRev ? '<span class="badge badge-reversed">Reversed</span>'
            : (s.method === 'partial' ? '<span class="badge badge-partial">Partial</span>' : '<span class="badge badge-paid">Paid</span>');
        const editBtn    = '<button class="item-btn" title="Edit" onclick="openEditSale(\'' + escH(s.saleId) + '\')">✏️</button>';
        const reverseBtn = '<button class="item-btn red" title="Reverse" onclick="reverseSale(\'' + escH(s.saleId) + '\')">↩️</button>';
        const viewBtn    = '<button class="item-btn" title="View" onclick="openViewSale(\'' + escH(s.saleId) + '\')">&#x1F441;&#xFE0F;</button>';
        return '<div class="list-item" style="' + (isRev ? 'opacity:0.5;' : '') + '">'
            + '<div class="list-item-icon">🛒</div>'
            + '<div class="list-item-body">'
            +   '<div class="list-item-title">' + escH(desc) + '</div>'
            +   '<div class="list-item-meta">' + escH(ts) + (s.cashier ? ' · ' + escH(s.cashier) : '') + (s.jobId ? ' · Job #' + escH(s.jobId) : '') + '</div>'
            +   '<div style="margin-top:4px;display:flex;gap:6px;">' + mBadge + sBadge + '</div>'
            + '</div>'
            + '<div class="list-item-right">'
            +   '<span class="list-item-amount ' + (isRev ? '' : 'green') + '">' + bz(s.amountPaid) + '</span>'
            +   (!isRev ? '<div class="list-item-actions">' + viewBtn + editBtn + reverseBtn + '</div>' : '')
            + '</div></div>';
    }).join('');
    renderPagination('salesPagination', list.length, _salesPage, _salesPerPage,
        (p) => { _salesPage = p; renderSales(); },
        (pp) => { _salesPerPage = pp; _salesPage = 1; renderSales(); }
    );
}

// ── Render: Payouts ───────────────────────────────────────────────────────────
function renderPayouts() {
    const total = allPayouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    document.getElementById('sumPayouts').textContent     = bz(total);
    document.getElementById('sumPayoutCount').textContent = allPayouts.length;
    const el = document.getElementById('payoutsList');
    if (!allPayouts.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div><p>No payouts logged today.</p></div>'; return; }
    el.innerHTML = [...allPayouts].reverse().map(p => {
        const ts = p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return '<div class="list-item">'
            + '<div class="list-item-icon">💸</div>'
            + '<div class="list-item-body">'
            +   '<div class="list-item-title">' + escH(p.reason || 'Payout') + '</div>'
            +   '<div class="list-item-meta">' + escH(ts) + (p.loggedBy ? ' · ' + escH(p.loggedBy) : '') + (p.takenBy ? ' · Taken by: ' + escH(p.takenBy) : '') + '</div>'
            + '</div>'
            + '<span class="list-item-amount red">−' + bz(p.amount) + '</span>'
            + '</div>';
    }).join('');
}

// ── Render: Bills ─────────────────────────────────────────────────────────────
function renderBills() {
    const q         = (document.getElementById('billsSearch')?.value || '').trim().toLowerCase();
    const open      = allBills.filter(b => b.status === 'open');
    const totalOwed = open.reduce((t, b) => t + Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0)), 0);
    document.getElementById('sumBillsOwed').textContent = bz(totalOwed);
    document.getElementById('sumBillsOpen').textContent = open.length;
    const el = document.getElementById('billsList');
    let visible = _showSettled ? allBills : allBills.filter(b => b.status !== 'settled' && ((parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0)) > 0);
    if (q) {
        visible = visible.filter(b => {
            const items = tryParseJSON(b.items, []);
            const desc  = items.map(i => i.name).join(' ').toLowerCase();
            return (b.personName || '').toLowerCase().includes(q) || desc.includes(q);
        });
    }
    if (!visible.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#x1F4CB;</div><p>' + (q ? 'No results for "' + escH(q) + '"' : (_showSettled ? 'No bills found.' : 'No open bills.')) + '</p></div>';
        return;
    }
    el.innerHTML = visible.map(b => {
        const balance   = Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0));
        const isSettled = b.status === 'settled' || balance <= 0;
        const items     = tryParseJSON(b.items, []);
        const itemNames = items.map(i => i.name).filter(Boolean);
        const desc      = itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? ' <span style="color:var(--text-dim);font-size:0.72rem;">+' + (itemNames.length - 3) + ' more</span>' : '') || 'Bill';
        const ts        = b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return '<div class="list-item" style="' + (isSettled ? 'opacity:0.55;' : '') + '">'
            + '<div class="list-item-icon">&#x1F4CB;</div>'
            + '<div class="list-item-body">'
            +   '<div class="list-item-title">' + escH(b.personName || 'Unknown') + '</div>'
            +   '<div class="list-item-meta">' + desc + (ts ? ' · ' + escH(ts) : '') + '</div>'
            +   '<div style="margin-top:4px;"><span class="bill-balance ' + (isSettled ? 'settled' : '') + '">' + (isSettled ? '✓ Settled' : 'Owes ' + bz(balance)) + '</span></div>'
            + '</div>'
            + (!isSettled ? '<button class="btn-success-sm" onclick="openSettleBill(\'' + escH(b.billId) + '\')">Settle</button>' : '')
            + (!isSettled ? '<button class="item-btn" title="Edit" onclick="openEditBill(\'' + escH(b.billId) + '\')" style="margin-left:4px;">✏️</button>' : '')
            + '</div>';
    }).join('');
}

// ── End of Day ────────────────────────────────────────────────────────────────
function updateEOD() {
    const validSales   = allSales.filter(s => s.status !== 'reversed');
    const gross        = validSales.reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const cashSales    = validSales.filter(s => s.method === 'cash' || s.method === 'partial').reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const cardSales    = validSales.filter(s => s.method === 'card').reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const gstCollected = gross * 12.5 / 112.5;
    const payoutsTotal = allPayouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const net          = gross - payoutsTotal;
    document.getElementById('eodGross').textContent   = bz(gross);
    document.getElementById('eodCash').textContent    = bz(cashSales);
    document.getElementById('eodCard').textContent    = bz(cardSales);
    document.getElementById('eodPayouts').textContent = bz(payoutsTotal);
    document.getElementById('eodNet').textContent     = bz(net);
    // GST line — add element if not present
    let gstEl = document.getElementById('eodGST');
    if (!gstEl) {
        const netRow = document.getElementById('eodNet').closest('.eod-row');
        if (netRow) {
            const gstRow = document.createElement('div');
            gstRow.className = 'eod-row';
            gstRow.innerHTML = '<span class="lbl">GST Collected (12.5%)</span><span class="val" id="eodGST"></span>';
            netRow.parentNode.insertBefore(gstRow, netRow);
            gstEl = document.getElementById('eodGST');
        }
    }
    if (gstEl) gstEl.textContent = bz(gstCollected);
    calcVariance();
}

function calcVariance() {
    const net    = parseFloat((document.getElementById('eodNet').textContent || '').replace('BZ$', '')) || 0;
    const drawerEl = document.getElementById('drawerCount');
    const disp   = document.getElementById('varianceDisplay');
    if (!drawerEl.value) { disp.style.display = 'none'; return; }
    const drawer = parseFloat(drawerEl.value) || 0;
    const diff   = drawer - net;
    disp.style.display = 'block';
    if (Math.abs(diff) < 0.01) {
        disp.className = 'variance-display exact'; disp.textContent = '✓ Drawer is exact — ' + bz(drawer);
    } else if (diff > 0) {
        disp.className = 'variance-display over'; disp.textContent = '↑ Over by ' + bz(diff);
    } else {
        disp.className = 'variance-display short'; disp.textContent = '⚠️ Short by ' + bz(Math.abs(diff)) + ' — Manager will be notified';
    }
}

function renderEODHistory(closes) {
    const el = document.getElementById('eodHistory');
    if (!closes.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>No previous closes today.</p></div>'; return; }
    el.innerHTML = [...closes].reverse().map(c => {
        const ts       = c.timestamp ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const variance = parseFloat(c.variance) || 0;
        const varColor = Math.abs(variance) < 0.01 ? 'var(--success)' : variance > 0 ? 'var(--success)' : 'var(--danger)';
        const varLabel = Math.abs(variance) < 0.01 ? '✓ Exact' : (variance > 0 ? '+' : '') + bz(variance);
        return '<div class="eod-history-item">'
            + '<div><div style="font-size:0.88rem;font-weight:700;">' + escH(c.shift || 'Close') + '</div>'
            + '<div style="font-size:0.72rem;color:var(--text-dim);">' + escH(ts) + (c.closedBy ? ' · ' + escH(c.closedBy) : '') + '</div></div>'
            + '<div style="text-align:right;"><div style="font-size:0.88rem;font-weight:800;">Net: ' + bz(c.netExpected) + '</div>'
            + '<div style="font-size:0.72rem;font-weight:700;color:' + varColor + ';">Variance: ' + varLabel + '</div></div>'
            + '</div>';
    }).join('');
}

async function submitEOD() {
    const net      = parseFloat((document.getElementById('eodNet').textContent || '').replace('BZ$', '')) || 0;
    const drawerVal = document.getElementById('drawerCount').value;
    if (!drawerVal) { alert('Enter the drawer count first.'); return; }
    const drawer       = parseFloat(drawerVal);
    const variance     = drawer - net;
    const shift        = getCurrentShift();
    const gross        = allSales.filter(s => s.status !== 'reversed').reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const payoutsTotal = allPayouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const btn          = document.getElementById('submitEODBtn');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
        const params = new URLSearchParams({
            action: 'submitdayclose', shiftDate: getShiftDate(),
            shift: shift ? shift.label : 'Unknown', grossSales: gross,
            totalPayouts: payoutsTotal, netExpected: net,
            actualDrawer: drawer, variance, closedBy: currentUser
        });
        const res  = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            if (typeof haptic === 'function') haptic('success');
            if (variance < -0.01 && typeof sendNotification === 'function')
                sendNotification('manageronly', '⚠️ Cashier Short', currentUser + ' is short ' + bz(Math.abs(variance)) + ' on ' + getShiftDate() + '.');
            showToast('End of day submitted!', 'ok');
            btn.textContent = '✓ Submitted';
            document.getElementById('drawerCount').value = '';
            document.getElementById('varianceDisplay').style.display = 'none';
            await loadAll();
        } else {
            btn.disabled = false; btn.textContent = '✓ Submit End of Day';
            alert('❌ ' + (data.error || 'Could not submit.'));
        }
    } catch (e) { btn.disabled = false; btn.textContent = '✓ Submit End of Day'; alert('Connection error.'); }
}

function printEOD() {
    const validSales   = allSales.filter(s => s.status !== 'reversed');
    const gross        = validSales.reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const cashSales    = validSales.filter(s => s.method === 'cash' || s.method === 'partial').reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const cardSales    = validSales.filter(s => s.method === 'card').reduce((t, s) => t + (parseFloat(s.amountPaid) || 0), 0);
    const gstCollected = gross * 12.5 / 112.5;
    const preTax       = gross - gstCollected;
    const payoutsTotal = allPayouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const net          = gross - payoutsTotal;
    const drawer       = parseFloat(document.getElementById('drawerCount').value) || 0;
    const variance     = drawer - net;
    const shift        = getCurrentShift();
    const varColor     = Math.abs(variance) < 0.01 ? 'green' : variance > 0 ? 'green' : 'red';
    const varText      = Math.abs(variance) < 0.01 ? 'Exact' : (variance > 0 ? '+' : '') + bz(variance);
    const html = '<!DOCTYPE html><html><head><title>EOD Report</title>'
        + '<style>'
        + '@page{size:72mm auto;margin:0;}'
        + '*{box-sizing:border-box;}'
        + 'body{font-family:"Courier New",Courier,monospace;font-size:11pt;font-weight:bold;width:72mm;margin:0 auto;padding:3mm 3mm 60mm 3mm;color:#000;background:#fff;}'
        + 'h2{text-align:center;font-size:13pt;font-weight:900;margin:0 0 2mm;letter-spacing:1px;}'
        + 'p{text-align:center;margin:0 0 1mm;font-size:10pt;font-weight:bold;}'
        + 'hr{border:none;border-top:2px solid #000;margin:2mm 0;}'
        + 'hr.dash{border-top:1px dashed #000;}'
        + 'table{width:100%;border-collapse:collapse;font-size:10pt;font-weight:bold;}'
        + 'td{padding:3px 0;border-bottom:1px solid #000;}'
        + 'td:last-child{text-align:right;font-weight:900;}'
        + '.total td{border-top:3px solid #000;border-bottom:none;font-size:12pt;font-weight:900;padding-top:4px;}'
        + '.variance td{font-size:11pt;font-weight:900;}'
        + '.footer{text-align:center;font-size:9pt;font-weight:bold;margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;}'
        + '</style></head><body>'
        + '<h2>SERVICELL BELIZE</h2>'
        + '<p>' + (shift ? shift.label : 'End of Day') + ' &mdash; ' + getShiftDate() + '</p>'
        + '<p>Cashier: ' + escH(currentUser) + '</p>'
        + '<hr>'
        + '<table>'
        + '<tr><td>Gross Sales (incl. GST)</td><td>' + bz(gross) + '</td></tr>'
        + '<tr><td>&nbsp;&nbsp;[CASH]</td><td>' + bz(cashSales) + '</td></tr>'
        + '<tr><td>&nbsp;&nbsp;[CARD]</td><td>' + bz(cardSales) + '</td></tr>'
        + '<tr><td>Sales excl. GST</td><td>' + bz(preTax) + '</td></tr>'
        + '<tr><td>GST Collected (12.5%)</td><td>' + bz(gstCollected) + '</td></tr>'
        + '<tr><td>Total Payouts</td><td>' + bz(payoutsTotal) + '</td></tr>'
        + '<tr class="total"><td><strong>Net Expected</strong></td><td><strong>' + bz(net) + '</strong></td></tr>'
        + '<tr><td>Actual Drawer</td><td>' + bz(drawer) + '</td></tr>'
        + '<tr class="variance"><td><strong>Variance</strong></td><td><strong>' + varText + '</strong></td></tr>'
        + '</table>'
        + '<div class="footer">Printed ' + new Date().toLocaleString() + '</div>'
        + '</body></html>';
    const w = window.open('', '_blank', 'width=340,height=500');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onload = function() { w.print(); setTimeout(() => w.close(), 1500); };
    setTimeout(() => { try { w.print(); setTimeout(() => w.close(), 1500); } catch(_) {} }, 800);
}

// ── SKU / Barcode Scanner ─────────────────────────────────────────────────────
// ── Inventory Cache ───────────────────────────────────────────────────────────
async function loadInventoryCache() {
    try {
        const res = await fetch(SCRIPT_URL + '?action=listinventory');
        const data = await res.json();
        window._inventoryCache = data.items || [];
    } catch (_) {}
}

// ── Scanner / Search ──────────────────────────────────────────────────────────
// USB scanner: fires a rapid burst of keydown events then Enter, while no input is focused.
// Manual typing: user types in #saleScanner, dropdown narrows results, Enter adds top match.

let _scanBuffer = ''; let _scanTimer = null;

document.addEventListener('keydown', function(e) {
    if (!document.getElementById('saleModal')?.classList.contains('open')) return;
    const focused = document.activeElement;
    if (focused && focused.id === 'saleScanner') return; // handled by onScannerKey
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return;
    if (e.key === 'Enter' && _scanBuffer.length > 1) {
        addItemByBarcode(_scanBuffer.trim());
        _scanBuffer = ''; return;
    }
    if (e.key.length === 1) {
        _scanBuffer += e.key;
        clearTimeout(_scanTimer);
        _scanTimer = setTimeout(() => { _scanBuffer = ''; }, 80);
    }
});

function onScannerInput() {
    const q = (document.getElementById('saleScanner').value || '').trim().toLowerCase();
    const box = document.getElementById('scannerResults');
    if (!q) { box.style.display = 'none'; return; }
    const inv = window._inventoryCache || [];
    const matches = inv.filter(i =>
        String(i.sku).toLowerCase().includes(q) || (i.name || '').toLowerCase().includes(q)
    ).slice(0, 8);
    if (!matches.length) {
        box.style.display = 'block';
        box.innerHTML = '<div style="padding:10px 14px;font-size:0.8rem;color:var(--text-dim);">No match — press Enter to add manually</div>';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = matches.map(i =>
        '<div onclick="addItemFromResult(\'' + escH(String(i.sku)) + '\')" '
        + 'style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--glass-border);" '
        + 'onmouseover="this.style.background=\'rgba(37,99,235,0.08)\'" onmouseout="this.style.background=\'\'">'
        + '<span><strong>' + escH(i.name) + '</strong> <span style="color:var(--text-dim);font-size:0.75rem;">' + escH(String(i.sku)) + '</span></span>'
        + '<span style="font-weight:800;color:var(--success);">' + bz(i.salePrice) + '</span>'
        + '</div>'
    ).join('');
}

function onScannerKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = (document.getElementById('saleScanner').value || '').trim();
    if (!q) return;
    const inv = window._inventoryCache || [];
    // Exact SKU or exact name match
    const exact = inv.find(i => String(i.sku).toLowerCase() === q.toLowerCase() || (i.name || '').toLowerCase() === q.toLowerCase());
    if (exact) { addItemFromResult(exact.sku); return; }
    // Partial match — take the first result
    const partial = inv.find(i => String(i.sku).toLowerCase().includes(q.toLowerCase()) || (i.name || '').toLowerCase().includes(q.toLowerCase()));
    if (partial) { addItemFromResult(partial.sku); return; }
    // Nothing found — add as manual entry
    addItemByBarcode(q);
}

function addItemFromResult(sku) {
    const item = (window._inventoryCache || []).find(i => String(i.sku) === String(sku));
    if (!item) return;
    addSaleLine(item.name, 1, item.salePrice || 0, item.sku);
    updateSaleTotal();
    document.getElementById('saleScanner').value = '';
    document.getElementById('scannerResults').style.display = 'none';
    if (typeof haptic === 'function') haptic('success');
    document.getElementById('saleScanner').focus();
}

function addItemByBarcode(barcode) {
    const item = (window._inventoryCache || []).find(i => String(i.sku) === String(barcode));
    if (item) { addItemFromResult(item.sku); return; }
    addSaleLine(barcode, 1, '', barcode);
    updateSaleTotal();
    document.getElementById('saleScanner').value = '';
    document.getElementById('scannerResults').style.display = 'none';
    showToast('Unknown item — enter price manually', '');
    document.getElementById('saleScanner').focus();
}

// ── Sale Modal ────────────────────────────────────────────────────────────────
function openSaleModal() {
    document.getElementById('saleScanner').value = '';
    document.getElementById('scannerResults').style.display = 'none';
    document.getElementById('saleLineItems').innerHTML = '';
    document.getElementById('pm-cash').checked = true;
    document.getElementById('partialAmountGroup').style.display = 'none';
    document.getElementById('cashTenderedGroup').style.display = 'block';
    document.getElementById('saleCashTendered').value = '';
    const disp = document.getElementById('saleChangeDisplay');
    if (disp) disp.style.display = 'none';
    document.getElementById('saleSubmitBtn').disabled = false;
    document.getElementById('saleSubmitBtn').textContent = 'Complete Sale';
    updateSaleTotal();
    openModal('saleModal');
    if (!window._inventoryCache) loadInventoryCache();
    setTimeout(() => document.getElementById('saleScanner').focus(), 300);
}

function addSaleLine(name, qty, price, sku) {
    name = name || ''; qty = qty || 1; price = price || ''; sku = sku || '';
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.dataset.sku = sku;
    row.style.position = 'relative';
    const dropId = 'ac-' + Date.now() + Math.random().toString(36).slice(2);
    row.innerHTML =
        '<div style="position:relative;flex:1;">'
        + '<input class="line-input" type="text" placeholder="Item name..." value="' + escH(name) + '" autocomplete="off"'
        + ' oninput="saleLineAutocomplete(this,\'' + dropId + '\')" onblur="setTimeout(()=>{const d=document.getElementById(\'' + dropId + '\');if(d)d.style.display=\'none\';},250)">'
        + '<div id="' + dropId + '" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:500;background:var(--glass-strong);border:1px solid var(--glass-border);border-radius:10px;box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto;"></div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:0;border:1px solid var(--glass-border);border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--glass);">'
        + '<button type="button" onclick="adjustLineQty(this,-1)" style="width:30px;height:38px;border:none;background:transparent;color:var(--text-dim);font-size:1.1rem;cursor:pointer;font-weight:700;flex-shrink:0;">−</button>'
        + '<input type="number" value="' + qty + '" min="1" style="width:36px;height:38px;border:none;border-left:1px solid var(--glass-border);border-right:1px solid var(--glass-border);border-radius:0;padding:0;text-align:center;background:transparent;color:var(--text-main);font-family:inherit;font-size:0.88rem;font-weight:700;outline:none;" oninput="updateSaleTotal()">'
        + '<button type="button" onclick="adjustLineQty(this,1)" style="width:30px;height:38px;border:none;background:transparent;color:var(--text-dim);font-size:1.1rem;cursor:pointer;font-weight:700;flex-shrink:0;">+</button>'
        + '</div>'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateSaleTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateSaleTotal()">&#x2715;</button>';
    document.getElementById('saleLineItems').appendChild(row);
    row.querySelector('input[type="text"]').addEventListener('input', updateSaleTotal);
}

function adjustLineQty(btn, delta) {
    const qtyInput = btn.parentElement.querySelector('input[type="number"]');
    const current  = parseInt(qtyInput.value) || 1;
    qtyInput.value = Math.max(1, current + delta);
    updateSaleTotal();
}

function saleLineAutocomplete(input, dropId) {
    const q   = (input.value || '').trim().toLowerCase();
    const box = document.getElementById(dropId);
    if (!box) return;
    if (!q) { box.style.display = 'none'; return; }
    // Load cache if not ready yet
    if (!window._inventoryCache || !window._inventoryCache.length) {
        loadInventoryCache().then(() => saleLineAutocomplete(input, dropId));
        return;
    }
    const inv = window._inventoryCache || [];
    const matches = inv.filter(i =>
        (i.name || '').toLowerCase().includes(q) || String(i.sku).toLowerCase().includes(q)
    ).slice(0, 8);
    if (!matches.length) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = matches.map(i =>
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--glass-border);"'
        + ' onmousedown="saleLineSelect(this,\'' + escH(String(i.sku)) + '\',\'' + dropId + '\')"'
        + ' onmouseover="this.style.background=\'rgba(37,99,235,0.08)\'" onmouseout="this.style.background=\'\'">'
        + '<span><strong>' + escH(i.name) + '</strong> <span style="color:var(--text-dim);font-size:0.72rem;">' + escH(String(i.sku)) + '</span></span>'
        + '<span style="font-weight:800;color:var(--success);font-size:0.82rem;">' + bz(i.salePrice) + '</span>'
        + '</div>'
    ).join('');
}

function saleLineSelect(el, sku, dropId) {
    const item = (window._inventoryCache || []).find(i => String(i.sku) === String(sku));
    if (!item) return;
    const row = el.closest('.line-item-row');
    if (!row) return;
    row.dataset.sku = sku;
    const inputs = row.querySelectorAll('input');
    inputs[0].value = item.name;
    inputs[2].value = item.salePrice || '';
    updateSaleTotal();
    const box = document.getElementById(dropId);
    if (box) box.style.display = 'none';
}

function updateSaleTotal() {
    let total = 0;
    document.querySelectorAll('#saleLineItems .line-item-row').forEach(r => {
        const i = r.querySelectorAll('input');
        total += (parseFloat(i[1].value) || 0) * (parseFloat(i[2].value) || 0);
    });
    document.getElementById('saleTotalDisplay').textContent = bz(total);
    // Keep tendered in sync with total for cash — unless cashier has entered more than total (giving change)
    const method = document.querySelector('input[name="saleMethod"]:checked')?.value || 'cash';
    if (method === 'cash') {
        const field    = document.getElementById('saleCashTendered');
        const tendered = parseFloat(field?.value) || 0;
        // Only auto-update if tendered equals the previous total (i.e. cashier hasn't overridden it)
        if (field && (tendered === 0 || tendered <= total)) {
            field.value = total > 0 ? total.toFixed(2) : '';
        }
        calcSaleChange();
    }
}

function togglePartialField() {
    const method = document.querySelector('input[name="saleMethod"]:checked')?.value || 'cash';
    document.getElementById('partialAmountGroup').style.display  = method === 'partial' ? 'block' : 'none';
    document.getElementById('cashTenderedGroup').style.display   = method === 'cash'    ? 'block' : 'none';
    if (method === 'cash') {
        // Default tendered to the current total
        const total = parseFloat(document.getElementById('saleTotalDisplay').textContent.replace('BZ$','')) || 0;
        const field = document.getElementById('saleCashTendered');
        if (field && !field.value) field.value = total > 0 ? total.toFixed(2) : '';
        calcSaleChange();
    } else {
        const disp = document.getElementById('saleChangeDisplay');
        if (disp) disp.style.display = 'none';
    }
}

function calcSaleChange() {
    const total    = parseFloat(document.getElementById('saleTotalDisplay').textContent.replace('BZ$','')) || 0;
    const tendered = parseFloat(document.getElementById('saleCashTendered').value) || 0;
    const disp     = document.getElementById('saleChangeDisplay');
    if (!disp) return;
    if (!tendered || total <= 0) { disp.style.display = 'none'; return; }
    const change = tendered - total;
    disp.style.display = 'block';
    if (change < 0) {
        disp.style.cssText = 'display:block;margin-top:8px;padding:10px 14px;border-radius:10px;font-size:0.95rem;font-weight:800;text-align:center;background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);';
        disp.textContent = '⚠️ Short by BZ$' + Math.abs(change).toFixed(2);
    } else {
        disp.style.cssText = 'display:block;margin-top:8px;padding:10px 14px;border-radius:10px;font-size:0.95rem;font-weight:800;text-align:center;background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2);';
        disp.textContent = change < 0.01 ? '✓ Exact — no change' : '💵 Change: BZ$' + change.toFixed(2);
    }
}

async function submitSale() {
    const rows = document.querySelectorAll('#saleLineItems .line-item-row');
    const items = [];
    rows.forEach(r => {
        const i = r.querySelectorAll('input');
        const name = i[0].value.trim();
        const qty  = parseFloat(i[1].value) || 1;
        const price = parseFloat(i[2].value) || 0;
        const sku  = r.dataset.sku || '';
        if (name) items.push({ name, qty, price, total: qty * price, sku });
    });
    if (!items.length) { alert('Add at least one item.'); return; }
    const total      = items.reduce((t, i) => t + i.total, 0);
    const method     = document.querySelector('input[name="saleMethod"]:checked').value;
    let amountPaid;
    if (method === 'partial') {
        amountPaid = parseFloat(document.getElementById('salePartialAmount').value) || 0;
        if (amountPaid <= 0) { showToast('Enter the partial amount paid.', 'err'); return; }
    } else if (method === 'cash') {
        const tendered = parseFloat(document.getElementById('saleCashTendered').value) || 0;
        amountPaid = tendered > 0 ? tendered : total; // use tendered if entered, else total
    } else {
        amountPaid = total;
    }
    const btn = document.getElementById('saleSubmitBtn');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
        const params = new URLSearchParams({
            action: 'createsale',
            items: JSON.stringify(items), total, method, amountPaid,
            shiftDate: getShiftDate(), shift: getCurrentShift() ? getCurrentShift().label : 'Unknown', cashier: currentUser
        });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('saleModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Sale recorded!', 'ok');
            printReceipt(items, total, amountPaid, method, data.saleId, '');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Complete Sale'; alert('❌ ' + (data.error || 'Could not save.')); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Complete Sale'; alert('Connection error.'); }
}

// ── Job Pickup ────────────────────────────────────────────────────────────────
function openJobPickupModal() {
    document.getElementById('jobSearch').value = '';
    document.getElementById('jobSearchResults').innerHTML = '';
    document.getElementById('jobSelected').style.display = 'none';
    document.getElementById('jobPaymentSection').style.display = 'none';
    document.getElementById('jobPickupBtn').style.display = 'none';
    document.getElementById('jobInvoiceAmount').value = '';
    document.getElementById('jpm-cash').checked = true;
    document.getElementById('jobPartialGroup').style.display = 'none';
    document.getElementById('jobBalanceDisplay').style.display = 'none';
    selectedJobId = null;
    openModal('jobPickupModal');
    ensureJobsLoaded();
    setTimeout(() => document.getElementById('jobSearch').focus(), 300);
}

function searchJobs() {
    const q = document.getElementById('jobSearch').value.trim().toLowerCase();
    const results = document.getElementById('jobSearchResults');
    if (!q) { results.innerHTML = ''; return; }
    const matches = allJobs.filter(j =>
        (j.payStatus || '').toLowerCase() !== 'paid' &&
        (String(j.id || '').includes(q) || (j.customerName || '').toLowerCase().includes(q))
    ).slice(0, 6);
    if (!matches.length) { results.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim);padding:8px 0;">No unpaid jobs found.</div>'; return; }
    results.innerHTML = matches.map(j =>
        '<div class="job-result-item" onclick="selectJob(\'' + escH(String(j.id)) + '\')">'
        + '<strong>#' + escH(String(j.id)) + '</strong> — ' + escH(j.customerName || 'Walk-in') + ' · ' + escH(j.device || '—') + '</div>'
    ).join('');
}

function selectJob(id) {
    const j = allJobs.find(x => String(x.id) === String(id));
    if (!j) return;
    selectedJobId = id;
    document.getElementById('jobSearchResults').innerHTML = '';
    document.getElementById('jobSearch').value = '#' + j.id + ' — ' + (j.customerName || '');
    const sel = document.getElementById('jobSelected');
    sel.innerHTML = '<strong>#' + escH(String(j.id)) + '</strong> · ' + escH(j.customerName || '—') + ' · ' + escH(j.device || '—') + ' · ' + escH(j.status || '—');
    sel.style.display = 'block';
    const invoiceItems = tryParseJSON(j.invoiceItems, []);
    const total = invoiceItems.reduce((t, i) => t + (parseFloat(i.price) || 0), 0);
    document.getElementById('jobInvoiceAmount').value = total > 0 ? total.toFixed(2) : (j.invoiceAmount || '');
    document.getElementById('jobPaymentSection').style.display = 'block';
    document.getElementById('jobPickupBtn').style.display = 'inline-flex';
    calcJobBalance();
}

function toggleJobPartial() {
    document.getElementById('jobPartialGroup').style.display = document.getElementById('jpm-partial').checked ? 'block' : 'none';
    calcJobBalance();
}

function calcJobBalance() {
    const total   = parseFloat(document.getElementById('jobInvoiceAmount').value) || 0;
    const method  = (document.querySelector('input[name="jobMethod"]:checked') || {}).value || 'cash';
    const paid    = method === 'partial' ? (parseFloat(document.getElementById('jobPartialAmount').value) || 0) : total;
    const balance = total - paid;
    const disp    = document.getElementById('jobBalanceDisplay');
    if (total <= 0) { disp.style.display = 'none'; return; }
    disp.style.display = 'block';
    if (balance <= 0.01) {
        disp.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:700;margin-bottom:14px;background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2);';
        disp.textContent = '✓ Fully paid — device can be released';
    } else {
        disp.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:700;margin-bottom:14px;background:rgba(245,158,11,0.1);color:#d97706;border:1px solid rgba(245,158,11,0.2);';
        disp.textContent = 'Partial — ' + bz(balance) + ' remaining. Device stays until fully paid.';
    }
}

async function submitJobPickup() {
    if (!selectedJobId) return;
    const total      = parseFloat(document.getElementById('jobInvoiceAmount').value) || 0;
    const method     = (document.querySelector('input[name="jobMethod"]:checked') || {}).value || 'cash';
    const amountPaid = method === 'partial' ? (parseFloat(document.getElementById('jobPartialAmount').value) || 0) : total;
    const balance    = total - amountPaid;
    if (method === 'partial' && balance > 0.01)
        if (!confirm('Customer still owes ' + bz(balance) + '. Device will NOT be released. Continue?')) return;
    const btn = document.getElementById('jobPickupBtn');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
        const j = allJobs.find(x => String(x.id) === String(selectedJobId));
        const params = new URLSearchParams({
            action: 'createsale', customer: j ? (j.customerName || '') : '',
            items: JSON.stringify([{ name: 'Job #' + selectedJobId + ' — ' + (j ? (j.device || 'Repair') : 'Repair'), qty: 1, price: total, total }]),
            total, method, amountPaid, jobId: selectedJobId,
            shiftDate: getShiftDate(), shift: getCurrentShift() ? getCurrentShift().label : 'Unknown', cashier: currentUser
        });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            const payStatus    = balance <= 0.01 ? 'paid' : 'partial';
            const updateParams = new URLSearchParams({ action: 'update', id: selectedJobId, payStatus });
            if (balance <= 0.01) updateParams.set('status', 'resolved');
            await fetch(SCRIPT_URL, { method: 'POST', body: updateParams });
            closeModal('jobPickupModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Payment collected!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = '✓ Collect Payment'; alert('❌ ' + (data.error || 'Error')); }
    } catch (e) { btn.disabled = false; btn.textContent = '✓ Collect Payment'; alert('Connection error.'); }
}

// ── Payout ────────────────────────────────────────────────────────────────────
function openPayoutModal() {
    document.getElementById('payoutAmount').value = '';
    document.getElementById('payoutReason').value = '';
    document.getElementById('payoutTakenBy').value = '';
    document.getElementById('payoutSubmitBtn').disabled = false;
    document.getElementById('payoutSubmitBtn').textContent = 'Log Payout';
    openModal('payoutModal');
    setTimeout(() => document.getElementById('payoutAmount').focus(), 300);
}

async function submitPayout() {
    const amount = parseFloat(document.getElementById('payoutAmount').value);
    const reason = document.getElementById('payoutReason').value.trim();
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    if (!reason) { alert('Enter a reason.'); return; }
    const btn = document.getElementById('payoutSubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const params = new URLSearchParams({
            action: 'createpayout', amount, reason,
            takenBy: document.getElementById('payoutTakenBy').value.trim(),
            loggedBy: currentUser, shiftDate: getShiftDate(),
            shift: getCurrentShift() ? getCurrentShift().label : 'Unknown'
        });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('payoutModal');
            if (typeof haptic === 'function') haptic('success');
            if (typeof sendNotification === 'function')
                sendNotification('manageronly', '💸 Payout Logged', currentUser + ' logged a ' + bz(amount) + ' payout: ' + reason);
            showToast('Payout logged!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Log Payout'; alert('❌ ' + (data.error || 'Error')); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Log Payout'; alert('Connection error.'); }
}

// ── Bills ─────────────────────────────────────────────────────────────────────
function openBillModal() {
    document.getElementById('billPerson').value = '';
    document.getElementById('billLineItems').innerHTML = '';
    document.getElementById('billSubmitBtn').disabled = false;
    document.getElementById('billSubmitBtn').textContent = 'Open Bill';
    addBillLine(); updateBillTotal(); openModal('billModal');
}

function addBillLine(name, qty, price) {
    name = name || ''; qty = qty || 1; price = price || '';
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.innerHTML =
        '<input class="line-input" type="text" placeholder="Item name..." value="' + escH(name) + '" oninput="updateBillTotal()">'
        + '<input class="line-input" type="number" placeholder="Qty" value="' + qty + '" min="1" style="text-align:center;" oninput="updateBillTotal()">'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateBillTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateBillTotal()">✕</button>';
    document.getElementById('billLineItems').appendChild(row);
}

function updateBillTotal() {
    let total = 0;
    document.querySelectorAll('#billLineItems .line-item-row').forEach(r => {
        const i = r.querySelectorAll('input');
        total += (parseFloat(i[1].value) || 0) * (parseFloat(i[2].value) || 0);
    });
    document.getElementById('billTotalDisplay').textContent = bz(total);
}

async function submitBill() {
    const person = document.getElementById('billPerson').value.trim();
    if (!person) { alert('Enter a person name.'); return; }
    const rows = document.querySelectorAll('#billLineItems .line-item-row');
    const items = [];
    rows.forEach(r => {
        const i = r.querySelectorAll('input');
        const name = i[0].value.trim(); const qty = parseFloat(i[1].value) || 1; const price = parseFloat(i[2].value) || 0;
        if (name) items.push({ name, qty, price, total: qty * price });
    });
    if (!items.length) { alert('Add at least one item.'); return; }
    const total = items.reduce((t, i) => t + i.total, 0);
    const btn = document.getElementById('billSubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const params = new URLSearchParams({
            action: 'createbill', personName: person, items: JSON.stringify(items),
            totalOwed: total, cashier: currentUser, shiftDate: getShiftDate()
        });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('billModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill opened!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Open Bill'; alert('❌ ' + (data.error || 'Error')); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Open Bill'; alert('Connection error.'); }
}

// ── Edit Bill ─────────────────────────────────────────────────────────────────
let _editingBillId = null;

function openEditBill(billId) {
    const b = allBills.find(x => String(x.billId) === String(billId));
    if (!b) return;
    _editingBillId = billId;
    document.getElementById('editBillPerson').value = b.personName || '';
    document.getElementById('editBillLineItems').innerHTML = '';
    document.getElementById('editBillSubmitBtn').disabled = false;
    document.getElementById('editBillSubmitBtn').textContent = 'Save Changes';
    const items = tryParseJSON(b.items, []);
    if (items.length) items.forEach(i => addEditBillLine(i.name, i.qty, i.price));
    else addEditBillLine();
    updateEditBillTotal();
    openModal('editBillModal');
}

function addEditBillLine(name, qty, price) {
    name = name || ''; qty = qty || 1; price = price || '';
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.innerHTML =
        '<input class="line-input" type="text" placeholder="Item name..." value="' + escH(name) + '" oninput="updateEditBillTotal()">'
        + '<input class="line-input" type="number" placeholder="Qty" value="' + qty + '" min="1" style="text-align:center;" oninput="updateEditBillTotal()">'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateEditBillTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateEditBillTotal()">&#x2715;</button>';
    document.getElementById('editBillLineItems').appendChild(row);
}

function updateEditBillTotal() {
    let total = 0;
    document.querySelectorAll('#editBillLineItems .line-item-row').forEach(r => {
        const i = r.querySelectorAll('input');
        total += (parseFloat(i[1].value) || 0) * (parseFloat(i[2].value) || 0);
    });
    document.getElementById('editBillTotalDisplay').textContent = bz(total);
}

async function submitEditBill() {
    if (!_editingBillId) return;
    const person = document.getElementById('editBillPerson').value.trim();
    if (!person) { alert('Enter a person name.'); return; }
    const rows = document.querySelectorAll('#editBillLineItems .line-item-row');
    const items = [];
    rows.forEach(r => {
        const i = r.querySelectorAll('input');
        const name = i[0].value.trim(); const qty = parseFloat(i[1].value) || 1; const price = parseFloat(i[2].value) || 0;
        if (name) items.push({ name, qty, price, total: qty * price });
    });
    if (!items.length) { alert('Add at least one item.'); return; }
    const total = items.reduce((t, i) => t + i.total, 0);
    const btn = document.getElementById('editBillSubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const params = new URLSearchParams({
            action: 'updatebill', billId: _editingBillId,
            personName: person, items: JSON.stringify(items),
            totalOwed: total, cashier: currentUser
        });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('editBillModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill updated!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Save Changes'; alert('❌ ' + (data.error || 'Error')); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Save Changes'; alert('Connection error.'); }
}

// ── Settle Bill ───────────────────────────────────────────────────────────────
function openSettleBill(billId) {
    const b = allBills.find(x => String(x.billId) === String(billId));
    if (!b) return;
    settlingBillId = billId;
    const balance = Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0));
    document.getElementById('settleBillInfo').innerHTML =
        '<strong>' + escH(b.personName || 'Unknown') + '</strong>'
        + '<br>Total: ' + bz(b.totalOwed) + ' &nbsp;•&nbsp; Paid: ' + bz(b.totalPaid)
        + ' &nbsp;•&nbsp; <strong>Remaining: ' + bz(balance) + '</strong>';
    document.getElementById('settleAmount').value = balance.toFixed(2);
    document.getElementById('sm-cash').checked = true;
    document.getElementById('settleSubmitBtn').disabled = false;
    document.getElementById('settleSubmitBtn').textContent = 'Settle';
    calcSettleBalance(); openModal('settleBillModal');
}

function calcSettleBalance() {
    const b = allBills.find(x => String(x.billId) === String(settlingBillId));
    if (!b) return;
    const balance   = Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0));
    const paying    = parseFloat(document.getElementById('settleAmount').value) || 0;
    const remaining = balance - paying;
    const disp      = document.getElementById('settleBalanceDisplay');
    if (!paying) { disp.style.display = 'none'; return; }
    disp.style.display = 'block';
    if (remaining <= 0.01) {
        disp.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:700;margin-bottom:14px;background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2);';
        disp.textContent = '✓ Bill fully settled!';
    } else {
        disp.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:700;margin-bottom:14px;background:rgba(245,158,11,0.1);color:#d97706;border:1px solid rgba(245,158,11,0.2);';
        disp.textContent = bz(remaining) + ' still remaining after this payment.';
    }
}

async function submitSettle() {
    if (!settlingBillId) return;
    const amount = parseFloat(document.getElementById('settleAmount').value);
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    const method = document.querySelector('input[name="settleMethod"]:checked').value;
    const btn = document.getElementById('settleSubmitBtn');
    btn.disabled = true; btn.textContent = 'Settling...';
    try {
        const params = new URLSearchParams({ action: 'settlebill', billId: settlingBillId, amount, payMethod: method, cashier: currentUser });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('settleBillModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill settled!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Settle'; alert('❌ ' + (data.error || 'Error')); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Settle'; alert('Connection error.'); }
}

// ── View Sale ─────────────────────────────────────────────────────────────────
let _viewedSale = null;

function openViewSale(saleId) {
    const s = allSales.find(x => String(x.saleId) === String(saleId));
    if (!s) return;
    _viewedSale = s;
    const items  = tryParseJSON(s.items, []);
    const ts     = s.timestamp ? new Date(s.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const change = s.method === 'cash' ? Math.max(0, (parseFloat(s.amountPaid)||0) - (parseFloat(s.total)||0)) : 0;
    const statusBadge = s.status === 'reversed' ? 'reversed' : s.method === 'partial' ? 'partial' : 'paid';
    const statusLabel = s.status === 'reversed' ? 'Reversed' : s.method === 'partial' ? 'Partial' : 'Paid';
    const itemRows = items.map(i =>
        '<tr>'
        + '<td style="font-weight:600;">' + escH(i.name || '—') + '</td>'
        + '<td style="color:var(--text-dim);">×' + (i.qty || 1) + '</td>'
        + '<td>' + bz(i.price) + '</td>'
        + '<td style="font-weight:800;">' + bz((i.qty||1) * (i.price||0)) + '</td>'
        + '</tr>'
    ).join('');
    document.getElementById('viewSaleContent').innerHTML =
        '<div class="receipt-header">'
        + '<h3>ServiCell Belize</h3>'
        + '<p>' + escH(ts) + '</p>'
        + '<p>Receipt #<strong>' + escH(s.saleId || '') + '</strong></p>'
        + '</div>'
        + '<div class="receipt-meta">'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Cashier</div><div class="receipt-meta-value">' + escH(s.cashier || '—') + '</div></div>'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Shift</div><div class="receipt-meta-value">' + escH(s.shift || '—') + '</div></div>'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Method</div><div class="receipt-meta-value">' + escH(s.method || 'cash') + '</div></div>'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Status</div><div class="receipt-meta-value"><span class="receipt-badge ' + statusBadge + '">' + statusLabel + '</span></div></div>'
        + '</div>'
        + '<table class="receipt-items">'
        + '<tr><th style="text-align:left;">Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>'
        + itemRows
        + '</table>'
        + '<div class="receipt-totals">'
        + '<div class="receipt-total-row"><span style="color:var(--text-dim);">Subtotal</span><span>' + bz(s.total) + '</span></div>'
        + '<div class="receipt-total-row"><span style="color:var(--text-dim);">Paid</span><span>' + bz(s.amountPaid) + '</span></div>'
        + (change > 0 ? '<div class="receipt-total-row"><span style="color:var(--text-dim);">Change</span><span>' + bz(change) + '</span></div>' : '')
        + '<div class="receipt-total-row main"><span>Net</span><span>' + bz(s.amountPaid) + '</span></div>'
        + '</div>';
    openModal('viewSaleModal');
}

function printViewedSale() {
    if (!_viewedSale) return;
    const s     = _viewedSale;
    const items = tryParseJSON(s.items, []);
    kickDrawer();
    const html  = buildSaleReceiptHTML(
        items,
        parseFloat(s.total) || 0,
        parseFloat(s.amountPaid) || 0,
        s.method || 'cash',
        s.saleId || '',
        s.customer || '',
        s.cashier || ''
    );
    printHTML(html);
}

// ── Edit Sale ─────────────────────────────────────────────────────────────────
function openEditSale(saleId) {
    const s = allSales.find(x => String(x.saleId) === String(saleId));
    if (!s) return;
    editingSaleId = saleId;
    document.getElementById('editSaleCustomer').value = s.customer || '';
    document.getElementById('editSaleLineItems').innerHTML = '';
    document.getElementById('editSaleSubmitBtn').disabled = false;
    document.getElementById('editSaleSubmitBtn').textContent = 'Save Changes';
    const items = tryParseJSON(s.items, []);
    if (items.length) items.forEach(i => addEditSaleLine(i.name, i.qty, i.price));
    else addEditSaleLine();
    updateEditSaleTotal(); openModal('editSaleModal');
}

function addEditSaleLine(name, qty, price) {
    name = name || ''; qty = qty || 1; price = price || '';
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.innerHTML =
        '<input class="line-input" type="text" placeholder="Item name..." value="' + escH(name) + '" oninput="updateEditSaleTotal()">'
        + '<input class="line-input" type="number" placeholder="Qty" value="' + qty + '" min="1" style="text-align:center;" oninput="updateEditSaleTotal()">'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateEditSaleTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateEditSaleTotal()">✕</button>';
    document.getElementById('editSaleLineItems').appendChild(row);
}

function updateEditSaleTotal() {
    let total = 0;
    document.querySelectorAll('#editSaleLineItems .line-item-row').forEach(r => {
        const i = r.querySelectorAll('input');
        total += (parseFloat(i[1].value) || 0) * (parseFloat(i[2].value) || 0);
    });
    document.getElementById('editSaleTotalDisplay').textContent = bz(total);
}

async function submitEditSale() {
    if (!editingSaleId) return;
    const rows = document.querySelectorAll('#editSaleLineItems .line-item-row');
    const items = [];
    rows.forEach(r => {
        const i = r.querySelectorAll('input');
        const name = i[0].value.trim(); const qty = parseFloat(i[1].value) || 1; const price = parseFloat(i[2].value) || 0;
        if (name) items.push({ name, qty, price, total: qty * price });
    });
    if (!items.length) { alert('Add at least one item.'); return; }
    const total = items.reduce((t, i) => t + i.total, 0);
    const btn = document.getElementById('editSaleSubmitBtn');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const params = new URLSearchParams({
            action: 'updatesale', saleId: editingSaleId,
            customer: document.getElementById('editSaleCustomer').value.trim(),
            items: JSON.stringify(items), total, cashier: currentUser
        });
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('editSaleModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Sale updated!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Save Changes'; alert('❌ ' + (data.error || 'Error')); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Save Changes'; alert('Connection error.'); }
}

// ── Reverse Sale ──────────────────────────────────────────────────────────────
let _reversingSaleId = null;

function reverseSale(saleId) {
    const s = allSales.find(x => String(x.saleId) === String(saleId));
    if (!s) return;
    _reversingSaleId = saleId;
    const items = tryParseJSON(s.items, []);
    const desc  = items.map(i => i.name).join(', ') || 'Sale';
    document.getElementById('reverseSaleInfo').innerHTML =
        '<strong>' + escH(desc) + '</strong>'
        + '<br>Amount: ' + bz(s.amountPaid)
        + ' &nbsp;&bull;&nbsp; Method: ' + escH(s.method || 'cash')
        + (s.cashier ? ' &nbsp;&bull;&nbsp; By: ' + escH(s.cashier) : '');
    document.getElementById('reverseReason').value = '';
    document.getElementById('reverseSubmitBtn').disabled = false;
    document.getElementById('reverseSubmitBtn').textContent = '↩️ Confirm Reversal';
    openModal('reverseSaleModal');
    setTimeout(() => document.getElementById('reverseReason').focus(), 300);
}

async function submitReverse() {
    if (!_reversingSaleId) return;
    const reason = document.getElementById('reverseReason').value.trim();
    if (!reason) { alert('Please enter a reason for the reversal.'); return; }
    const btn = document.getElementById('reverseSubmitBtn');
    btn.disabled = true; btn.textContent = 'Reversing...';
    try {
        const params = new URLSearchParams({ action: 'reversesale', saleId: _reversingSaleId, reason, cashier: currentUser });
        const res  = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const data = await res.json();
        if (data.success) {
            closeModal('reverseSaleModal');
            if (typeof haptic === 'function') haptic('medium');
            showToast('Sale reversed.', '');
            await loadAll();
        } else {
            btn.disabled = false; btn.textContent = '↩️ Confirm Reversal';
            alert('❌ ' + (data.error || 'Could not reverse.'));
        }
    } catch (e) {
        btn.disabled = false; btn.textContent = '↩️ Confirm Reversal';
        alert('Connection error.');
    }
}

// ── Deduct Inventory ──────────────────────────────────────────────────────────
async function deductInventory(sku, qty, saleId) {
    try {
        const params = new URLSearchParams({ action: 'adjuststock', sku, qty, type: 'remove', reason: 'Sale #' + saleId, saleId });
        await fetch(SCRIPT_URL, { method: 'POST', body: params });
    } catch (e) { console.warn('Inventory deduct failed:', e); }
}

// ── Receipt Printing ──────────────────────────────────────────────────────────
function printReceipt(items, total, amountPaid, method, saleId, customer) {
    if (localStorage.getItem('scAutoPrintReceipt') !== '1') return;
    kickDrawer();
    const html = buildSaleReceiptHTML(items, total, amountPaid, method, saleId, customer, currentUser);
    printHTML(html);
}

// ── Modal Helpers ─────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open');    document.body.classList.add('modal-open'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    // Only remove scroll lock if no other modals are open
    if (!document.querySelector('.modal-overlay.open')) {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
    }
}
function handleOverlay(e, id) { if (e.target === document.getElementById(id)) closeModal(id); }

// ── Sync State ────────────────────────────────────────────────────────────────
function setSyncState(state, text) {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    if (dot) dot.className = 'sync-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
    if (txt) txt.textContent = text;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type) {
    const el = document.getElementById('toastEl');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    currentUser = localStorage.getItem('scUser') || sessionStorage.getItem('scUser') || 'Cashier';
    isManager   = currentUser.toLowerCase().startsWith('manager');
    // Set date filter to today by default
    const dateInput = document.getElementById('salesDateFilter');
    if (dateInput) dateInput.value = getShiftDate();
    // Responsive tabs — use dropdown on narrow screens
    function syncTabLayout() {
        const isMobile = window.innerWidth < 540;
        const bar = document.getElementById('tabBar');
        const sel = document.getElementById('tabSelect');
        if (bar) bar.style.display = isMobile ? 'none' : '';
        if (sel) sel.style.display = isMobile ? 'block' : 'none';
    }
    syncTabLayout();
    window.addEventListener('resize', () => debounce('resize', syncTabLayout, 100));
    loadAll();
    updateShiftBanner();
    setInterval(updateShiftBanner, 60000);
});

window.addEventListener('sc-back-online', function () { loadAll(); });