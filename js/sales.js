// -----------------------------------------------------------------------------
// sales.js — ServiCell Belize Sales Page
// -----------------------------------------------------------------------------

// SCRIPT_URL and API functions (apiGet, apiPost, apiPostAsync) are now provided by js/api.js
// No need to redefine them here - they are globally available

// -- State ---------------------------------------------------------------------
let currentUser    = '';
let isManager      = false;
let allSales       = [];
let allPayouts     = [];
let allBills       = [];
let allJobs        = [];
let editingSaleId  = null;
let settlingBillId = null;
let selectedJobId  = null;

// -- Utilities -----------------------------------------------------------------
function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }

// -- Perf: reuse a single element for HTML escaping ----------------------------
const _escDiv = document.createElement('div');
function escH(s) { _escDiv.textContent = String(s || ''); return _escDiv.innerHTML; }

// -- Perf: debounce helper for search inputs -----------------------------------
const _debounceTimers = {};
function debounce(key, fn, ms) {
    clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(fn, ms);
}

function tryParseJSON(str, fallback) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
}

/** Collected revenue for gross (partial sales count only what was paid). */
function saleCollectedAmount(s) {
    if (!s || s.status === 'reversed') return 0;
    const total = parseFloat(s.total) || 0;
    const paid  = parseFloat(s.amountPaid) || 0;
    if (s.method === 'partial') return paid;
    return total;
}

/** Cash that should be in the drawer from this sale (excludes card). */
function saleDrawerCash(s) {
    if (!s || s.status === 'reversed') return 0;
    if (s.method === 'card') return 0;
    const total = parseFloat(s.total) || 0;
    const paid  = parseFloat(s.amountPaid) || 0;
    if (s.method === 'partial') return paid;
    return total;
}

/** Remaining balance on partial-payment sales. */
function saleOutstanding(s) {
    if (!s || s.status === 'reversed' || s.method !== 'partial') return 0;
    return Math.max(0, (parseFloat(s.total) || 0) - (parseFloat(s.amountPaid) || 0));
}

function sumCollectedSales(sales) {
    return sales.filter(s => s.status !== 'reversed').reduce((t, s) => t + saleCollectedAmount(s), 0);
}

function sumDrawerCash(sales) {
    return sales.filter(s => s.status !== 'reversed').reduce((t, s) => t + saleDrawerCash(s), 0);
}

function sumOutstandingPartial(sales) {
    return sales.filter(s => s.status !== 'reversed').reduce((t, s) => t + saleOutstanding(s), 0);
}

/** GST portion of tax-inclusive (12.5%) gross. */
function gstFromInclusive(gross) {
    return (parseFloat(gross) || 0) * 12.5 / 112.5;
}

function sumCardCollected(sales) {
    return sales
        .filter(s => s.status !== 'reversed' && s.method === 'card')
        .reduce((t, s) => t + saleCollectedAmount(s), 0);
}

/** Single source of truth for shift summary / EOD print / submit. */
function computeEODSummary(sales, payouts) {
    const validSales   = sales.filter(s => s.status !== 'reversed');
    const gross        = sumCollectedSales(validSales);
    const cashSales    = sumDrawerCash(validSales);
    const cardSales    = sumCardCollected(validSales);
    const gstCash      = gstFromInclusive(cashSales);
    const gstCard      = gstFromInclusive(cardSales);
    const gstTotal     = gstCash + gstCard;
    const payoutsTotal = (payouts || []).reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const net          = cashSales - payoutsTotal;
    return {
        validSales, gross, cashSales, cardSales,
        gstCash, gstCard, gstTotal,
        preTax: gross - gstTotal,
        payoutsTotal, net
    };
}

// -- Shift Logic ---------------------------------------------------------------
/** Shop hours: Mon–Fri Morning 8am–3pm, Night 3pm–8pm; Sat 8am–8pm; Sun closed. */
function getCurrentShift() {
    const now = new Date();
    const day = now.getDay();
    const h   = now.getHours() + now.getMinutes() / 60;

    if (day === 0) return null;

    if (day === 6) {
        if (h >= 8 && h < 20) return { label: 'Saturday Shift', start: 8, end: 20 };
        return null;
    }

    if (h >= 8 && h < 15) return { label: 'Morning Shift', start: 8, end: 15 };
    if (h >= 15 && h < 20) return { label: 'Night Shift', start: 15, end: 20 };
    return null;
}

function formatShiftHours(shift) {
    if (!shift) return '';
    const fmt = (hour) => {
        const h = Math.floor(hour);
        const ap = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return h12 + ':00 ' + ap;
    };
    return fmt(shift.start) + ' – ' + fmt(shift.end);
}

function getShiftEndTime(now, shift) {
    const endTime = new Date(now);
    endTime.setHours(shift.end, 0, 0, 0);
    return endTime;
}

function getShiftDate() {
    const d = new Date();
    return d.getFullYear() + '-'
        + String(d.getMonth() + 1).padStart(2, '0') + '-'
        + String(d.getDate()).padStart(2, '0');
}

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
    const endTime  = getShiftEndTime(now, shift);
    const msLeft   = endTime - now;
    const minsLeft = Math.floor(msLeft / 60000);
    const hoursLeft = Math.floor(minsLeft / 60);
    const minsRem   = minsLeft % 60;
    if (label) label.textContent = shift.label + ' (' + formatShiftHours(shift) + ') — ' + getShiftDate();
    status.textContent = shift.label;
    if (minsLeft <= 0) {
        dot.className = 'shift-dot off'; countdown.textContent = 'Shift ended'; countdown.className = 'shift-off';
    } else if (minsLeft <= 30) {
        dot.className = 'shift-dot warn';
        countdown.textContent = 'Shift ends in ' + minsLeft + ' minutes';
        countdown.className = 'shift-warn';
    } else {
        dot.className = 'shift-dot';
        countdown.textContent = hoursLeft > 0 ? (hoursLeft + 'h ' + minsRem + 'm remaining') : (minsLeft + 'm remaining');
        countdown.className = 'shift-time';
    }
}

// -- Tab Switching -------------------------------------------------------------
function switchTab(name) {
    const tabs = ['sales', 'payouts', 'bills', 'eod'];
    document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', tabs[i] === name));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    // Keep dropdown in sync
    const sel = document.getElementById('tabSelect');
    if (sel) sel.value = name;
    if (name === 'eod') { updateEOD(); initEODShiftPills(); }
}

// -- Load All Data -------------------------------------------------------------
async function loadAll() {
    setSyncState('loading', 'Syncing...');
    const date = getShiftDate();
    const [sData, pData, bData, eData] = await Promise.all([
        apiGet({ action: 'listsales', date }).catch(() => ({})),
        apiGet({ action: 'listpayouts', date }).catch(() => ({})),
        apiGet({ action: 'listbills' }).catch(() => ({})),
        apiGet({ action: 'listdaycloses' }).catch(() => ({}))
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
        const d = await apiGet({ action: 'list' });
        allJobs = d.jobs || [];
    } catch (e) {
        console.error('Failed to load jobs:', e);
    }
}

// -- Date Filter & Show Settled ------------------------------------------------
let _currentDateFilter = ''; // Shared across all tabs
let _showSettled       = false;
let _salesPage         = 1;
let _salesPerPage      = 10;

// -- Reusable pagination renderer ---------------------------------------------
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
    _currentDateFilter = document.getElementById('salesDateFilter').value;
    if (_currentDateFilter && _currentDateFilter !== getShiftDate()) {
        setSyncState('loading', 'Loading...');
        const date = _currentDateFilter;
        Promise.all([
            apiGet({ action: 'listsales', date }).catch(() => ({})),
            apiGet({ action: 'listpayouts', date }).catch(() => ({})),
            apiGet({ action: 'listdaycloses' }).catch(() => ({}))
        ]).then(([sData, pData, eData]) => {
            allSales = sData.sales || [];
            allPayouts = pData.payouts || [];
            renderSales();
            renderPayouts();
            updateEOD();
            renderEODHistory(eData.closes || []);
            setSyncState('ok', 'Showing: ' + _currentDateFilter);
        }).catch((e) => {
            console.error('Date filter failed:', e);
            setSyncState('error', 'Failed to load');
        });
    } else {
        _currentDateFilter = '';
        loadAll();
    }
}

function toggleShowSettled() {
    _showSettled = !_showSettled;
    const btn = document.getElementById('showSettledBtn');
    if (btn) {
        const label = _showSettled ? 'Hide Settled' : 'Show Settled';
        btn.innerHTML = typeof scIconLabel === 'function' ? scIconLabel('clipboard', label, 15) : label;
        btn.style.borderColor = _showSettled ? 'var(--primary)' : '';
    }
    renderBills();
}

// Debounced search handlers — called from oninput in the HTML
function onSalesSearch()  { debounce('salesSearch',  renderSales, 50); }
function onBillsSearch()  { debounce('billsSearch',  renderBills, 50); }

// -- Render: Sales -------------------------------------------------------------
function renderSales() {
    const q      = (document.getElementById('salesSearch')?.value || '').trim().toLowerCase();
    const active = allSales.filter(s => s.status !== 'reversed');
    const gross  = sumCollectedSales(active);
    const owed   = sumOutstandingPartial(active);
    document.getElementById('sumGross').textContent    = bz(gross);
    const owedEl = document.getElementById('sumOutstanding');
    if (owedEl) owedEl.textContent = bz(owed);
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
        el.innerHTML = '<div class="empty-state"><div class="empty-icon" data-icon="cart"></div><p>' + (q ? 'No results for "' + escH(q) + '"' : 'No sales yet today.') + '</p></div>';
        if (typeof initDataIcons === 'function') initDataIcons(el);
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
        // Transaction total (goes to gross sales) vs Amount Tendered
        const transactionTotal = parseFloat(s.total) || 0;
        const amountTendered   = parseFloat(s.amountPaid) || 0;
        const change           = s.method === 'cash' ? Math.max(0, amountTendered - transactionTotal) : 0;
        const methodDisplay = (s.method || 'cash').charAt(0).toUpperCase() + (s.method || 'cash').slice(1);
        const mBadge  = '<span class="badge badge-' + escH(s.method || 'cash') + '">' + escH(methodDisplay) + '</span>';
        const sBadge  = isRev ? '<span class="badge badge-reversed">Reversed</span>'
            : (s.method === 'partial' ? '<span class="badge badge-partial">Balance Due: ' + bz(Math.max(0, transactionTotal - amountTendered)) + '</span>' : '<span class="badge badge-paid">Paid</span>');
        const editBtn    = '<button class="item-btn" title="Edit" onclick="openEditSale(\'' + escH(s.saleId) + '\')">' + (typeof scIcon === 'function' ? scIcon('edit', 15) : 'Edit') + '</button>';
        const reverseBtn = '<button class="item-btn red" title="Reverse" onclick="reverseSale(\'' + escH(s.saleId) + '\')">&#x21A9;&#xFE0F;</button>';
        const viewBtn    = '<button class="item-btn" title="View" onclick="openViewSale(\'' + escH(s.saleId) + '\')">' + (typeof scIcon === 'function' ? scIcon('eye', 15) : 'View') + '</button>';
        
        // Build amount display: show collected vs invoice total
        let amountLine = '<div style="text-align:right;">';
        if (s.method === 'partial') {
            amountLine += '<div style="font-size:0.95rem;font-weight:800;color:var(--success);">Collected: ' + bz(amountTendered) + '</div>';
            amountLine += '<div style="font-size:0.72rem;color:var(--text-dim);font-weight:600;">Invoice: ' + bz(transactionTotal) + '</div>';
        } else {
            amountLine += '<div style="font-size:0.95rem;font-weight:800;">Total: ' + bz(transactionTotal) + '</div>';
        }
        
        // Show tendered amount for cash/card
        if (s.method === 'cash') {
            // For cash: always show tendered amount
            amountLine += '<div style="font-size:0.72rem;color:var(--text-dim);font-weight:700;">Tendered: ' + bz(amountTendered) + '</div>';
            if (change > 0.01) {
                amountLine += '<div style="font-size:0.68rem;color:var(--success);font-weight:700;">Change: ' + bz(change) + '</div>';
            }
        } else if (s.method === 'card') {
            // For card: show charged amount
            amountLine += '<div style="font-size:0.72rem;color:var(--text-dim);font-weight:700;">Charged: ' + bz(amountTendered) + '</div>';
        }
        amountLine += '</div>';
        
        // Icon based on payment method
        const methodIcon = s.method === 'card'
            ? (typeof scIcon === 'function' ? scIcon('card', 14) : 'Card')
            : s.method === 'partial'
                ? (typeof scIcon === 'function' ? scIcon('bolt', 14) : 'Partial')
                : (typeof scIcon === 'function' ? scIcon('cash', 14) : 'Cash');
        return '<div class="list-item" style="' + (isRev ? 'opacity:0.5;' : '') + '">'
            + '<div class="list-item-icon">' + methodIcon + '</div>'
            + '<div class="list-item-body">'
            +   '<div class="list-item-title">' + escH(desc) + '</div>'
            +   '<div class="list-item-meta">' + escH(ts) + (s.cashier ? '  ·  ' + escH(s.cashier) : '') + (s.jobId && String(s.jobId).trim() ? '  ·  Job #' + escH(s.jobId) : '') + '</div>'
            +   '<div style="margin-top:4px;display:flex;gap:6px;">' + mBadge + sBadge + '</div>'
            + '</div>'
            + '<div class="list-item-right">'
            +   '<div class="list-item-amount ' + (isRev ? '' : 'green') + '">' + amountLine + '</div>'
            +   (!isRev ? '<div class="list-item-actions">' + viewBtn + editBtn + reverseBtn + '</div>' : '')
            + '</div></div>';
    }).join('');
    renderPagination('salesPagination', list.length, _salesPage, _salesPerPage,
        (p) => { _salesPage = p; renderSales(); },
        (pp) => { _salesPerPage = pp; _salesPage = 1; renderSales(); }
    );
}

// -- Render: Payouts -----------------------------------------------------------
function renderPayouts() {
    const total = allPayouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    document.getElementById('sumPayouts').textContent     = bz(total);
    document.getElementById('sumPayoutCount').textContent = allPayouts.length;
    const el = document.getElementById('payoutsList');
    if (!allPayouts.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon" data-icon="payout"></div><p>No payouts logged today.</p></div>'; if (typeof initDataIcons === 'function') initDataIcons(el); return; }
    el.innerHTML = [...allPayouts].reverse().map(p => {
        const ts = p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const pid = escH(p.payoutId || '');
        return '<div class="list-item">'
            + '<div class="list-item-icon">' + (typeof scIcon === 'function' ? scIcon('payout', 18) : '') + '</div>'
            + '<div class="list-item-body">'
            +   '<div class="list-item-title">' + escH(p.reason || 'Payout') + '</div>'
            +   '<div class="list-item-meta">' + escH(ts) + (p.loggedBy ? '  ·  ' + escH(p.loggedBy) : '') + (p.takenBy ? '  ·  Taken by: ' + escH(p.takenBy) : '') + '</div>'
            + '</div>'
            + '<div class="list-item-right">'
            +   '<span class="list-item-amount red">-' + bz(p.amount) + '</span>'
            +   '<div class="list-item-actions">'
            +     '<button class="item-btn" title="Print slip" onclick="printPayoutSlip(\'' + pid + '\')">' + (typeof scIcon === 'function' ? scIcon('print', 15) : 'Print') + '</button>'
            +   '</div>'
            + '</div>'
            + '</div>';
    }).join('');
}

// -- Render: Bills -------------------------------------------------------------
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
        el.innerHTML = '<div class="empty-state"><div class="empty-icon" data-icon="clipboard"></div><p>' + (q ? 'No results for "' + escH(q) + '"' : (_showSettled ? 'No bills found.' : 'No open bills.')) + '</p></div>';
        if (typeof initDataIcons === 'function') initDataIcons(el);
        return;
    }
    const billIcon = typeof scIcon === 'function' ? scIcon('clipboard', 18) : '';
    el.innerHTML = visible.map(b => {
        const balance   = Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0));
        const isSettled = b.status === 'settled' || balance <= 0;
        const items     = tryParseJSON(b.items, []);
        const itemNames = items.map(i => i.name).filter(Boolean);
        const desc      = itemNames.slice(0, 3).map(n => escH(n)).join(', ') + (itemNames.length > 3 ? ' <span style="color:var(--text-dim);font-size:0.72rem;">+' + (itemNames.length - 3) + ' more</span>' : '') || 'Bill';
        const ts        = b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return '<div class="list-item" style="' + (isSettled ? 'opacity:0.55;' : '') + '">'
            + '<div class="list-item-icon">' + billIcon + '</div>'
            + '<div class="list-item-body">'
            +   '<div class="list-item-title">' + escH(b.personName || 'Unknown') + '</div>'
            +   '<div class="list-item-meta">' + desc + (ts ? '  ·  ' + escH(ts) : '') + '</div>'
            +   '<div style="margin-top:4px;"><span class="bill-balance ' + (isSettled ? 'settled' : '') + '">' + (isSettled ? '\u2713 Settled' : 'Owes ' + bz(balance)) + '</span></div>'
            + '</div>'
            + (!isSettled ? '<button class="btn-success-sm" onclick="openSettleBill(\'' + escH(b.billId) + '\')">Settle</button>' : '')
            + (!isSettled ? '<button class="item-btn" title="Edit" onclick="openEditBill(\'' + escH(b.billId) + '\')" style="margin-left:4px;">' + (typeof scIcon === 'function' ? scIcon('edit', 15) : 'Edit') + '</button>' : '')
            + '</div>';
    }).join('');
}

// -- End of Day ----------------------------------------------------------------
function initEODShiftPills() {
    // Update the shift label and float visibility based on current time
    const shift = getCurrentShift();
    const labelEl = document.getElementById('eodShiftLabel');
    if (labelEl) {
        if (shift) {
            const iconName = shift.label === 'Morning Shift' ? 'sunrise' : shift.label === 'Saturday Shift' ? 'calendar' : 'moon';
            const iconHtml = typeof scIcon === 'function' ? scIcon(iconName, 16) + ' ' : '';
            labelEl.innerHTML = 'For: ' + iconHtml + escH(shift.label)
                + ' <span style="color:var(--text-dim);font-weight:600;">(' + escH(formatShiftHours(shift)) + ')</span>';
            labelEl.style.color = 'var(--primary)';
        } else {
            labelEl.textContent = 'No active shift detected';
            labelEl.style.color = 'var(--text-dim)';
        }
    }
    _updateFloatVisibility();
    // Load prior shift float for morning (verify) and night/saturday (variance math)
    if (shift && (shift.label === 'Morning Shift' || _isFloatShift())) {
        _loadLastShiftFloat();
    }
}

async function _loadLastShiftFloat() {
    try {
        const data = await apiGet({ action: 'listdaycloses', limit: 10 });
        if (!data.closes || !data.closes.length) return;
        
        // Find the most recent Night Shift or Saturday Shift close
        const lastFloatClose = data.closes
            .filter(c => c.shift === 'Night Shift' || c.shift === 'Saturday Shift')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        if (lastFloatClose && lastFloatClose.float > 0) {
            const lastFloatEl = document.getElementById('lastShiftFloat');
            const lastFloatSection = document.getElementById('lastFloatSection');
            if (lastFloatEl && lastFloatSection) {
                lastFloatEl.textContent = bz(lastFloatClose.float);
                lastFloatSection.style.display = 'block';
                window._expectedStartingFloat = lastFloatClose.float;
                const shift = getCurrentShift();
                const sub = lastFloatSection.querySelector('.float-section-sub');
                if (sub) {
                    sub.textContent = shift && _isFloatShift()
                        ? 'This was already in the drawer at shift start. Expected drawer = starting float + today\'s cash sales.'
                        : 'Verify this matches what you found in the drawer when you started.';
                }
            }
        }
    } catch (e) {
        console.warn('Could not load last shift float:', e);
    }
}

function getStartingFloat() {
    return parseFloat(window._expectedStartingFloat) || 0;
}

/** Drawer/deposit targets for close — accounts for float already in the drawer. */
function computeEODCloseExpecteds(net, floatLeft) {
    const startingFloat  = getStartingFloat();
    const expectedDrawer = startingFloat + net;
    const expectedDeposit = expectedDrawer - floatLeft;
    return { startingFloat, expectedDrawer, expectedDeposit };
}

function getEODShiftLabel() {
    const s = getCurrentShift();
    return s ? s.label : 'Unknown';
}

// Float is only recorded at the end of the final shift of the day
function _isFloatShift() {
    const label = getEODShiftLabel();
    return label === 'Night Shift' || label === 'Saturday Shift';
}

function _updateFloatVisibility() {
    const floatSection = document.getElementById('eodFloatSection');
    const hint         = document.getElementById('eodDrawerHint');
    const floatInput   = document.getElementById('floatAmount');
    const isFloat      = _isFloatShift();
    if (floatSection) floatSection.style.display = isFloat ? '' : 'none';
    if (!isFloat && floatInput) floatInput.value = '';
    if (hint) {
        const shift = getCurrentShift();
        if (shift && shift.label === 'Morning Shift' && window._expectedStartingFloat) {
            hint.innerHTML = '<strong>Instructions:</strong> You started with ' + bz(window._expectedStartingFloat) + ' float. Count all cash in the drawer below. The system will automatically subtract your starting float to calculate variance.';
        } else if (isFloat) {
            const sf = getStartingFloat();
            hint.innerHTML = '<strong>Instructions:</strong><br>'
                + '1. Count <strong>all</strong> cash in the drawer (including starting float)<br>'
                + '2. Enter the float amount to leave for tomorrow<br>'
                + '3. Deposit = drawer total − float left<br>'
                + (sf > 0
                    ? '<br>Starting float: ' + bz(sf) + ' · Expected drawer: ' + bz(sf + (parseFloat((document.getElementById('eodNet')?.textContent || '').replace('BZ$', '')) || 0))
                    : '');
        } else {
            hint.textContent = 'Count all cash in the drawer and enter the total below.';
        }
    }
    calcVariance();
}
function updateEOD() {
    const summary = computeEODSummary(allSales, allPayouts);
    document.getElementById('eodGross').textContent   = bz(summary.gross);
    document.getElementById('eodCash').textContent    = bz(summary.cashSales);
    document.getElementById('eodCard').textContent    = bz(summary.cardSales);
    document.getElementById('eodPayouts').textContent = bz(summary.payoutsTotal);
    document.getElementById('eodNet').textContent     = bz(summary.net);

    const gstCashEl = document.getElementById('eodGSTCash');
    const gstCardEl = document.getElementById('eodGSTCard');
    const gstEl     = document.getElementById('eodGST');
    if (gstCashEl) gstCashEl.textContent = bz(summary.gstCash);
    if (gstCardEl) gstCardEl.textContent = bz(summary.gstCard);
    if (gstEl) gstEl.textContent = bz(summary.gstTotal);

    calcVariance();
}

function calcVariance() {
    // Get expected net cash from EOD summary
    const net      = parseFloat((document.getElementById('eodNet').textContent || '').replace('BZ$', '')) || 0;
    const drawerEl = document.getElementById('drawerCount');
    const floatEl  = document.getElementById('floatAmount');
    const disp     = document.getElementById('varianceDisplay');
    const depositDisp = document.getElementById('depositDisplay');
    
    // Don't show variance until drawer count is entered
    if (!drawerEl.value) { 
        disp.style.display = 'none'; 
        if (depositDisp) depositDisp.style.display = 'none';
        return; 
    }
    
    const drawer   = parseFloat(drawerEl.value) || 0;
    const float_   = parseFloat(floatEl?.value) || 0;
    const shift    = getCurrentShift();
    
    // MORNING SHIFT LOGIC:
    // - Drawer count INCLUDES the starting float from previous night
    // - To get actual sales cash, subtract the starting float
    // - Expected = starting float + cash sales - payouts
    // - Actual = drawer count
    // - Variance = actual - expected
    let actualCash = drawer;
    let startingFloat = 0;
    
    if (shift && shift.label === 'Morning Shift' && window._expectedStartingFloat) {
        startingFloat = window._expectedStartingFloat;
        actualCash = drawer - startingFloat;
        
        // Show reminder if drawer seems to only contain the starting float
        if (drawer > 0 && Math.abs(drawer - startingFloat) < 5 && net > 10) {
            disp.style.display = 'block';
            disp.className = 'variance-display';
            disp.style.background = 'rgba(251,191,36,0.1)';
            disp.style.color = '#f59e0b';
            disp.style.borderColor = 'rgba(251,191,36,0.3)';
            disp.textContent = 'Reminder: You started with ' + bz(startingFloat) + ' float. Current drawer should include sales cash too.';
            if (depositDisp) depositDisp.style.display = 'none';
            return;
        }
    }
    
    // NIGHT/SATURDAY + MORNING: shared close math (starting float + float left)
    const close = computeEODVariance(drawer, float_, net, shift);
    const depositAmount = close.depositAmount;
    const expectedDeposit = close.expectedDeposit;
    const diff = close.variance;
    startingFloat = close.startingFloat;
    
    // Show deposit amount for float shifts (night/saturday)
    if (depositDisp && _isFloatShift()) {
        depositDisp.style.display = 'block';
        const closeExpected = computeEODCloseExpecteds(net, float_);
        depositDisp.innerHTML = '<div style="padding:10px 16px;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:8px;margin-bottom:10px;">'
            + '<div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:var(--primary);margin-bottom:4px;">Deposit to Bank</div>'
            + '<div style="font-size:1.3rem;font-weight:800;color:var(--primary);">' + bz(depositAmount) + '</div>'
            + '<div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">Drawer ' + bz(drawer) + ' − Float ' + bz(float_)
            + (closeExpected.startingFloat > 0 ? ' · Expected deposit ' + bz(expectedDeposit) : '')
            + '</div></div>';
    } else if (depositDisp) {
        depositDisp.style.display = 'none';
    }
    
    // Show variance result
    disp.style.display = 'block';
    if (Math.abs(diff) < 0.01) {
        disp.className = 'variance-display exact';
        disp.textContent = '\u2713 Drawer is exact';
        if (startingFloat > 0) disp.textContent += '  \u00b7  Started with ' + bz(startingFloat);
        if (float_ > 0) disp.textContent += '  \u00b7  Float: ' + bz(float_);
    } else if (diff > 0) {
        disp.className = 'variance-display over';
        disp.textContent = '\u2191 Over by ' + bz(diff);
        if (startingFloat > 0) disp.textContent += '  \u00b7  Started with ' + bz(startingFloat);
        if (float_ > 0) disp.textContent += '  \u00b7  Float: ' + bz(float_);
    } else {
        disp.className = 'variance-display short';
        disp.textContent = 'Short by ' + bz(Math.abs(diff)) + '  —  Manager will be notified';
    }
}

function renderEODHistory(closes) {
    const el = document.getElementById('eodHistory');
    if (!closes.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon" data-icon="chart"></div><p>No recent closes found.</p></div>'; if (typeof initDataIcons === 'function') initDataIcons(el); return; }
    el.innerHTML = [...closes].reverse().map(c => {
        const ts       = c.timestamp ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const date     = c.shiftDate || c.timestamp ? new Date(c.timestamp || c.shiftDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const variance = parseFloat(c.variance) || 0;
        let varColor, varLabel;
        if (Math.abs(variance) < 0.01) {
            varColor = 'var(--success)';
            varLabel = '\u2713 Exact';
        } else if (variance < 0) {
            varColor = 'var(--danger)';
            varLabel = 'Short ' + bz(Math.abs(variance));
        } else {
            // Over — managers see the amount, cashiers see a neutral placeholder
            varColor = isManager ? 'var(--success)' : 'var(--text-dim)';
            varLabel = isManager ? '+' + bz(variance) : '— Reviewed';
        }
        return '<div class="eod-history-item">'
            + '<div><div style="font-size:0.88rem;font-weight:700;">' + escH(c.shift || 'Close') + (date ? '  ·  ' + date : '') + '</div>'
            + '<div style="font-size:0.72rem;color:var(--text-dim);">' + escH(ts) + (c.closedBy ? '  ·  ' + escH(c.closedBy) : '') + '</div>'
            + (c.float ? '<div style="font-size:0.72rem;color:var(--text-dim);">Float: ' + bz(c.float) + '</div>' : '')
            + '</div>'
            + '<div style="text-align:right;"><div style="font-size:0.88rem;font-weight:800;">Net: ' + bz(c.netExpected) + '</div>'
            + '<div style="font-size:0.72rem;font-weight:700;color:' + varColor + ';">Variance: ' + varLabel + '</div></div>'
            + '</div>';
    }).join('');
}

/** Shared close math for calcVariance, submitEOD, and printEOD. */
function computeEODVariance(drawer, float_, net, shift) {
    let actualCash    = drawer;
    let startingFloat = getStartingFloat();

    if (shift && shift.label === 'Morning Shift' && startingFloat) {
        actualCash = drawer - startingFloat;
    }

    let depositAmount   = actualCash;
    let expectedDeposit = net;

    if (_isFloatShift()) {
        const closeExpected = computeEODCloseExpecteds(net, float_);
        expectedDeposit = closeExpected.expectedDeposit;
        if (float_ > 0) depositAmount = actualCash - float_;
    }

    const variance = _isFloatShift()
        ? depositAmount - expectedDeposit
        : actualCash - net;

    return { actualCash, startingFloat, depositAmount, expectedDeposit, variance };
}

async function submitEOD() {
    const net      = parseFloat((document.getElementById('eodNet').textContent || '').replace('BZ$', '')) || 0;
    const drawerVal = document.getElementById('drawerCount').value;
    if (!drawerVal) { alert('Enter the drawer count first.'); return; }
    const float_       = parseFloat(document.getElementById('floatAmount')?.value) || 0;
    if (_isFloatShift() && !document.getElementById('floatAmount')?.value) {
        alert('Enter the float amount — this is required for the final shift close.');
        document.getElementById('floatAmount')?.focus();
        return;
    }
    const drawer       = parseFloat(drawerVal);
    const shift        = getCurrentShift();
    const close        = computeEODVariance(drawer, float_, net, shift);
    const variance     = close.variance;
    const depositAmount = close.depositAmount;
    const startingFloat = close.startingFloat;
    const shiftLabel   = getEODShiftLabel();
    const summary      = computeEODSummary(allSales, allPayouts);
    const gross        = summary.gross;
    const payoutsTotal = summary.payoutsTotal;
    const btn          = document.getElementById('submitEODBtn');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
        const data = await apiPost({
            action: 'submitdayclose', shiftDate: getShiftDate(),
            shift: shiftLabel, grossSales: gross,
            totalPayouts: payoutsTotal, netExpected: net,
            actualDrawer: drawer, variance, float: float_, 
            startingFloat: startingFloat, depositAmount: depositAmount,
            closedBy: currentUser
        });
        if (data.success) {
            if (typeof haptic === 'function') haptic('success');
            if (variance < -0.01 && typeof sendNotification === 'function')
                sendNotification('manageronly', 'Cashier Short', currentUser + ' is short ' + bz(Math.abs(variance)) + ' on ' + getShiftDate() + '.');
            showToast('End of day submitted!', 'ok');
            btn.textContent = '\u2713 Submitted';
            document.getElementById('drawerCount').value = '';
            if (document.getElementById('floatAmount')) document.getElementById('floatAmount').value = '';
            document.getElementById('varianceDisplay').style.display = 'none';
            const depositDisp = document.getElementById('depositDisplay');
            if (depositDisp) depositDisp.style.display = 'none';
            printEOD();
            await loadAll();
        } else {
            btn.disabled = false; btn.textContent = '\u2713 Submit End of Day';
            showToast(data.error || 'Could not submit.', 'err');
        }
    } catch (e) { btn.disabled = false; btn.textContent = '\u2713 Submit End of Day'; showToast('Connection error.', 'err'); }
}

// -- Shared single-fire print helper ------------------------------------------
function _openAndPrint(html) {
    if (typeof printHTML === 'function') {
        printHTML(html);
        return;
    }
    const w = window.open('', '_blank', 'width=400,height=600,alwaysRaised=yes');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    let _printed = false;
    function _doPrint() {
        if (_printed) return;
        _printed = true;
        w.focus();
        w.print();
        setTimeout(() => { try { w.close(); } catch(_) {} }, 1500);
    }
    w.onload = _doPrint;
    setTimeout(_doPrint, 300);
}

function _printSaleReceipt(items, total, amountPaid, method, saleId, customer, cashier) {
    const html = buildSaleReceiptHTML(items, total, amountPaid, method, saleId, customer, cashier);
    const opts = {};
    if (typeof buildSaleReceiptESCPOS === 'function') {
        opts.escpos = buildSaleReceiptESCPOS(items, total, amountPaid, method, saleId, customer, cashier);
    }
    printHTML(html, opts);
}

function printEOD() {
    // Both fields mandatory before printing
    const drawerRaw = document.getElementById('drawerCount').value;
    if (!drawerRaw) { alert('Enter the drawer count before printing.'); return; }
    if (_isFloatShift() && !document.getElementById('floatAmount')?.value) {
        alert('Enter the float amount before printing.'); return;
    }
    const summary      = computeEODSummary(allSales, allPayouts);
    const gross        = summary.gross;
    const cashSales    = summary.cashSales;
    const cardSales    = summary.cardSales;
    const preTax       = summary.preTax;
    const payoutsTotal = summary.payoutsTotal;
    const net          = summary.net;
    const float_       = parseFloat(document.getElementById('floatAmount')?.value) || 0;
    const drawer       = parseFloat(drawerRaw);
    const shift        = getCurrentShift();
    const close        = computeEODVariance(drawer, float_, net, shift);
    const variance     = close.variance;
    const depositAmount = close.depositAmount;
    const startingFloat = close.startingFloat;
    const shiftLabel   = getEODShiftLabel();
    const varText  = Math.abs(variance) < 0.01 ? 'Exact' : (variance > 0 ? 'OVER ' : 'SHORT ') + bz(Math.abs(variance));
    const displayDate  = _currentDateFilter || getShiftDate();
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
        + '<p>' + escH(shiftLabel) + ' &mdash; ' + displayDate + '</p>'
        + '<p>Cashier: ' + escH(currentUser) + '</p>'
        + '<hr>'
        + '<table>'
        + '<tr><td>Collected Today (incl. GST)</td><td>' + bz(gross) + '</td></tr>'
        + '<tr><td>&nbsp;&nbsp;Cash / Partial</td><td>' + bz(cashSales) + '</td></tr>'
        + '<tr><td>&nbsp;&nbsp;Card (not in drawer)</td><td>' + bz(cardSales) + '</td></tr>'
        + '<tr><td>Sales excl. GST</td><td>' + bz(preTax) + '</td></tr>'
        + '<tr><td>GST on Cash Sales</td><td>' + bz(summary.gstCash) + '</td></tr>'
        + '<tr><td>GST on Card Sales</td><td>' + bz(summary.gstCard) + '</td></tr>'
        + '<tr><td>Total GST Collected</td><td>' + bz(summary.gstTotal) + '</td></tr>'
        + '<tr><td>Total Payouts</td><td>' + bz(payoutsTotal) + '</td></tr>'
        + (allPayouts.length ? allPayouts.map(p => '<tr><td style="font-size:9pt;">&nbsp;&nbsp;' + escH(p.reason || 'Payout') + (p.takenBy ? ' (' + escH(p.takenBy) + ')' : '') + '</td><td style="font-size:9pt;">-' + bz(p.amount) + '</td></tr>').join('') : '')
        + '<tr class="total"><td><strong>Cash Expected in Drawer</strong></td><td><strong>' + bz(net) + '</strong></td></tr>'
        + '<tr><td>Actual Drawer Total</td><td>' + bz(drawer) + '</td></tr>'
        + (startingFloat > 0 ? '<tr><td>&nbsp;&nbsp;Less: Starting Float</td><td>-' + bz(startingFloat) + '</td></tr>' : '')
        + (float_ > 0 ? '<tr><td>&nbsp;&nbsp;Less: Float (for tomorrow)</td><td>-' + bz(float_) + '</td></tr>' : '')
        + (_isFloatShift() && float_ > 0 ? '<tr><td><strong>Deposit to Bank</strong></td><td><strong>' + bz(depositAmount) + '</strong></td></tr>' : '')
        + '<tr class="variance"><td><strong>Variance</strong></td><td><strong>' + varText + '</strong></td></tr>'
        + '</table>'
        + '<div class="footer">Printed ' + new Date().toLocaleString() + '</div>'
        + '</body></html>';
    _openAndPrint(html);
}

// -- Print Sales Report --------------------------------------------------------
function printSalesReport() {
    const validSales = allSales.filter(s => s.status !== 'reversed');
    const gross = sumCollectedSales(validSales);
    const displayDate = _currentDateFilter || getShiftDate();
    const shift = getCurrentShift();
    
    const salesRows = [...validSales].reverse().map(s => {
        const items = tryParseJSON(s.items, []);
        const ts = s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const method = (s.method || 'cash').toUpperCase();
        
        // Create rows for each item with quantity and total
        const itemRows = items.map(item => {
            const itemName = escH((item.name || 'Item').substring(0, 24));
            const qty = item.qty || 1;
            const total = parseFloat(item.total) || (parseFloat(item.price) || 0) * qty;
            return '<tr><td style="font-size:8pt;">' + itemName + '</td>'
                + '<td style="text-align:center;font-size:8pt;">' + qty + '</td>'
                + '<td style="text-align:right;font-size:8pt;">' + bz(total) + '</td></tr>';
        }).join('');
        
        // Header row for this sale
        const headerRow = '<tr style="background:#f0f0f0;"><td colspan="3" style="font-size:8pt;padding:2px 0;border-top:1px solid #000;">'
            + escH(ts) + ' [' + method + '] ' + escH(s.cashier || 'Staff')
            + (s.jobId && String(s.jobId).trim() ? ' - Job #' + escH(s.jobId) : '')
            + '</td></tr>';
        
        return headerRow + itemRows;
    }).join('');
    
    const html = '<!DOCTYPE html><html><head><title>Sales Report</title>'
        + '<style>'
        + '@page{size:72mm auto;margin:0;}'
        + '*{box-sizing:border-box;}'
        + 'body{font-family:"Courier New",Courier,monospace;font-size:10pt;font-weight:bold;width:72mm;margin:0 auto;padding:3mm 3mm 60mm 3mm;color:#000;background:#fff;}'
        + 'h2{text-align:center;font-size:13pt;font-weight:900;margin:0 0 2mm;letter-spacing:1px;}'
        + 'p{text-align:center;margin:0 0 1mm;font-size:10pt;font-weight:bold;}'
        + 'hr{border:none;border-top:2px solid #000;margin:2mm 0;}'
        + 'table{width:100%;border-collapse:collapse;font-size:9pt;font-weight:bold;}'
        + 'td{padding:2px 0;border-bottom:1px dotted #ccc;}'
        + 'td:last-child{text-align:right;font-weight:900;}'
        + '.total td{border-top:3px solid #000;border-bottom:none;font-size:11pt;font-weight:900;padding-top:4px;}'
        + '.footer{text-align:center;font-size:8pt;font-weight:bold;margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;}'
        + '</style></head><body>'
        + '<h2>SERVICELL BELIZE</h2>'
        + '<p>Sales Report</p>'
        + '<p>' + displayDate + '</p>'
        + (shift ? '<p style="font-size:9pt;">' + shift.label + '</p>' : '')
        + '<hr>'
        + '<table>'
        + '<tr><th style="text-align:left;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Item</th>'
        + '<th style="text-align:center;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Qty</th>'
        + '<th style="text-align:right;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Total</th></tr>'
        + salesRows
        + '<tr class="total"><td colspan="2"><strong>Total Sales</strong></td><td><strong>' + bz(gross) + '</strong></td></tr>'
        + '<tr><td colspan="2">Transactions</td><td>' + validSales.length + '</td></tr>'
        + '</table>'
        + '<div class="footer">Printed ' + new Date().toLocaleString() + '</div>'
        + '</body></html>';
    _openAndPrint(html);
}

// -- Print Payouts Report ------------------------------------------------------
function printPayoutsReport() {
    const displayDate = _currentDateFilter || getShiftDate();
    if (typeof buildPayoutsReportHTML === 'function') {
        const html = buildPayoutsReportHTML(allPayouts, displayDate);
        if (typeof printHTML === 'function') printHTML(html);
        else _openAndPrint(html);
        return;
    }
    const total = allPayouts.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    
    const payoutRows = [...allPayouts].reverse().map(p => {
        const ts = p.timestamp ? new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return '<tr><td style="font-size:9pt;">' + escH(ts) + '</td><td style="font-size:9pt;">' + escH((p.reason || 'Payout').substring(0, 30)) + '</td><td style="font-size:9pt;">' + escH(p.takenBy || ' · ') + '</td><td style="text-align:right;font-size:9pt;">' + bz(p.amount) + '</td></tr>';
    }).join('');
    
    const html = '<!DOCTYPE html><html><head><title>Payouts Report</title>'
        + '<style>'
        + '@page{size:72mm auto;margin:0;}'
        + '*{box-sizing:border-box;}'
        + 'body{font-family:"Courier New",Courier,monospace;font-size:11pt;font-weight:bold;width:72mm;margin:0 auto;padding:3mm 3mm 60mm 3mm;color:#000;background:#fff;}'
        + 'h2{text-align:center;font-size:13pt;font-weight:900;margin:0 0 2mm;letter-spacing:1px;}'
        + 'p{text-align:center;margin:0 0 1mm;font-size:10pt;font-weight:bold;}'
        + 'hr{border:none;border-top:2px solid #000;margin:2mm 0;}'
        + 'table{width:100%;border-collapse:collapse;font-size:10pt;font-weight:bold;}'
        + 'td{padding:3px 0;border-bottom:1px solid #000;}'
        + 'td:last-child{text-align:right;font-weight:900;}'
        + '.total td{border-top:3px solid #000;border-bottom:none;font-size:12pt;font-weight:900;padding-top:4px;}'
        + '.footer{text-align:center;font-size:9pt;font-weight:bold;margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;}'
        + '</style></head><body>'
        + '<h2>SERVICELL BELIZE</h2>'
        + '<p>Payouts Report</p>'
        + '<p>' + displayDate + '</p>'
        + '<hr>'
        + '<table>'
        + '<tr><th style="text-align:left;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Time</th><th style="text-align:left;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Reason</th><th style="text-align:left;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Taken By</th><th style="text-align:right;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Amount</th></tr>'
        + (payoutRows || '<tr><td colspan="4" style="text-align:center;font-size:9pt;padding:10px 0;">No payouts</td></tr>')
        + '<tr class="total"><td colspan="3"><strong>Total Payouts</strong></td><td><strong>' + bz(total) + '</strong></td></tr>'
        + '</table>'
        + '<div class="footer">Printed ' + new Date().toLocaleString() + '</div>'
        + '</body></html>';
    _openAndPrint(html);
}

// -- Print Bills Report --------------------------------------------------------
function printBillsReport() {
    const open = allBills.filter(b => b.status === 'open');
    const totalOwed = open.reduce((t, b) => t + Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0)), 0);
    
    const billRows = open.map(b => {
        const balance = Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0));
        const items = tryParseJSON(b.items, []);
        const itemNames = items.map(i => i.name).join(', ');
        return '<tr><td style="font-size:9pt;">' + escH(b.personName || 'Unknown') + '</td><td style="font-size:9pt;">' + escH(itemNames.substring(0, 25)) + (itemNames.length > 25 ? '...' : '') + '</td><td style="text-align:right;font-size:9pt;">' + bz(balance) + '</td></tr>';
    }).join('');
    
    const html = '<!DOCTYPE html><html><head><title>Bills Report</title>'
        + '<style>'
        + '@page{size:72mm auto;margin:0;}'
        + '*{box-sizing:border-box;}'
        + 'body{font-family:"Courier New",Courier,monospace;font-size:11pt;font-weight:bold;width:72mm;margin:0 auto;padding:3mm 3mm 60mm 3mm;color:#000;background:#fff;}'
        + 'h2{text-align:center;font-size:13pt;font-weight:900;margin:0 0 2mm;letter-spacing:1px;}'
        + 'p{text-align:center;margin:0 0 1mm;font-size:10pt;font-weight:bold;}'
        + 'hr{border:none;border-top:2px solid #000;margin:2mm 0;}'
        + 'table{width:100%;border-collapse:collapse;font-size:10pt;font-weight:bold;}'
        + 'td{padding:3px 0;border-bottom:1px solid #000;}'
        + 'td:last-child{text-align:right;font-weight:900;}'
        + '.total td{border-top:3px solid #000;border-bottom:none;font-size:12pt;font-weight:900;padding-top:4px;}'
        + '.footer{text-align:center;font-size:9pt;font-weight:bold;margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;}'
        + '</style></head><body>'
        + '<h2>SERVICELL BELIZE</h2>'
        + '<p>Open Bills Report</p>'
        + '<p>' + new Date().toLocaleDateString() + '</p>'
        + '<hr>'
        + '<table>'
        + '<tr><th style="text-align:left;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Person</th><th style="text-align:left;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Items</th><th style="text-align:right;font-size:8pt;padding:2px 0;border-bottom:2px solid #000;">Balance</th></tr>'
        + (billRows || '<tr><td colspan="3" style="text-align:center;font-size:9pt;padding:10px 0;">No open bills</td></tr>')
        + '<tr class="total"><td colspan="2"><strong>Total Outstanding</strong></td><td><strong>' + bz(totalOwed) + '</strong></td></tr>'
        + '<tr><td colspan="2">Open Bills</td><td>' + open.length + '</td></tr>'
        + '</table>'
        + '<div class="footer">Printed ' + new Date().toLocaleString() + '</div>'
        + '</body></html>';
    _openAndPrint(html);
}

// -- SKU / Barcode Scanner -----------------------------------------------------
// -- Inventory Cache -----------------------------------------------------------
async function loadInventoryCache() {
    try {
        const data = await apiGet({ action: 'listinventory' });
        window._inventoryCache = data.items || [];
    } catch (e) {
        console.error('loadInventoryCache error:', e);
    }
}

// -- Scanner / Search ----------------------------------------------------------
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
        box.innerHTML = '<div style="padding:10px 14px;font-size:0.8rem;color:var(--text-dim);">No match — press <strong>Enter</strong> to add as custom item</div>';
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
    ).join('') 
    + '<div style="padding:8px 14px;font-size:0.72rem;color:var(--text-dim);background:rgba(37,99,235,0.04);border-top:1px solid var(--glass-border);text-align:center;"><strong>Enter</strong> = Add top match  •  <strong>Shift+Enter</strong> = Add "' + escH(q) + '" as custom</div>';
}

function onScannerKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = (document.getElementById('saleScanner').value || '').trim();
    if (!q) return;
    
    // Shift+Enter = force add as custom item (bypass search)
    if (e.shiftKey) {
        addItemByBarcode(q);
        return;
    }
    
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
    // Add as custom item
    addSaleLine(barcode, 1, '', barcode);
    updateSaleTotal();
    document.getElementById('saleScanner').value = '';
    document.getElementById('scannerResults').style.display = 'none';
    document.getElementById('saleScanner').focus();
}

// -- Sale Modal ----------------------------------------------------------------
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
        + '<input class="line-input" type="text" placeholder="Item name or description..." value="' + escH(name) + '" autocomplete="off"'
        + ' oninput="saleLineAutocomplete(this,\'' + dropId + '\')" onblur="setTimeout(()=>{const d=document.getElementById(\'' + dropId + '\');if(d)d.style.display=\'none\';},250)">'
        + '<div id="' + dropId + '" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:500;background:var(--glass-strong);border:1px solid var(--glass-border);border-radius:10px;box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto;"></div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:0;border:1px solid var(--glass-border);border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--glass);">'
        + '<button type="button" onclick="adjustLineQty(this,-1)" style="width:30px;height:38px;border:none;background:transparent;color:var(--text-dim);font-size:1.1rem;cursor:pointer;font-weight:700;flex-shrink:0;">-</button>'
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
    // Keep tendered in sync with total for cash
    const method = document.querySelector('input[name="saleMethod"]:checked')?.value || 'cash';
    if (method === 'cash') {
        const field = document.getElementById('saleCashTendered');
        // Always auto-update tendered to match total (cashier can override if needed)
        if (field) {
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
        disp.textContent = 'Short by BZ$' + Math.abs(change).toFixed(2);
    } else {
        disp.style.cssText = 'display:block;margin-top:8px;padding:10px 14px;border-radius:10px;font-size:0.95rem;font-weight:800;text-align:center;background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2);';
        disp.textContent = change < 0.01 ? 'Exact — no change' : 'Change: BZ$' + change.toFixed(2);
    }
}

async function submitSale() {
    const items = collectSaleLineItems();
    if (!items.length) { alert('Add at least one item.'); return; }
    const total      = items.reduce((t, i) => t + i.total, 0);
    const method     = document.querySelector('input[name="saleMethod"]:checked').value;
    let amountPaid;
    if (method === 'partial') {
        amountPaid = parseFloat(document.getElementById('salePartialAmount').value) || 0;
        if (amountPaid <= 0) { showToast('Enter the partial amount paid.', 'err'); return; }
    } else if (method === 'cash') {
        // For cash: amountPaid is the tendered amount (what customer gave)
        amountPaid = parseFloat(document.getElementById('saleCashTendered').value) || total;
    } else {
        // For card: amountPaid equals total
        amountPaid = total;
    }
    const btn = document.getElementById('saleSubmitBtn');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
        const data = await apiPost({
            action: 'createsale',
            items: JSON.stringify(items), total, method, amountPaid,
            shiftDate: getShiftDate(), shift: getCurrentShift() ? getCurrentShift().label : 'Unknown', cashier: currentUser
        });
        if (data.success) {
            closeModal('saleModal');
            if (typeof haptic === 'function') haptic('success');
            // Show sale confirmation modal — use tendered for change display, not amountPaid
            const tendered = method === 'cash' ? (parseFloat(document.getElementById('saleCashTendered').value) || total) : total;
            const change = method === 'cash' ? Math.max(0, tendered - total) : 0;
            document.getElementById('scTotal').textContent = bz(total);
            document.getElementById('scPaid').textContent  = bz(tendered);
            const changeRow = document.getElementById('scChangeRow');
            if (change > 0.01) {
                document.getElementById('scChange').textContent = bz(change);
                changeRow.style.display = 'flex';
            } else {
                changeRow.style.display = 'none';
            }
            openModal('saleConfirmModal');
            printReceipt(items, total, amountPaid, method, data.saleId, '');
            // Store last receipt data for reprinting
            window._lastReceipt = { items, total, amountPaid, method, saleId: data.saleId, customer: '' };
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Complete Sale'; showToast(data.error || 'Could not save.', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Complete Sale'; showToast('Connection error.', 'err'); }
}

function collectSaleLineItems() {
    const items = [];
    document.querySelectorAll('#saleLineItems .line-item-row').forEach(r => {
        const i = r.querySelectorAll('input');
        const name = i[0].value.trim();
        const qty = parseFloat(i[1].value) || 1;
        const price = parseFloat(i[2].value) || 0;
        const sku = r.dataset.sku || '';
        if (name) items.push({ name, qty, price, total: qty * price, sku });
    });
    return items;
}

async function createBillFromSale() {
    const items = collectSaleLineItems();
    if (!items.length) { showToast('Add at least one item first.', 'err'); return; }
    const person = prompt('Customer / person name for this bill:');
    if (!person || !person.trim()) return;
    const total = items.reduce((t, i) => t + i.total, 0);
    try {
        const data = await apiPost({
            action: 'createbill',
            personName: person.trim(),
            items: JSON.stringify(items),
            totalOwed: total,
            cashier: currentUser,
            shiftDate: getShiftDate()
        });
        if (data.success) {
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill opened for ' + person.trim(), 'ok');
            document.getElementById('saleLineItems').innerHTML = '';
            updateSaleTotal();
            closeModal('saleModal');
            await loadAll();
            switchTab('bills');
        } else {
            showToast(data.error || 'Could not create bill.', 'err');
        }
    } catch (e) {
        showToast('Connection error.', 'err');
    }
}

function openSalesPartialSales() {
    const date = _currentDateFilter || getShiftDate();
    openPartialSalesModal(allSales, {
        from: date,
        to: date,
        onRowClick: 'openPartialSalesRow',
        emptyText: 'No partial sales with balance due for this date.'
    });
}

function openPartialSalesRow(saleId) {
    closePartialSalesModal();
    openViewSale(saleId);
}

// -- Reprint Last Receipt -----------------------------------------------------
function reprintLastReceipt() {
    if (!window._lastReceipt) {
        showToast('No receipt to reprint', 'err');
        return;
    }
    
    try {
        const { items, total, amountPaid, method, saleId, customer } = window._lastReceipt;
        
        // Check if required functions exist
        if (typeof buildSaleReceiptHTML !== 'function' || typeof printHTML !== 'function') {
            showToast('Print functions not loaded', 'err');
            console.error('Receipt functions not found');
            return;
        }

        if (typeof kickDrawer === 'function') kickDrawer();

        _printSaleReceipt(items, total, amountPaid, method, saleId, customer, currentUser);
        
        showToast('Printing receipt...', 'ok');
        if (typeof haptic === 'function') haptic('light');
    } catch (error) {
        console.error('Reprint error:', error);
        showToast('Failed to print receipt', 'err');
    }
}

// -- Job Pickup ----------------------------------------------------------------
function openJobPickupModal() {
    document.getElementById('jobSearch').value = '';
    document.getElementById('jobSearchResults').innerHTML = '';
    document.getElementById('jobSelected').style.display = 'none';
    document.getElementById('jobPaymentSection').style.display = 'none';
    document.getElementById('jobPickupBtn').style.display = 'none';
    document.getElementById('jobInvoiceItems').innerHTML = '';
    document.getElementById('jobTotalDisplay').textContent = 'BZ$0.00';
    document.getElementById('jobCashTendered').value = '';
    document.getElementById('jpm-cash').checked = true;
    document.getElementById('jobCashTenderedGroup').style.display = 'block';
    document.getElementById('jobPartialGroup').style.display = 'none';
    document.getElementById('jobChangeDisplay').style.display = 'none';
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
        + '<strong>#' + escH(String(j.id)) + '</strong>  ·  ' + escH(j.customerName || 'Walk-in') + '  ·  ' + escH(j.device || ' · ') + '</div>'
    ).join('');
}

function selectJob(id) {
    const j = allJobs.find(x => String(x.id) === String(id));
    if (!j) return;
    selectedJobId = id;
    document.getElementById('jobSearchResults').innerHTML = '';
    document.getElementById('jobSearch').value = '#' + j.id + '  ·  ' + (j.customerName || '');
    const sel = document.getElementById('jobSelected');
    sel.innerHTML = '<strong>#' + escH(String(j.id)) + '</strong>  ·  ' + escH(j.customerName || ' · ') + '  ·  ' + escH(j.device || ' · ') + '  ·  ' + escH(j.status || ' · ');
    sel.style.display = 'block';
    
    // Display invoice items
    const invoiceItems = tryParseJSON(j.invoiceItems, []);
    const itemsEl = document.getElementById('jobInvoiceItems');
    if (invoiceItems.length) {
        itemsEl.innerHTML = invoiceItems.map(item => 
            '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--glass-border);">'
            + '<span style="font-weight:600;">' + escH(item.desc || 'Service') + '</span>'
            + '<span style="font-weight:800;color:var(--success);">' + bz(item.price || 0) + '</span>'
            + '</div>'
        ).join('');
    } else {
        itemsEl.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:8px 0;">No invoice items yet</div>';
    }
    
    const total = invoiceItems.reduce((t, i) => t + (parseFloat(i.price) || 0), 0);
    document.getElementById('jobTotalDisplay').textContent = bz(total);
    
    // Set cash tendered to total by default
    document.getElementById('jobCashTendered').value = total > 0 ? total.toFixed(2) : '';
    document.getElementById('jpm-cash').checked = true;
    document.getElementById('jobCashTenderedGroup').style.display = 'block';
    document.getElementById('jobPartialGroup').style.display = 'none';
    
    document.getElementById('jobPaymentSection').style.display = 'block';
    document.getElementById('jobPickupBtn').style.display = 'inline-flex';
    
    calcJobChange();
}

function toggleJobPaymentFields() {
    const method = document.querySelector('input[name="jobMethod"]:checked')?.value || 'cash';
    document.getElementById('jobCashTenderedGroup').style.display = method === 'cash' ? 'block' : 'none';
    document.getElementById('jobPartialGroup').style.display = method === 'partial' ? 'block' : 'none';
    
    if (method === 'cash') {
        const total = parseFloat(document.getElementById('jobTotalDisplay').textContent.replace('BZ$', '')) || 0;
        const field = document.getElementById('jobCashTendered');
        if (!field.value) field.value = total > 0 ? total.toFixed(2) : '';
        calcJobChange();
    } else if (method === 'partial') {
        calcJobBalance();
    } else {
        document.getElementById('jobChangeDisplay').style.display = 'none';
        document.getElementById('jobBalanceDisplay').style.display = 'none';
    }
}

function calcJobChange() {
    const total = parseFloat(document.getElementById('jobTotalDisplay').textContent.replace('BZ$', '')) || 0;
    const tendered = parseFloat(document.getElementById('jobCashTendered').value) || 0;
    const disp = document.getElementById('jobChangeDisplay');
    if (!disp) return;
    if (!tendered || total <= 0) { disp.style.display = 'none'; return; }
    const change = tendered - total;
    disp.style.display = 'block';
    if (change < 0) {
        disp.style.cssText = 'display:block;margin-top:8px;padding:10px 14px;border-radius:10px;font-size:0.95rem;font-weight:800;text-align:center;background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);';
        disp.textContent = 'Short by BZ$' + Math.abs(change).toFixed(2);
    } else {
        disp.style.cssText = 'display:block;margin-top:8px;padding:10px 14px;border-radius:10px;font-size:0.95rem;font-weight:800;text-align:center;background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2);';
        disp.textContent = change < 0.01 ? 'Exact — no change' : 'Change: BZ$' + change.toFixed(2);
    }
}

function toggleJobPartial() {
    toggleJobPaymentFields();
}

function calcJobBalance() {
    const total = parseFloat(document.getElementById('jobTotalDisplay').textContent.replace('BZ$', '')) || 0;
    const method = (document.querySelector('input[name="jobMethod"]:checked') || {}).value || 'cash';
    const paid = method === 'partial' ? (parseFloat(document.getElementById('jobPartialAmount').value) || 0) : total;
    const balance = total - paid;
    const disp = document.getElementById('jobBalanceDisplay');
    if (total <= 0) { disp.style.display = 'none'; return; }
    disp.style.display = 'block';
    if (balance <= 0.01) {
        disp.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:700;margin-bottom:14px;background:rgba(16,185,129,0.1);color:var(--success);border:1px solid rgba(16,185,129,0.2);';
        disp.textContent = 'Fully paid — device can be released';
    } else {
        disp.style.cssText = 'display:block;padding:10px 14px;border-radius:10px;font-size:0.85rem;font-weight:700;margin-bottom:14px;background:rgba(245,158,11,0.1);color:#d97706;border:1px solid rgba(245,158,11,0.2);';
        disp.textContent = 'Partial  —  ' + bz(balance) + ' remaining. Device stays until fully paid.';
    }
}

async function submitJobPickup() {
    if (!selectedJobId) return;
    const j = allJobs.find(x => String(x.id) === String(selectedJobId));
    const invoiceItems = tryParseJSON(j.invoiceItems, []);
    const total = invoiceItems.reduce((t, i) => t + (parseFloat(i.price) || 0), 0);
    const method = (document.querySelector('input[name="jobMethod"]:checked') || {}).value || 'cash';
    
    let amountPaid = total;
    if (method === 'partial') {
        amountPaid = parseFloat(document.getElementById('jobPartialAmount').value) || 0;
    } else if (method === 'cash') {
        // For cash: amountPaid is the tendered amount (what customer gave)
        amountPaid = parseFloat(document.getElementById('jobCashTendered').value) || total;
    } else {
        // For card: amountPaid equals total
        amountPaid = total;
    }
    
    const balance = total - amountPaid;
    if (method === 'partial' && balance > 0.01)
        if (!confirm('Customer still owes ' + bz(balance) + '. Device will NOT be released. Continue?')) return;
    const btn = document.getElementById('jobPickupBtn');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
        const data = await apiPost({
            action: 'createsale', customer: j ? (j.customerName || '') : '',
            items: JSON.stringify([{ name: 'Job #' + selectedJobId + '  ·  ' + (j ? (j.device || 'Repair') : 'Repair'), qty: 1, price: total, total }]),
            total, method, amountPaid, jobId: selectedJobId,
            shiftDate: getShiftDate(), shift: getCurrentShift() ? getCurrentShift().label : 'Unknown', cashier: currentUser
        });
        if (data.success) {
            const payStatus = balance <= 0.01 ? 'paid' : 'partial';
            const updateParams = { action: 'update', id: selectedJobId, payStatus, username: currentUser };
            if (balance <= 0.01) {
                updateParams.status = 'resolved';
            } else {
                showToast('Partial payment — device stays until fully paid.', '');
            }
            await apiPost(updateParams);
            closeModal('jobPickupModal');
            if (typeof haptic === 'function') haptic('success');
            
            // Show confirmation modal with change if cash
            if (method === 'cash' && balance <= 0.01) {
                const jobTendered = parseFloat(document.getElementById('jobCashTendered').value) || total;
                const change = Math.max(0, jobTendered - total);
                document.getElementById('scTotal').textContent = bz(total);
                document.getElementById('scPaid').textContent = bz(jobTendered);
                const changeRow = document.getElementById('scChangeRow');
                if (change > 0.01) {
                    document.getElementById('scChange').textContent = bz(change);
                    changeRow.style.display = 'flex';
                } else {
                    changeRow.style.display = 'none';
                }
                openModal('saleConfirmModal');
            } else if (balance <= 0.01) {
                showToast('Payment collected!', 'ok');
            }
            
            // Print receipt
            printReceipt(
                invoiceItems.map(i => ({ name: i.desc, qty: 1, price: i.price, total: i.price })),
                total, amountPaid, method, data.saleId, j.customerName || ''
            );
            
            await loadAll();
        } else { btn.disabled = false; btn.textContent = '\u2713 Collect Payment'; showToast(data.error || 'Error', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = '\u2713 Collect Payment'; showToast('Connection error.', 'err'); }
}

// -- Payout --------------------------------------------------------------------
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
        const data = await apiPost(params);
        if (data.success) {
            closeModal('payoutModal');
            if (typeof haptic === 'function') haptic('success');
            if (typeof sendNotification === 'function')
                sendNotification('manageronly', 'Payout Logged', currentUser + ' logged a ' + bz(amount) + ' payout: ' + reason);
            showToast('Payout logged!', 'ok');
            await loadAll();
            if (data.payoutId && typeof printPayoutSlip === 'function' && confirm('Print payout slip now?')) {
                printPayoutSlip(data.payoutId);
            }
        } else { btn.disabled = false; btn.textContent = 'Log Payout'; showToast(data.error || 'Error', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Log Payout'; showToast('Connection error.', 'err'); }
}

// -- Bills ---------------------------------------------------------------------
function openBillModal() {
    document.getElementById('billPerson').value = '';
    document.getElementById('billLineItems').innerHTML = '';
    document.getElementById('billSubmitBtn').disabled = false;
    document.getElementById('billSubmitBtn').textContent = 'Open Bill';
    addBillLine(); updateBillTotal(); openModal('billModal');
    if (!window._inventoryCache) loadInventoryCache();
}

function addBillLine(name, qty, price, sku) {
    name = name || ''; qty = qty || 1; price = price || ''; sku = sku || '';
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.dataset.sku = sku; // Track SKU for inventory deduction
    const dropId = 'bill-ac-' + Date.now() + Math.random().toString(36).slice(2);
    row.innerHTML =
        '<div style="position:relative;flex:1;">'
        + '<input class="line-input" type="text" placeholder="Item name or description..." value="' + escH(name) + '" autocomplete="off"'
        + ' oninput="billLineAutocomplete(this,\'' + dropId + '\')" onkeydown="billLineItemKey(event,this,\'' + dropId + '\')"'
        + ' onblur="setTimeout(()=>{const d=document.getElementById(\'' + dropId + '\');if(d)d.style.display=\'none\';},250)">'
        + '<div id="' + dropId + '" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:500;background:var(--glass-strong);border:1px solid var(--glass-border);border-radius:10px;box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto;"></div>'
        + '</div>'
        + '<input class="line-input" type="number" placeholder="Qty" value="' + qty + '" min="1" style="text-align:center;" oninput="updateBillTotal()">'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateBillTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateBillTotal()">' + (typeof scIcon === 'function' ? scIcon('x', 14) : '×') + '</button>';
    document.getElementById('billLineItems').appendChild(row);
}

function _billLineHintFooter(q) {
    return '<div style="padding:8px 14px;font-size:0.72rem;color:var(--text-dim);background:rgba(var(--primary-rgb),0.04);border-top:1px solid var(--glass-border);text-align:center;"><strong>Enter</strong> = Add top match  •  <strong>Shift+Enter</strong> = Add "' + escH(q) + '" as custom</div>';
}

function _billLineMatchHtml(matches, selectFn) {
    return matches.map(i => {
        const stock = parseInt(i.qty) || 0;
        const stockColor = stock <= 0 ? 'var(--danger)' : stock <= (parseInt(i.minQty) || 0) ? 'var(--warning)' : 'var(--success)';
        return '<div onclick="' + selectFn + '(this,\'' + escH(i.sku) + '\')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--glass-border);transition:background 0.15s;" onmouseover="this.style.background=\'rgba(var(--primary-rgb),0.08)\'" onmouseout="this.style.background=\'transparent\'">'
            + '<div style="font-weight:700;font-size:0.85rem;">' + escH(i.name) + '</div>'
            + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">'
            + escH(i.sku) + ' · BZ$' + (parseFloat(i.salePrice) || 0).toFixed(2)
            + ' · <span style="color:' + stockColor + ';font-weight:700;">' + stock + ' in stock</span>'
            + '</div></div>';
    }).join('');
}

function _billInventoryMatches(q) {
    const qLower = q.toLowerCase();
    return (window._inventoryCache || []).filter(i =>
        (i.name || '').toLowerCase().includes(qLower) || String(i.sku || '').toLowerCase().includes(qLower)
    ).slice(0, 8);
}

function _applyBillItemToRow(row, item) {
    if (!row || !item) return;
    row.dataset.sku = item.sku || '';
    const inputs = row.querySelectorAll('input');
    inputs[0].value = item.name || '';
    inputs[2].value = parseFloat(item.salePrice) || 0;
    if (row.closest('#editBillLineItems')) updateEditBillTotal();
    else updateBillTotal();
    const drop = row.querySelector('[id^="bill-ac-"], [id^="edit-bill-ac-"]');
    if (drop) drop.style.display = 'none';
    if (inputs[1]) inputs[1].focus();
}

function billLineItemKey(e, el, dropId) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = (el.value || '').trim();
    if (!q) return;
    const row = el.closest('.line-item-row');
    const drop = document.getElementById(dropId);

    if (e.shiftKey) {
        if (row) row.dataset.sku = '';
        if (drop) drop.style.display = 'none';
        row?.querySelectorAll('input')[1]?.focus();
        return;
    }

    const inv = window._inventoryCache || [];
    const qLower = q.toLowerCase();
    const exact = inv.find(i => String(i.sku).toLowerCase() === qLower || (i.name || '').toLowerCase() === qLower);
    if (exact) { _applyBillItemToRow(row, exact); return; }

    const partial = inv.find(i =>
        (i.name || '').toLowerCase().includes(qLower) || String(i.sku || '').toLowerCase().includes(qLower)
    );
    if (partial) { _applyBillItemToRow(row, partial); return; }

    if (row) row.dataset.sku = '';
    if (drop) drop.style.display = 'none';
    row?.querySelectorAll('input')[1]?.focus();
}

// Autocomplete for bill line items (same as sales)
function billLineAutocomplete(el, dropId) {
    const q = (el.value || '').trim();
    const drop = document.getElementById(dropId);
    if (!q) { drop.style.display = 'none'; return; }
    const matches = _billInventoryMatches(q);
    drop.style.display = 'block';
    if (!matches.length) {
        drop.innerHTML = '<div style="padding:10px 14px;font-size:0.8rem;color:var(--text-dim);">No match — press <strong>Enter</strong> to add as custom item</div>'
            + _billLineHintFooter(q);
        return;
    }
    drop.innerHTML = _billLineMatchHtml(matches, 'selectBillItem') + _billLineHintFooter(q);
}

function selectBillItem(el, sku) {
    const item = (window._inventoryCache || []).find(i => String(i.sku) === String(sku));
    if (!item) return;
    const row = el.closest('.line-item-row');
    if (!row) return;
    _applyBillItemToRow(row, item);
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
        const sku = r.dataset.sku || ''; // Get SKU from row dataset
        if (name) items.push({ name, qty, price, total: qty * price, sku });
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
        const data = await apiPost(params);
        if (data.success) {
            closeModal('billModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill opened!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Open Bill'; showToast(data.error || 'Error', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Open Bill'; showToast('Connection error.', 'err'); }
}

// -- Edit Bill -----------------------------------------------------------------
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
    if (items.length) items.forEach(i => addEditBillLine(i.name, i.qty, i.price, i.sku));
    else addEditBillLine();
    updateEditBillTotal();
    openModal('editBillModal');
    if (!window._inventoryCache) loadInventoryCache();
}

function addEditBillLine(name, qty, price, sku) {
    name = name || ''; qty = qty || 1; price = price || ''; sku = sku || '';
    const row = document.createElement('div');
    row.className = 'line-item-row';
    row.dataset.sku = sku; // Track SKU for inventory deduction
    const dropId = 'edit-bill-ac-' + Date.now() + Math.random().toString(36).slice(2);
    row.innerHTML =
        '<div style="position:relative;flex:1;">'
        + '<input class="line-input" type="text" placeholder="Item name or description..." value="' + escH(name) + '" autocomplete="off"'
        + ' oninput="editBillLineAutocomplete(this,\'' + dropId + '\')" onkeydown="billLineItemKey(event,this,\'' + dropId + '\')"'
        + ' onblur="setTimeout(()=>{const d=document.getElementById(\'' + dropId + '\');if(d)d.style.display=\'none\';},250)">'
        + '<div id="' + dropId + '" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:500;background:var(--glass-strong);border:1px solid var(--glass-border);border-radius:10px;box-shadow:var(--shadow-md);max-height:180px;overflow-y:auto;"></div>'
        + '</div>'
        + '<input class="line-input" type="number" placeholder="Qty" value="' + qty + '" min="1" style="text-align:center;" oninput="updateEditBillTotal()">'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateEditBillTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateEditBillTotal()">&#x2715;</button>';
    document.getElementById('editBillLineItems').appendChild(row);
}

// Autocomplete for edit bill line items (same as new bill)
function editBillLineAutocomplete(el, dropId) {
    const q = (el.value || '').trim();
    const drop = document.getElementById(dropId);
    if (!q) { drop.style.display = 'none'; return; }
    const matches = _billInventoryMatches(q);
    drop.style.display = 'block';
    if (!matches.length) {
        drop.innerHTML = '<div style="padding:10px 14px;font-size:0.8rem;color:var(--text-dim);">No match — press <strong>Enter</strong> to add as custom item</div>'
            + _billLineHintFooter(q);
        return;
    }
    drop.innerHTML = _billLineMatchHtml(matches, 'selectEditBillItem') + _billLineHintFooter(q);
}

function selectEditBillItem(el, sku) {
    const item = (window._inventoryCache || []).find(i => String(i.sku) === String(sku));
    if (!item) return;
    const row = el.closest('.line-item-row');
    if (!row) return;
    _applyBillItemToRow(row, item);
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
        const sku = r.dataset.sku || ''; // Get SKU from row dataset
        if (name) items.push({ name, qty, price, total: qty * price, sku });
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
        const data = await apiPost(params);
        if (data.success) {
            closeModal('editBillModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill updated!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Save Changes'; showToast(data.error || 'Error', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Save Changes'; showToast('Connection error.', 'err'); }
}

// -- Settle Bill ---------------------------------------------------------------
function openSettleBill(billId) {
    const b = allBills.find(x => String(x.billId) === String(billId));
    if (!b) return;
    settlingBillId = billId;
    const balance = Math.max(0, (parseFloat(b.totalOwed) || 0) - (parseFloat(b.totalPaid) || 0));
    document.getElementById('settleBillInfo').innerHTML =
        '<strong>' + escH(b.personName || 'Unknown') + '</strong>'
        + '<br>Total: ' + bz(b.totalOwed) + ' &nbsp;·&nbsp; Paid: ' + bz(b.totalPaid)
        + ' &nbsp;·&nbsp; <strong>Remaining: ' + bz(balance) + '</strong>';
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
        disp.textContent = '\u2713 Bill fully settled!';
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
        const params = new URLSearchParams({
            action: 'settlebill', billId: settlingBillId, amount, payMethod: method,
            cashier: currentUser, shiftDate: getShiftDate()
        });
        const data = await apiPost(params);
        if (data.success) {
            // Deduct inventory for items with SKUs when bill is fully settled
            const bill = allBills.find(b => String(b.billId) === String(settlingBillId));
            if (bill) {
                const balance = Math.max(0, (parseFloat(bill.totalOwed) || 0) - (parseFloat(bill.totalPaid) || 0));
                const isFullySettled = balance - amount <= 0.01; // Check if this payment settles the bill
                
                if (isFullySettled) {
                    const items = tryParseJSON(bill.items, []);
                    // Deduct inventory for each item with a SKU
                    items.forEach(item => {
                        if (item.sku && String(item.sku).trim()) {
                            const qty = Math.abs(Number(item.qty) || 1);
                            const adjustParams = new URLSearchParams({
                                action: 'adjuststock',
                                sku: item.sku,
                                qty: qty,
                                type: 'remove',
                                reason: 'Bill settled - ' + settlingBillId,
                                updatedBy: currentUser
                            });
                            // Fire and forget - don't block settlement if inventory fails
                            apiPostAsync(adjustParams);
                        }
                    });
                }
            }
            
            closeModal('settleBillModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Bill settled!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Settle'; showToast(data.error || 'Error', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Settle'; showToast('Connection error.', 'err'); }
}

// -- View Sale -----------------------------------------------------------------
let _viewedSale = null;

function openViewSale(saleId) {
    const s = allSales.find(x => String(x.saleId) === String(saleId));
    if (!s) return;
    _viewedSale = s;
    const items  = tryParseJSON(s.items, []);
    const ts     = s.timestamp ? new Date(s.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    
    // Transaction total (goes to gross sales) vs Amount Tendered
    const transactionTotal = parseFloat(s.total) || 0;
    const amountTendered   = parseFloat(s.amountPaid) || 0;
    const change           = s.method === 'cash' ? Math.max(0, amountTendered - transactionTotal) : 0;
    
    const methodDisplay = (s.method || 'cash').charAt(0).toUpperCase() + (s.method || 'cash').slice(1);
    const itemRows = items.map(i =>
        '<tr>'
        + '<td style="font-weight:600;">' + escH(i.name || '—') + '</td>'
        + '<td style="color:var(--text-dim);">×' + (i.qty || 1) + '</td>'
        + '<td>' + bz(i.price) + '</td>'
        + '<td style="font-weight:800;">' + bz((i.qty||1) * (i.price||0)) + '</td>'
        + '</tr>'
    ).join('');
    
    // Build status badge - only show if reversed or partial
    let statusBadgeHTML = '';
    if (s.status === 'reversed') {
        statusBadgeHTML = '<div class="receipt-meta-item"><div class="receipt-meta-label">Status</div><div class="receipt-meta-value"><span class="receipt-badge reversed">Reversed</span></div></div>';
    } else if (s.method === 'partial') {
        statusBadgeHTML = '<div class="receipt-meta-item"><div class="receipt-meta-label">Status</div><div class="receipt-meta-value"><span class="receipt-badge partial">Partial</span></div></div>';
    }
    
    document.getElementById('viewSaleContent').innerHTML =
        '<div class="receipt-header">'
        + '<h3>ServiCell Belize</h3>'
        + '<p>' + escH(ts) + '</p>'
        + '<p>Receipt #<strong>' + escH(s.saleId || '') + '</strong></p>'
        + '</div>'
        + '<div class="receipt-meta">'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Cashier</div><div class="receipt-meta-value">' + escH(s.cashier || '—') + '</div></div>'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Shift</div><div class="receipt-meta-value">' + escH(s.shift || '—') + '</div></div>'
        + '<div class="receipt-meta-item"><div class="receipt-meta-label">Method</div><div class="receipt-meta-value">' + escH(methodDisplay) + '</div></div>'
        + statusBadgeHTML
        + '</div>'
        + '<table class="receipt-items">'
        + '<tr><th style="text-align:left;">Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>'
        + itemRows
        + '</table>'
        + '<div class="receipt-totals">'
        + '<div class="receipt-total-row"><span style="color:var(--text-dim);">Transaction Total</span><span>' + bz(transactionTotal) + '</span></div>'
        + (s.method === 'cash' ? '<div class="receipt-total-row"><span style="color:var(--text-dim);">Tendered</span><span>' + bz(amountTendered) + '</span></div>' : '')
        + (s.method === 'card' ? '<div class="receipt-total-row"><span style="color:var(--text-dim);">Charged</span><span>' + bz(amountTendered) + '</span></div>' : '')
        + (s.method === 'partial' ? '<div class="receipt-total-row"><span style="color:var(--warning);">Paid</span><span style="color:var(--warning);">' + bz(amountTendered) + '</span></div>' : '')
        + (change > 0.01 ? '<div class="receipt-total-row"><span style="color:var(--success);">Change Given</span><span style="color:var(--success);font-weight:800;">' + bz(change) + '</span></div>' : '')
        + '<div class="receipt-total-row main"><span>Collected</span><span>' + bz(saleCollectedAmount(s)) + '</span></div>'
        + (s.method === 'partial' ? '<div class="receipt-total-row"><span style="color:var(--warning);">Still Owed</span><span style="color:var(--warning);">' + bz(saleOutstanding(s)) + '</span></div>' : '')
        + '</div>';
    openModal('viewSaleModal');
}

function printViewedSale() {
    if (!_viewedSale) return;
    const s     = _viewedSale;
    const items = tryParseJSON(s.items, []);
    kickDrawer();
    _printSaleReceipt(
        items,
        parseFloat(s.total) || 0,
        parseFloat(s.amountPaid) || 0,
        s.method || 'cash',
        s.saleId || '',
        s.customer || '',
        s.cashier || ''
    );
}

// -- Edit Sale -----------------------------------------------------------------
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
        '<input class="line-input" type="text" placeholder="Item name or description..." value="' + escH(name) + '" oninput="updateEditSaleTotal()">'
        + '<input class="line-input" type="number" placeholder="Qty" value="' + qty + '" min="1" style="text-align:center;" oninput="updateEditSaleTotal()">'
        + '<input class="line-input" type="number" placeholder="Price" value="' + escH(price) + '" min="0" step="0.01" style="text-align:right;" oninput="updateEditSaleTotal()">'
        + '<button class="line-remove" onclick="this.closest(\'.line-item-row\').remove();updateEditSaleTotal()">' + (typeof scIcon === 'function' ? scIcon('x', 14) : '×') + '</button>';
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
        const data = await apiPost(params);
        if (data.success) {
            closeModal('editSaleModal');
            if (typeof haptic === 'function') haptic('success');
            showToast('Sale updated!', 'ok');
            await loadAll();
        } else { btn.disabled = false; btn.textContent = 'Save Changes'; showToast(data.error || 'Error', 'err'); }
    } catch (e) { btn.disabled = false; btn.textContent = 'Save Changes'; showToast('Connection error.', 'err'); }
}

// -- Reverse Sale --------------------------------------------------------------
let _reversingSaleId = null;

function reverseSale(saleId) {
    const s = allSales.find(x => String(x.saleId) === String(saleId));
    if (!s) return;
    _reversingSaleId = saleId;
    const items = tryParseJSON(s.items, []);
    const desc  = items.map(i => i.name).join(', ') || 'Sale';
    const methodDisplay = (s.method || 'cash').charAt(0).toUpperCase() + (s.method || 'cash').slice(1);
    document.getElementById('reverseSaleInfo').innerHTML =
        '<strong>' + escH(desc) + '</strong>'
        + '<br>Amount: ' + bz(s.amountPaid)
        + ' &nbsp;&bull;&nbsp; Method: ' + escH(methodDisplay)
        + (s.cashier ? ' &nbsp;&bull;&nbsp; By: ' + escH(s.cashier) : '');
    document.getElementById('reverseReason').value = '';
    document.getElementById('reverseConfirmCheck').checked = false;
    document.getElementById('reverseSubmitBtn').disabled = true;
    const revBtn = document.getElementById('reverseSubmitBtn');
    if (revBtn) {
        revBtn.textContent = 'Confirm Reversal';
        if (typeof initDataIcons === 'function') initDataIcons(revBtn.parentElement || document);
    }
    openModal('reverseSaleModal');
    setTimeout(() => document.getElementById('reverseReason').focus(), 300);
}

function toggleReverseButton() {
    const checkbox = document.getElementById('reverseConfirmCheck');
    const btn = document.getElementById('reverseSubmitBtn');
    btn.disabled = !checkbox.checked;
}

async function submitReverse() {
    if (!_reversingSaleId) return;
    const reason = document.getElementById('reverseReason').value.trim();
    if (!reason) { alert('Please enter a reason for the reversal.'); return; }
    const btn = document.getElementById('reverseSubmitBtn');
    btn.disabled = true; btn.textContent = 'Reversing...';
    try {
        const params = new URLSearchParams({ action: 'reversesale', saleId: _reversingSaleId, reason, cashier: currentUser });
        const data = await apiPost(params);
        if (data.success) {
            // Restore inventory for any SKU-linked items
            const s = allSales.find(x => String(x.saleId) === String(_reversingSaleId));
            if (s) {
                const items = tryParseJSON(s.items, []);
                items.forEach(item => {
                    if (item.sku) {
                        const params = new URLSearchParams({
                            action: 'adjuststock', sku: item.sku,
                            qty: Math.abs(Number(item.qty) || 1), type: 'add',
                            reason: 'Reversal  —  ' + _reversingSaleId, updatedBy: currentUser
                        });
                        apiPostAsync(params);
                    }
                });
            }
            closeModal('reverseSaleModal');
            if (typeof haptic === 'function') haptic('medium');
            showToast('Sale reversed.', '');
            await loadAll();
        } else {
            btn.disabled = false; btn.textContent = 'Confirm Reversal';
            if (typeof initDataIcons === 'function') initDataIcons(btn);
            showToast(data.error || 'Could not reverse.', 'err');
        }
    } catch (e) {
        btn.disabled = false; btn.textContent = 'Confirm Reversal';
        if (typeof initDataIcons === 'function') initDataIcons(btn);
        showToast('Connection error.', 'err');
    }
}

// -- Deduct Inventory ----------------------------------------------------------
async function deductInventory(sku, qty, saleId) {
    try {
        const params = new URLSearchParams({ action: 'adjuststock', sku, qty, type: 'remove', reason: 'Sale #' + saleId, saleId });
        await apiPostAsync(params);
    } catch (e) { console.warn('Inventory deduct failed:', e); }
}

// -- Payout slip printing -------------------------------------------------------
function printPayoutSlip(payoutId) {
    const p = allPayouts.find(x => String(x.payoutId) === String(payoutId));
    if (!p) { showToast('Payout not found', 'err'); return; }
    if (typeof buildPayoutSlipHTML !== 'function') { showToast('Print module not loaded', 'err'); return; }
    const html = buildPayoutSlipHTML(p, currentUser);
    if (typeof printHTML === 'function') printHTML(html);
    else _openAndPrint(html);
}

// -- Receipt Printing ----------------------------------------------------------
function printReceipt(items, total, amountPaid, method, saleId, customer) {
    if (localStorage.getItem('scAutoPrintReceipt') !== '1') return;
    kickDrawer();
    _printSaleReceipt(items, total, amountPaid, method, saleId, customer, currentUser);
}

// -- Modal Helpers -------------------------------------------------------------
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

// -- Sync State ----------------------------------------------------------------
function setSyncState(state, text) {
    const dot = document.getElementById('syncDot');
    const txt = document.getElementById('syncText');
    if (dot) dot.className = 'sync-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
    if (txt) txt.textContent = text;
}

// -- Toast ---------------------------------------------------------------------
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

// -- Init ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    currentUser = localStorage.getItem('scUser') || sessionStorage.getItem('scUser') || 'Cashier';
    isManager   = typeof getEffectiveRole === 'function'
        ? getEffectiveRole(currentUser) === 'manager'
        : currentUser.toLowerCase().startsWith('manager');
    
    // Apply manager class to body for CSS-based role visibility
    if (isManager) {
        document.body.classList.add('is-manager');
    }
    
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
    initEODShiftPills();
    if (typeof initDataIcons === 'function') initDataIcons();
});

window.addEventListener('sc-back-online', function () { loadAll(); });
