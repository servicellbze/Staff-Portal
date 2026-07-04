// ── Shared Receipt Helper ─────────────────────────────────────────────────────
// Used by: current-jobs.html, new-job.html, sales.js
// Requires: js/qz-drawer.js loaded before this file

const RECEIPT_STYLES = `
@media print { @page { size: 72mm auto; margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; color: #000 !important; background: transparent !important; } body, #printInvoice, .po-slip, .po-report { background: white !important; color: #000 !important; } body:has(.po-slip) { text-align: left; } img { display: block !important; } }
#printInvoice { font-family: 'IBM Plex Mono','Courier New',monospace; color: #000; background: white; width: 68mm; margin: 0 auto; padding: 0 0 40mm; font-size: 10px; font-weight: 700; line-height: 1.6; letter-spacing: -0.1px; }
#printInvoice * { font-weight: 700; box-sizing: border-box; color: #000; }
.pi-shop { text-align: center; margin-bottom: 5px; }
.pi-shop img { max-width: 70px; margin-bottom: 3px; display: block; margin-left: auto; margin-right: auto; }
.pi-shop h1 { font-size: 14px; font-weight: 900; letter-spacing: 1px; margin: 0 0 2px; }
.pi-shop p { font-size: 9px; margin: 1px 0; letter-spacing: 0; }
.pi-rule { border: none; border-top: 2px solid #000; margin: 5px 0 4px; }
.pi-dash { border: none; border-top: 1px solid #000; margin: 4px 0 3px; }
.pi-title { text-align: center; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 3px 0 4px; }
.pi-meta { font-size: 9px; line-height: 1.6; margin-bottom: 3px; }
.pi-meta-row { font-size: 9px; margin: 3px 0 4px; padding: 3px 5px; background: transparent; border: 1px solid #000; line-height: 1.6; }
.pi-meta-row strong { display: block; }
.pi-section { font-size: 8px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin: 4px 0 2px; }
.pi-grid { margin-bottom: 3px; }
.pi-field-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2px; }
.pi-field-value { font-size: 10px; padding: 1px 0; border-bottom: 1px solid #000; min-height: 14px; margin-bottom: 3px; }
.pi-notes { border: 1px solid #000; padding: 3px 4px; min-height: 28px; font-size: 9px; line-height: 1.5; margin: 2px 0 5px; }
.pi-cost-table { width: 100%; border-collapse: collapse; margin: 3px 0 5px; font-size: 9px; }
.pi-cost-table th { text-align: left; font-size: 8px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; padding: 2px 0; border-bottom: 2px solid #000; }
.pi-cost-table th:last-child { text-align: right; }
.pi-cost-table td { padding: 3px 0; border-bottom: 1px solid #000; }
.pi-cost-table td:last-child { text-align: right; }
.pi-cost-table .pi-total-row td { border-top: 2px solid #000; border-bottom: none; font-size: 11px; font-weight: 900; padding-top: 4px; }
.pi-payment-status { text-align: center; font-size: 9px; margin: 4px 0 5px; padding: 3px 5px; background: transparent; border: 1px solid #000; font-weight: 900; }
.pi-footer { text-align: center; font-size: 9px; margin-top: 6px; border-top: 1px solid #000; padding-top: 4px; line-height: 1.6; }
.pi-qr { text-align: center; margin-top: 8px; }
.pi-qr img { max-width: 120px; margin: 0 auto 4px; display: block !important; }
.pi-qr-text { font-size: 9px; font-weight: 900; letter-spacing: 0.5px; }
.pi-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.pi-sig { border-top: 1px solid #000; padding-top: 2px; font-size: 8px; text-align: center; }
.po-slip { font-family: 'IBM Plex Mono','Courier New',monospace; color: #000; background: #fff; width: 68mm; margin: 0 auto; padding: 3mm 2mm 40mm; font-size: 10px; font-weight: 400; line-height: 1.45; text-align: left; }
.po-slip * { box-sizing: border-box; color: #000; }
.po-rule-eq { display: block; width: 100%; height: 0; border: none; border-top: 2px solid #000; margin: 7px 0; }
.po-rule-dash { display: block; width: 100%; height: 0; border: none; border-top: 1px dashed #000; margin: 7px 0; }
.po-banner { text-align: center; margin: 5px 0; }
.po-company { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; margin: 0 0 3px; }
.po-title { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; margin: 0; }
.po-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 9px; line-height: 1.55; margin: 1px 0; font-weight: 400; }
.po-meta-row span:last-child { text-align: right; white-space: nowrap; flex-shrink: 0; }
.po-meta-row span:first-child { min-width: 0; word-break: break-word; }
.po-block { margin: 2px 0; }
.po-line { font-size: 10px; font-weight: 400; line-height: 1.55; margin: 2px 0; word-break: break-word; }
.po-line .po-k { font-weight: 700; }
.po-line-label { font-size: 10px; font-weight: 700; margin: 0 0 2px; line-height: 1.55; }
.po-line-body { font-size: 10px; font-weight: 400; line-height: 1.45; word-break: break-word; margin: 0 0 2px; }
.po-total-line { font-size: 10px; font-weight: 400; line-height: 1.55; margin: 2px 0 0; }
.po-total-line .po-k { font-weight: 700; }
.po-words { font-size: 10px; font-weight: 400; line-height: 1.45; margin: 0 0 2px; }
.po-foot { margin-top: 2px; font-size: 9px; font-weight: 400; text-align: center; line-height: 1.5; }
.po-slip#printInvoice, .po-slip#printInvoice * { font-weight: 400; }
.po-slip#printInvoice .po-k, .po-slip#printInvoice .po-line-label, .po-slip#printInvoice .po-company, .po-slip#printInvoice .po-title { font-weight: 700; }
.po-report { font-family: 'IBM Plex Mono','Courier New',monospace; color: #000; background: #fff; width: 68mm; margin: 0 auto; padding: 3mm 2mm 40mm; font-weight: 400; }
.po-report * { box-sizing: border-box; color: #000; }
.po-report-head { text-align: center; margin-bottom: 4px; }
.po-report-company { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 0 0 2px; }
.po-report-title { font-size: 10px; font-weight: 700; margin: 0 0 2px; }
.po-report-date { font-size: 10px; font-weight: 400; margin: 0 0 2px; }
.po-report-rule { height: 0; border: none; border-top: 2px solid #000; margin: 6px 0; }
.po-report-table { width: 100%; border-collapse: collapse; font-size: 9px; font-weight: 400; }
.po-report-table th { text-align: left; font-size: 8px; font-weight: 700; padding: 3px 0; border-bottom: 2px solid #000; }
.po-report-table th.col-amt { text-align: right; }
.po-report-table td { padding: 3px 0; border-bottom: 1px solid #000; vertical-align: top; word-break: break-word; }
.po-report-table td.col-amt { text-align: right; font-weight: 700; white-space: nowrap; }
.po-report-table tr.total td { border-top: 3px solid #000; border-bottom: none; font-size: 11px; font-weight: 700; padding-top: 5px; }
.po-report-table tr.total td.col-amt { text-align: right; }
.po-report-table td.empty { text-align: center; padding: 10px 0; border-bottom: none; }
.po-report-foot { text-align: center; font-size: 8px; font-weight: 400; margin-top: 8px; border-top: 1px dashed #000; padding-top: 5px; line-height: 1.4; }
.po-report#printInvoice, .po-report#printInvoice * { font-weight: 400; }
.po-report#printInvoice .po-report-company, .po-report#printInvoice .po-report-title, .po-report#printInvoice th, .po-report#printInvoice tr.total td, .po-report#printInvoice td.col-amt { font-weight: 700; }
`;

const RECEIPT_FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap">';
const PO_FONT_LINK = RECEIPT_FONT_LINK;
const QR_LIBRARY = '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>';

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Job Receipt (current-jobs.html + new-job.html) ────────────────────────────
function buildJobReceiptHTML(j, opts) {
    opts = opts || {};
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    function bzDate(d) {
        if (!d || d === '—') return '—';
        try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
        catch(_) { return d; }
    }

    function fmtPhone(p) {
        if (!p) return '—';
        const c = p.replace(/\D/g,'');
        return c.length === 7 ? '+501 ' + c.slice(0,3) + '-' + c.slice(3) : p;
    }

    function fmtStatus(s) {
        return ({ ordered:'Parts Ordered', received:'Received', inqueue:'In Queue',
                  fixing:'Being Repaired', testing:'Testing', ready:'Ready for Pickup' })[s] || s || '—';
    }

    const priorityLabel = (j.priority||'low').toLowerCase() === 'high' ? 'HIGH — URGENT' : 'LOW — NORMAL';
    const receivedDate  = j.dateReceived ? bzDate(j.dateReceived) : today;
    const estimatedDate = j.estimatedCompletion || '—';

    // Cost table
    const items = (() => {
        if (!j.invoiceItems || j.invoiceItems === '—') return [];
        try { return JSON.parse(j.invoiceItems); } catch(_) { return []; }
    })();
    const total = items.reduce((s,i) => s + (parseFloat(i.price||0)||0), 0);

    let paymentStatus = 'N/A — Invoice Pending';
    if (items.length && total > 0) {
        const p = String(j.payment||'unpaid').toLowerCase();
        paymentStatus = p.startsWith('paid') ? 'Paid via ' + (p.includes('card') ? 'Card' : 'Cash') : 'UNPAID';
    }

    const costTableHTML = items.length ? `
        <table class="pi-cost-table">
            <thead><tr><th>Service</th><th>BZD</th></tr></thead>
            <tbody>
                ${items.map(i => `<tr><td>${_esc(i.desc||'')}</td><td>${(parseFloat(i.price||0)||0).toFixed(2)}</td></tr>`).join('')}
                <tr class="pi-total-row"><td><strong>TOTAL</strong></td><td><strong>${total.toFixed(2)}</strong></td></tr>
            </tbody>
        </table>` :
        `<div class="pi-notes" style="text-align:center;"><strong>Price To Be Determined</strong><br><span style="font-size:7px;">Final cost after diagnostic.</span></div>`;

    const imgSrc = opts.imgSrc || 'img/logo.png';
    
    // Generate QR code URL for job tracking
    const jobId = j.id;
    const trackerUrl = `https://servicellbze.github.io/ServiCell/tracker.html?job=${jobId}`;
    // Use quickchart.io - a free, reliable QR code API
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(trackerUrl)}&size=150`;

    return `<style>${RECEIPT_STYLES}</style>${RECEIPT_FONT_LINK}
<div id="printInvoice">
    <div class="pi-shop">
        <img src="${imgSrc}" alt="Servicell Belize">
        <h1>SERVICELL BELIZE</h1>
        <p>Device Repair &amp; Services &middot; Belize City, Belize</p>
        <p>Tel: +501 615-3388</p>
    </div>
    <hr class="pi-rule">
    <div class="pi-title">Job Receipt &amp; Intake Form</div>
    <div class="pi-meta">
        <div><strong>JOB #:</strong> ${_esc(j.id)}</div>
        <div><strong>DATE:</strong> ${_esc(receivedDate)}</div>
    </div>
    <div class="pi-meta-row">
        <strong>Type: ${_esc(j.jobType||'Repair')}</strong>
        <strong>Priority: ${_esc(priorityLabel)}</strong>
    </div>
    <hr class="pi-dash">
    <div class="pi-section">Customer Information</div>
    <div class="pi-grid">
        <div class="pi-field-label">Name</div>
        <div class="pi-field-value">${_esc(j.customerName||'Walk-in')}</div>
        <div class="pi-field-label">Phone</div>
        <div class="pi-field-value">${_esc(fmtPhone(j.customerPhone))}</div>
    </div>
    <div class="pi-section">Device Information</div>
    <div class="pi-grid">
        <div class="pi-field-label">Device</div>
        <div class="pi-field-value">${_esc(j.device||'—')}</div>
        <div class="pi-field-label">Issue Reported</div>
        <div class="pi-field-value">${_esc(j.issue||'—')}</div>
        <div class="pi-field-label">Status</div>
        <div class="pi-field-value">${_esc(fmtStatus(j.status))}</div>
        <div class="pi-field-label">${j.dateCompleted ? 'Completed On' : 'Est. Completion'}</div>
        <div class="pi-field-value">${_esc(j.dateCompleted ? bzDate(j.dateCompleted) : estimatedDate)}</div>
    </div>
    <div class="pi-section">Work Notes</div>
    <div class="pi-notes">${_esc(j.notes||'No additional notes.')}</div>
    <div class="pi-section">Cost Breakdown</div>
    ${costTableHTML}
    <div class="pi-payment-status"><strong>Payment Status:</strong> ${_esc(paymentStatus)}</div>
    <div class="pi-footer">Thank you for choosing Servicell Belize!<br>Devices not collected within <strong>90 days of completion</strong> may be considered <strong>abandoned</strong>.<br>We are not responsible for data loss. Please back up your device.</div>
    <hr class="pi-dash">
    <div class="pi-qr">
        <img src="${qrCodeUrl}" alt="Track Your Repair">
        <div class="pi-qr-text">SCAN TO TRACK YOUR REPAIR</div>
    </div>
</div>`;
}

// ── Sale Receipt (sales.js) ───────────────────────────────────────────────────
function buildSaleReceiptHTML(items, total, amountPaid, method, saleId, customer, cashier) {
    const change = method === 'cash' ? Math.max(0, amountPaid - total) : 0;
    // GST is included in the price (12.5% of pre-tax = total × 12.5/112.5)
    const gst     = total * 12.5 / 112.5;
    const preTax  = total - gst;
    function bz(n) { return 'BZ$' + parseFloat(n||0).toFixed(2); }
    
    // Map technical names to friendly first names
    const nameMap = {
        'Cashier_Chee': 'Ericson',
        'Cashier_Coleman': 'Kiana',
        'Technician_Bailey': 'Kareem',
        'Technician_Bat': 'Bat',
        'Manager_Chee': 'Eric'
    };
    
    const friendlyName = cashier ? (nameMap[cashier] || cashier.replace(/^(Cashier_|Manager_|Technician_)/i, '')) : 'Staff';
    
    // Capitalize payment method for professional display
    const displayMethod = method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Cash';

    const rows = items.map(i =>
        `<tr><td>${_esc(i.name)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${bz(i.price)}</td><td style="text-align:right">${bz(i.total)}</td></tr>`
    ).join('');

    return `<style>
@media print { @page { size: 72mm auto; margin: 0; } * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color:#000!important; background:transparent!important; } body { background:white!important; } }
body { font-family:'IBM Plex Mono','Courier New',monospace; font-size:10px; font-weight:700; width:68mm; margin:0 auto; padding:0 0 40mm; line-height:1.6; letter-spacing:-0.1px; background:white; color:#000; }
* { box-sizing:border-box; font-weight:700; color:#000; }
h2 { text-align:center; font-size:14px; font-weight:900; letter-spacing:1px; margin:0 0 2px; }
p { text-align:center; margin:1px 0; font-size:9px; }
img { display:block; margin:0 auto 3px; max-width:70px; }
hr { border:none; border-top:1px solid #000; margin:4px 0 3px; }
hr.solid { border-top:2px solid #000; margin:5px 0 4px; }
table { width:100%; border-collapse:collapse; font-size:9px; }
th { border-bottom:2px solid #000; padding:3px 0; font-size:8px; text-align:left; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; }
th:nth-child(2),th:nth-child(3),th:nth-child(4) { text-align:right; }
td { padding:3px 0; border-bottom:1px solid #000; }
.divider td { border-top:2px solid #000; border-bottom:none; font-size:11px; font-weight:900; padding-top:4px; }
.gst-row td { border-bottom:1px solid #000; font-size:9px; }
.footer { text-align:center; font-size:9px; margin-top:6px; border-top:1px solid #000; padding-top:4px; line-height:1.6; }
</style>${RECEIPT_FONT_LINK}
<img src="img/logo.png" alt="Servicell Belize">
<h2>SERVICELL BELIZE</h2>
<p>#7 Douglas Jones, Belize City</p>
<p>Tel: +501 615-3388</p>
<p>${new Date().toLocaleString()}</p>
<p>Served by: ${_esc(friendlyName)}</p>
${customer ? `<p>Customer: ${_esc(customer)}</p>` : ''}
<p>Receipt #${_esc(saleId||'')}</p>
<hr class="solid">
<table>
    <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
    ${rows}
    <tr class="divider"><td colspan="3">Subtotal (excl. GST)</td><td style="text-align:right">${bz(preTax)}</td></tr>
    <tr class="gst-row"><td colspan="3">GST (12.5%)</td><td style="text-align:right">${bz(gst)}</td></tr>
    <tr class="divider"><td colspan="3">TOTAL</td><td style="text-align:right">${bz(total)}</td></tr>
    <tr><td colspan="3">Paid (${_esc(displayMethod)})</td><td style="text-align:right">${bz(amountPaid)}</td></tr>
    ${change > 0 ? `<tr><td colspan="3">Change</td><td style="text-align:right">${bz(change)}</td></tr>` : ''}
</table>
<div class="footer">Thank you for choosing Servicell Belize!<br>Prices include GST.</div>`;
}

// ── Payout slip & report (sales.js) ───────────────────────────────────────────
function _intToWords(n) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'Zero';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) {
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + _intToWords(n % 100) : '');
    }
    if (n < 1000000) {
        return _intToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + _intToWords(n % 1000) : '');
    }
    return _intToWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + _intToWords(n % 1000000) : '');
}

function amountToWordsLine(amount) {
    const n = Math.round((parseFloat(amount) || 0) * 100) / 100;
    const dollars = Math.floor(n);
    const cents = Math.round((n - dollars) * 100);
    const dollarPart = _intToWords(dollars) + (dollars === 1 ? ' Dollar' : ' Dollars');
    if (cents > 0) {
        return dollarPart + ' and ' + _intToWords(cents) + (cents === 1 ? ' Cent' : ' Cents');
    }
    return dollarPart + ' only';
}

function amountToWords(amount) {
    return amountToWordsLine(amount);
}

function formatPayoutSlipDate(ts) {
    const d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return '— / — / —';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return dd + ' / ' + mm + ' / ' + yyyy;
}

function formatPayoutSlipDateShort(ts) {
    const d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return '—/—/—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
}

function formatPayoutSlipTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const STAFF_DISPLAY_NAMES = {
    cashier_chee:     'Ericson',
    cashier_coleman:  'Kiana',
    manager_chee:     'Eric',
    technician_bailey:'Kareem',
    technician_bat:   'Bat'
};

function resolveStaffDisplayName(username) {
    if (!username) return '—';
    const key = String(username).trim();
    const lower = key.toLowerCase();
    try {
        const sessionUser = localStorage.getItem('scUser') || sessionStorage.getItem('scUser') || '';
        const sessionName = localStorage.getItem('scDisplayName') || sessionStorage.getItem('scDisplayName') || '';
        if (sessionName && sessionUser.toLowerCase() === lower) return sessionName;
    } catch (_) {}
    if (STAFF_DISPLAY_NAMES[lower]) return STAFF_DISPLAY_NAMES[lower];
    return key.replace(/_/g, ' ');
}
window.resolveStaffDisplayName = resolveStaffDisplayName;

function buildPayoutSlipHTML(p, loggedByUser) {
    const amount     = parseFloat(p.amount) || 0;
    const slipNo     = p.payoutId || '—';
    const dateLong   = formatPayoutSlipDate(p.timestamp);
    const dateShort  = formatPayoutSlipDateShort(p.timestamp);
    const timeStr    = formatPayoutSlipTime(p.timestamp);
    const author     = p.loggedBy || loggedByUser || '';
    const issuedBy   = resolveStaffDisplayName(author);
    const receivedBy = p.takenBy || '—';
    const reasonRaw  = (p.reason || '').trim();
    const reason     = reasonRaw || '---';
    const shift      = p.shift || '—';
    const words      = amountToWordsLine(amount);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${PO_FONT_LINK}<style>${RECEIPT_STYLES}</style></head><body>
<div class="po-slip" id="printInvoice">
    <div class="po-rule-eq" aria-hidden="true"></div>
    <div class="po-banner">
        <div class="po-company">SERVICELL BELIZE</div>
        <div class="po-title">PAYOUT SLIP</div>
    </div>
    <div class="po-rule-eq" aria-hidden="true"></div>

    <div class="po-meta-row"><span>Slip No: #${_esc(slipNo)}</span><span>Date: ${dateShort}</span></div>
    <div class="po-meta-row"><span>Shift: ${_esc(shift)}</span><span>Time: ${timeStr}</span></div>

    <div class="po-rule-dash" aria-hidden="true"></div>

    <div class="po-block">
        <div class="po-line"><span class="po-k">ISSUED BY:</span> ${_esc(issuedBy)}</div>
        <div class="po-line"><span class="po-k">RECEIVED BY:</span> ${_esc(receivedBy)}</div>
    </div>

    <div class="po-rule-dash" aria-hidden="true"></div>

    <div class="po-block">
        <div class="po-line-label">PURPOSE / REASON:</div>
        <div class="po-line-body">${_esc(reason)}</div>
    </div>

    <div class="po-rule-dash" aria-hidden="true"></div>

    <div class="po-block">
        <div class="po-total-line"><span class="po-k">TOTAL PAID:</span> BZ$${amount.toFixed(2)}</div>
        <div class="po-words">(${_esc(words)})</div>
    </div>

    <div class="po-rule-dash" aria-hidden="true"></div>

    <div class="po-foot">Authorized on ${dateLong}</div>
</div></body></html>`;
}

function buildPayoutsReportHTML(payouts, displayDate) {
    const list  = [...(payouts || [])].reverse();
    const total = list.reduce((t, p) => t + (parseFloat(p.amount) || 0), 0);
    const dateLabel = displayDate || formatPayoutSlipDateShort(Date.now()).replace(/\//g, '-');

    function bzAmt(n) {
        return 'BZ$' + (parseFloat(n) || 0).toFixed(2);
    }

    const rows = list.length
        ? list.map(p => {
            const reason  = ((p.reason || '').trim() || '---').substring(0, 30);
            const takenBy = (p.takenBy || '').trim();
            const time    = p.timestamp
                ? new Date(p.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : '';
            return '<tr>'
                + '<td>' + _esc(time) + '</td>'
                + '<td>' + _esc(reason) + '</td>'
                + '<td>' + _esc(takenBy) + '</td>'
                + '<td class="col-amt">' + bzAmt(p.amount) + '</td>'
                + '</tr>';
        }).join('')
        : '<tr><td colspan="4" class="empty">No payouts</td></tr>';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${PO_FONT_LINK}<title>Payouts Report</title><style>${RECEIPT_STYLES}</style></head><body>
<div class="po-report" id="printInvoice">
    <div class="po-report-head">
        <div class="po-report-company">SERVICELL BELIZE</div>
        <div class="po-report-title">Payouts Report</div>
        <div class="po-report-date">${_esc(dateLabel)}</div>
    </div>
    <div class="po-report-rule" aria-hidden="true"></div>
    <table class="po-report-table">
        <thead>
            <tr>
                <th>Time</th>
                <th>Reason</th>
                <th>Taken By</th>
                <th class="col-amt">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr class="total">
                <td colspan="3">Total Payouts</td>
                <td class="col-amt">${bzAmt(total)}</td>
            </tr>
        </tbody>
    </table>
    <div class="po-report-foot">Printed ${_esc(new Date().toLocaleString())}</div>
</div></body></html>`;
}
window.buildPayoutsReportHTML = buildPayoutsReportHTML;

// ── Unified print entry point ─────────────────────────────────────────────────
// Tries QZ Tray first, falls back to window.print()
function printHTML(htmlContent) {
    // Extract QR code URL from HTML to preload it
    const qrMatch = htmlContent.match(/https:\/\/quickchart\.io\/qr[^"'\s]+/);
    
    if (qrMatch) {
        // Preload QR code image before printing
        const qrUrl = qrMatch[0];
        const preloadImg = new Image();
        
        preloadImg.onload = function() {
            // QR code loaded, now print
            if (typeof printReceiptQZ === 'function' && typeof IS_DESKTOP !== 'undefined' && IS_DESKTOP) {
                printReceiptQZ(htmlContent, () => _windowPrint(htmlContent));
            } else {
                _windowPrint(htmlContent);
            }
        };
        
        preloadImg.onerror = function() {
            // QR code failed to load, print anyway
            console.warn('QR code failed to preload, printing anyway');
            if (typeof printReceiptQZ === 'function' && typeof IS_DESKTOP !== 'undefined' && IS_DESKTOP) {
                printReceiptQZ(htmlContent, () => _windowPrint(htmlContent));
            } else {
                _windowPrint(htmlContent);
            }
        };
        
        preloadImg.src = qrUrl;
        
        // Fallback timeout
        setTimeout(function() {
            if (!preloadImg.complete) {
                console.warn('QR code preload timeout, printing anyway');
                if (typeof printReceiptQZ === 'function' && typeof IS_DESKTOP !== 'undefined' && IS_DESKTOP) {
                    printReceiptQZ(htmlContent, () => _windowPrint(htmlContent));
                } else {
                    _windowPrint(htmlContent);
                }
            }
        }, 3000);
    } else {
        // No QR code found, print normally
        if (typeof printReceiptQZ === 'function' && typeof IS_DESKTOP !== 'undefined' && IS_DESKTOP) {
            printReceiptQZ(htmlContent, () => _windowPrint(htmlContent));
        } else {
            _windowPrint(htmlContent);
        }
    }
}

function _windowPrint(htmlContent) {
    const w = window.open('', '_blank', 'width=400,height=600,alwaysRaised=yes');
    if (!w) return;
    w.document.write(htmlContent);
    w.document.close();
    
    // Wait for all images to load before printing
    let _printed = false;
    function _doPrint() {
        if (_printed) return;
        _printed = true;
        w.focus();
        w.print();
        setTimeout(() => { try { w.close(); } catch(_) {} }, 1500);
    }
    
    // Wait for window to load first, then check images
    w.addEventListener('load', function() {
        const images = w.document.getElementsByTagName('img');
        
        if (images.length === 0) {
            // No images, print immediately
            setTimeout(_doPrint, 300);
            return;
        }
        
        let loadedCount = 0;
        const totalImages = images.length;
        let allLoaded = true;
        
        // Check if any images are still loading
        for (let i = 0; i < images.length; i++) {
            if (!images[i].complete || images[i].naturalWidth === 0) {
                allLoaded = false;
            }
        }
        
        if (allLoaded) {
            // All images already loaded
            setTimeout(_doPrint, 500);
            return;
        }
        
        // Wait for images to load
        function checkAllLoaded() {
            loadedCount++;
            if (loadedCount >= totalImages) {
                // All images loaded, wait a bit more then print
                setTimeout(_doPrint, 500);
            }
        }
        
        for (let i = 0; i < images.length; i++) {
            if (images[i].complete && images[i].naturalWidth > 0) {
                checkAllLoaded();
            } else {
                images[i].addEventListener('load', checkAllLoaded);
                images[i].addEventListener('error', checkAllLoaded);
            }
        }
        
        // Fallback timeout in case something goes wrong (5 seconds)
        setTimeout(_doPrint, 5000);
    });
}

// ── A4 / Letter Job Invoice ───────────────────────────────────────────────────
const A4_STYLES = `
@media print { @page { size: A4; margin: 15mm 20mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: #000 !important; background: transparent !important; } body { background: white !important; } img { display: block !important; } }
body { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-size: 11px; color: #000; background: white; max-width: 680px; margin: 0 auto; padding: 20px; }
* { box-sizing: border-box; }
.pi-shop { text-align: center; margin-bottom: 12px; }
.pi-shop img { max-width: 80px; display: block; margin: 0 auto 6px; }
.pi-shop h1 { font-size: 20px; font-weight: 900; letter-spacing: 2px; margin: 0 0 3px; }
.pi-shop p { font-size: 11px; margin: 2px 0; }
.pi-rule { border: none; border-top: 2px solid #000; margin: 10px 0 8px; }
.pi-dash { border: none; border-top: 1px dashed #000; margin: 8px 0 6px; }
.pi-title { text-align: center; font-size: 13px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin: 8px 0 12px; }
.pi-meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 10px; line-height: 1.8; }
.pi-meta-row { display: flex; justify-content: space-between; font-size: 11px; margin: 6px 0 10px; padding: 8px 12px; background: transparent; border: 1px solid #000; gap: 16px; }
.pi-section { font-size: 9px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; margin-top: 4px; }
.pi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 10px; }
.pi-field-label { font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
.pi-field-value { font-size: 13px; font-weight: 700; padding: 3px 0; border-bottom: 1px solid #000; min-height: 24px; }
.pi-notes { border: 1px solid #000; padding: 10px; min-height: 70px; font-size: 12px; line-height: 1.5; margin-top: 4px; margin-bottom: 12px; }
.pi-cost-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
.pi-cost-table th { text-align: left; font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; padding: 4px 0; border-bottom: 2px solid #000; }
.pi-cost-table th:last-child, .pi-cost-table td:last-child { text-align: right; }
.pi-cost-table td { padding: 5px 0; border-bottom: 1px dashed #000; font-size: 12px; }
.pi-total-row td { border-top: 2px solid #000; border-bottom: none; font-weight: 900; font-size: 13px; padding-top: 8px; }
.pi-payment-status { text-align: center; font-size: 11px; font-weight: 900; margin: 10px 0 12px; padding: 8px 12px; background: transparent; border: 1px solid #000; }
.pi-inspection { border: 1px solid #000; padding: 8px 12px; margin: 4px 0 12px; font-size: 11px; line-height: 1.7; }
.pi-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px; }
.pi-sig { border-top: 1px solid #000; padding-top: 4px; font-size: 9px; text-align: center; }
.pi-qr-a4 { text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px dashed #000; }
.pi-qr-a4 img { max-width: 160px; margin: 0 auto 8px; display: block !important; }
.pi-qr-a4-title { font-size: 11px; font-weight: 900; letter-spacing: 1px; }
.pi-qr-a4-url { font-size: 9px; margin-top: 4px; color: #666; }
.pi-footer { text-align: center; font-size: 11px; font-weight: 700; margin-top: 20px; border-top: 1px dashed #000; padding-top: 8px; line-height: 1.6; }
`;

function buildJobA4HTML(j, opts) {
    opts = opts || {};
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    function bzDate(d) {
        if (!d || d === '—') return '—';
        try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
        catch(_) { return d; }
    }

    function fmtPhone(p) {
        if (!p) return '—';
        const c = p.replace(/\D/g,'');
        return c.length === 7 ? '+501 ' + c.slice(0,3) + '-' + c.slice(3) : p;
    }

    function fmtStatus(s) {
        return ({ ordered:'Parts Ordered', received:'Received', inqueue:'In Queue',
                  fixing:'Being Repaired', testing:'Testing', ready:'Ready for Pickup' })[s] || s || '—';
    }

    const priorityLabel = (j.priority||'low').toLowerCase() === 'high' ? 'HIGH — URGENT' : 'LOW — NORMAL';
    const receivedDate  = j.dateReceived ? bzDate(j.dateReceived) : today;
    const estimatedDate = j.estimatedCompletion || '—';

    const items = (() => {
        if (!j.invoiceItems || j.invoiceItems === '—') return [];
        try { return JSON.parse(j.invoiceItems); } catch(_) { return []; }
    })();
    const total = items.reduce((s,i) => s + (parseFloat(i.price||0)||0), 0);

    let paymentStatus = 'N/A — Invoice Pending';
    if (items.length && total > 0) {
        const p = String(j.payment||'unpaid').toLowerCase();
        paymentStatus = p.startsWith('paid') ? 'Paid via ' + (p.includes('card') ? 'Card' : 'Cash') : 'UNPAID';
    }

    const costTableHTML = items.length ? `
        <table class="pi-cost-table">
            <thead><tr><th>Service / Item</th><th>BZD</th></tr></thead>
            <tbody>
                ${items.map(i => `<tr><td>${_esc(i.desc||'')}</td><td>${(parseFloat(i.price||0)||0).toFixed(2)}</td></tr>`).join('')}
                <tr class="pi-total-row"><td><strong>TOTAL</strong></td><td><strong>${total.toFixed(2)}</strong></td></tr>
            </tbody>
        </table>` :
        `<div class="pi-notes" style="text-align:center;"><strong>Price To Be Determined</strong><br><span style="font-size:10px;">Final cost will be provided after diagnostic assessment.</span></div>`;

    const inspectionHTML = (j.inspection && j.inspection !== 'No damage noted')
        ? `<div class="pi-section">Device Inspection</div>
           <div class="pi-inspection">${_esc(j.inspection).replace(/;/g, '<br>')}</div>`
        : '';

    const imgSrc = opts.imgSrc || 'img/logo.png';
    
    // Generate QR code URL for job tracking
    const jobId = j.id;
    const trackerUrl = `https://servicellbze.github.io/ServiCell/tracker.html?job=${jobId}`;
    // Use quickchart.io - a free, reliable QR code API
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(trackerUrl)}&size=200`;

    return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap">
<style>${A4_STYLES}</style>
<div class="pi-shop">
    <img src="${imgSrc}" alt="Servicell Belize">
    <h1>SERVICELL BELIZE</h1>
    <p>Device Repair &amp; Services &middot; #7 Douglas Jones, Belize City</p>
    <p>Tel: +501 615-3388</p>
</div>
<hr class="pi-rule">
<div class="pi-title">Job Invoice &amp; Intake Form</div>
<div class="pi-meta">
    <div><strong>JOB #:</strong> ${_esc(j.id)}</div>
    <div><strong>DATE:</strong> ${_esc(receivedDate)}</div>
</div>
<div class="pi-meta-row">
    <div><strong>Type:</strong> ${_esc(j.jobType||'Repair')}</div>
    <div><strong>Priority:</strong> ${_esc(priorityLabel)}</div>
    <div><strong>Technician:</strong> ${_esc(j.technician||'—')}</div>
</div>
<hr class="pi-dash">
<div class="pi-section">Customer Information</div>
<div class="pi-grid">
    <div><div class="pi-field-label">Name</div><div class="pi-field-value">${_esc(j.customerName||'Walk-in')}</div></div>
    <div><div class="pi-field-label">Phone</div><div class="pi-field-value">${_esc(fmtPhone(j.customerPhone))}</div></div>
</div>
<hr class="pi-dash">
<div class="pi-section">Device Information</div>
<div class="pi-grid">
    <div><div class="pi-field-label">Device</div><div class="pi-field-value">${_esc(j.device||'—')}</div></div>
    <div><div class="pi-field-label">Issue Reported</div><div class="pi-field-value">${_esc(j.issue||'—')}</div></div>
    <div><div class="pi-field-label">Status</div><div class="pi-field-value">${_esc(fmtStatus(j.status))}</div></div>
    <div><div class="pi-field-label">${j.dateCompleted ? 'Completed On' : 'Est. Completion'}</div><div class="pi-field-value">${_esc(j.dateCompleted ? bzDate(j.dateCompleted) : estimatedDate)}</div></div>
</div>
<hr class="pi-dash">
<div class="pi-section">Work Notes</div>
<div class="pi-notes">${_esc(j.notes||'No additional notes.')}</div>
${inspectionHTML}
<hr class="pi-dash">
<div class="pi-section">Cost Breakdown</div>
${costTableHTML}
<div class="pi-payment-status"><strong>Payment Status:</strong> ${_esc(paymentStatus)}</div>
<div class="pi-sigs">
    <div class="pi-sig">Customer Signature &amp; Date</div>
    <div class="pi-sig">Staff Signature &amp; Date</div>
</div>
<div class="pi-qr-a4">
    <img src="${qrCodeUrl}" alt="Track Your Repair">
    <div class="pi-qr-a4-title">SCAN TO TRACK YOUR REPAIR</div>
    <div class="pi-qr-a4-url">Visit: servicellbze.github.io/ServiCell/tracker.html</div>
</div>
<div class="pi-footer">Thank you for choosing Servicell Belize!<br>Devices not collected within <strong>90 days of completion</strong> may be considered <strong>abandoned</strong>.<br>We are not responsible for data loss. Please back up your device.</div>`;
}
