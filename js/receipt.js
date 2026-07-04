// ── Shared Receipt Helper ─────────────────────────────────────────────────────
// Used by: current-jobs.html, new-job.html, sales.js
// Requires: js/qz-drawer.js loaded before this file

const RECEIPT_STYLES = `
@media print { @page { size: 72mm auto; margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; color: #000 !important; background: transparent !important; } body, #printInvoice, .po-slip, .po-report { background: white !important; color: #000 !important; } body:has(.po-slip) { text-align: left; } img { display: block !important; } }
#printInvoice { font-family: 'Courier New', Courier, monospace; color: #000; background: white; width: 68mm; margin: 0 auto; padding: 0 0 40mm; font-size: 12px; font-weight: 700; line-height: 1.55; letter-spacing: 0; }
#printInvoice * { font-weight: 700; box-sizing: border-box; color: #000; }
.pi-shop { text-align: center; margin-bottom: 6px; }
.pi-shop img { max-width: 85px; margin-bottom: 4px; display: block; margin-left: auto; margin-right: auto; }
.pi-shop h1 { font-size: 17px; font-weight: 900; letter-spacing: 1px; margin: 0 0 3px; }
.pi-shop p { font-size: 11px; margin: 2px 0; letter-spacing: 0; }
.pi-rule { border: none; border-top: 2px solid #000; margin: 6px 0 5px; }
.pi-dash { border: none; border-top: 1px solid #000; margin: 5px 0 4px; }
.pi-title { text-align: center; font-size: 12px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 4px 0 5px; }
.pi-meta { font-size: 11px; line-height: 1.55; margin-bottom: 4px; }
.pi-meta-row { font-size: 11px; margin: 4px 0 5px; padding: 4px 6px; background: transparent; border: 1px solid #000; line-height: 1.55; }
.pi-meta-row strong { display: block; }
.pi-section { font-size: 10px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin: 5px 0 3px; }
.pi-grid { margin-bottom: 4px; }
.pi-field-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2px; }
.pi-field-value { font-size: 12px; padding: 2px 0; border-bottom: 1px solid #000; min-height: 16px; margin-bottom: 4px; }
.pi-notes { border: 1px solid #000; padding: 4px 5px; min-height: 32px; font-size: 11px; line-height: 1.5; margin: 3px 0 6px; }
.pi-cost-table { width: 100%; border-collapse: collapse; margin: 4px 0 6px; font-size: 11px; }
.pi-cost-table th { text-align: left; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 0; border-bottom: 2px solid #000; }
.pi-cost-table th:last-child { text-align: right; }
.pi-cost-table td { padding: 4px 0; border-bottom: 1px solid #000; }
.pi-cost-table td:last-child { text-align: right; }
.pi-cost-table .pi-total-row td { border-top: 2px solid #000; border-bottom: none; font-size: 13px; font-weight: 900; padding-top: 5px; }
.pi-payment-status { text-align: center; font-size: 11px; margin: 5px 0 6px; padding: 4px 6px; background: transparent; border: 1px solid #000; font-weight: 900; }
.pi-footer { text-align: center; font-size: 11px; margin-top: 7px; border-top: 1px solid #000; padding-top: 5px; line-height: 1.55; }
.pi-qr { text-align: center; margin-top: 10px; }
.pi-qr img { max-width: 145px; margin: 0 auto 5px; display: block !important; }
.pi-qr-text { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; }
.pi-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.pi-sig { border-top: 1px solid #000; padding-top: 3px; font-size: 10px; text-align: center; }
.po-slip { font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; width: 68mm; margin: 0 auto; padding: 3mm 2mm 40mm; font-size: 12px; font-weight: 700; line-height: 1.5; text-align: left; }
.po-slip * { box-sizing: border-box; color: #000; font-weight: 700; }
.po-rule-eq { display: block; width: 100%; height: 0; border: none; border-top: 2px solid #000; margin: 8px 0; }
.po-rule-dash { display: block; width: 100%; height: 0; border: none; border-top: 1px dashed #000; margin: 8px 0; }
.po-banner { text-align: center; margin: 6px 0; }
.po-company { font-size: 13px; font-weight: 900; letter-spacing: 0.6px; margin: 0 0 4px; }
.po-title { font-size: 12px; font-weight: 900; letter-spacing: 0.8px; margin: 0; }
.po-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 11px; line-height: 1.55; margin: 2px 0; font-weight: 700; }
.po-meta-row span:last-child { text-align: right; white-space: nowrap; flex-shrink: 0; }
.po-meta-row span:first-child { min-width: 0; word-break: break-word; }
.po-block { margin: 3px 0; }
.po-line { font-size: 12px; font-weight: 700; line-height: 1.55; margin: 3px 0; word-break: break-word; }
.po-line .po-k { font-weight: 900; }
.po-line-label { font-size: 12px; font-weight: 900; margin: 0 0 3px; line-height: 1.55; }
.po-line-body { font-size: 12px; font-weight: 700; line-height: 1.5; word-break: break-word; margin: 0 0 3px; }
.po-total-line { font-size: 13px; font-weight: 700; line-height: 1.55; margin: 3px 0 0; }
.po-total-line .po-k { font-weight: 900; }
.po-words { font-size: 12px; font-weight: 700; line-height: 1.5; margin: 0 0 3px; }
.po-foot { margin-top: 3px; font-size: 11px; font-weight: 700; text-align: center; line-height: 1.5; }
.po-slip#printInvoice, .po-slip#printInvoice * { font-weight: 700 !important; }
.po-slip#printInvoice .po-company, .po-slip#printInvoice .po-title, .po-slip#printInvoice .po-line-label, .po-slip#printInvoice .po-total-line, .po-slip#printInvoice .po-k { font-weight: 900 !important; }
.po-report { font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; width: 68mm; margin: 0 auto; padding: 3mm 2mm 40mm; font-weight: 700; font-size: 11px; }
.po-report * { box-sizing: border-box; color: #000; font-weight: 700; }
.po-report-head { text-align: center; margin-bottom: 5px; }
.po-report-company { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; margin: 0 0 3px; }
.po-report-title { font-size: 12px; font-weight: 900; margin: 0 0 3px; }
.po-report-date { font-size: 12px; font-weight: 700; margin: 0 0 3px; }
.po-report-rule { height: 0; border: none; border-top: 2px solid #000; margin: 7px 0; }
.po-report-table { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 700; }
.po-report-table th { text-align: left; font-size: 10px; font-weight: 900; padding: 4px 0; border-bottom: 2px solid #000; }
.po-report-table th.col-amt { text-align: right; }
.po-report-table td { padding: 4px 0; border-bottom: 1px solid #000; vertical-align: top; word-break: break-word; }
.po-report-table td.col-amt { text-align: right; font-weight: 900; white-space: nowrap; }
.po-report-table tr.total td { border-top: 3px solid #000; border-bottom: none; font-size: 13px; font-weight: 900; padding-top: 6px; }
.po-report-table tr.total td.col-amt { text-align: right; }
.po-report-table td.empty { text-align: center; padding: 12px 0; border-bottom: none; }
.po-report-foot { text-align: center; font-size: 10px; font-weight: 700; margin-top: 10px; border-top: 1px dashed #000; padding-top: 6px; line-height: 1.45; }
`;

const RECEIPT_FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap">';
const PO_FONT_LINK = RECEIPT_FONT_LINK;
const QR_LIBRARY = '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>';

let _cachedLogoDataUrl = null;

function _receiptLogoSrc(fallback) {
    return _cachedLogoDataUrl || fallback || 'img/logo.png';
}

function _preloadReceiptLogo() {
    const img = new Image();
    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            _cachedLogoDataUrl = canvas.toDataURL('image/png');
        } catch (_) {}
    };
    img.src = new URL('img/logo.png', window.location.href).href;
}

if (typeof document !== 'undefined') {
    const _startLogoPreload = function() { _preloadReceiptLogo(); };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _startLogoPreload);
    } else {
        _startLogoPreload();
    }
}

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

    const imgSrc = opts.imgSrc || _receiptLogoSrc();
    
    // Generate QR code URL for job tracking
    const jobId = j.id;
    const trackerUrl = `https://servicellbze.github.io/ServiCell/tracker.html?job=${jobId}`;
    // Use quickchart.io - a free, reliable QR code API
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(trackerUrl)}&size=150`;

    return `<style>${RECEIPT_STYLES}</style>
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
#printInvoice { font-family:'Courier New',Courier,monospace; font-size:12px; font-weight:700; width:68mm; margin:0 auto; padding:0 0 40mm; line-height:1.55; letter-spacing:0; background:white; color:#000; }
#printInvoice * { box-sizing:border-box; font-weight:700; color:#000; }
#printInvoice h2 { text-align:center; font-size:17px; font-weight:900; letter-spacing:1px; margin:0 0 3px; }
#printInvoice p { text-align:center; margin:2px 0; font-size:11px; }
#printInvoice img { display:block; margin:0 auto 4px; max-width:85px; }
#printInvoice hr { border:none; border-top:1px solid #000; margin:5px 0 4px; }
#printInvoice hr.solid { border-top:2px solid #000; margin:6px 0 5px; }
#printInvoice table { width:100%; border-collapse:collapse; font-size:11px; }
#printInvoice th { border-bottom:2px solid #000; padding:4px 0; font-size:10px; text-align:left; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; }
#printInvoice th:nth-child(2),#printInvoice th:nth-child(3),#printInvoice th:nth-child(4) { text-align:right; }
#printInvoice td { padding:4px 0; border-bottom:1px solid #000; }
#printInvoice .divider td { border-top:2px solid #000; border-bottom:none; font-size:13px; font-weight:900; padding-top:5px; }
#printInvoice .gst-row td { border-bottom:1px solid #000; font-size:11px; }
#printInvoice .footer { text-align:center; font-size:11px; margin-top:7px; border-top:1px solid #000; padding-top:5px; line-height:1.55; }
</style>
<div id="printInvoice">
<img src="${_receiptLogoSrc()}" alt="Servicell Belize">
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
<div class="footer">Thank you for choosing Servicell Belize!<br>Prices include GST.</div>
</div>`;
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

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${RECEIPT_STYLES}</style></head><body>
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

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payouts Report</title><style>${RECEIPT_STYLES}</style></head><body>
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
// Browser print dialog (faithful formatting). QZ Tray is cash drawer only.
let _printInFlight = false;

function printHTML(htmlContent) {
    if (_printInFlight) return;
    _printInFlight = true;

    const qrMatch = htmlContent.match(/https:\/\/quickchart\.io\/qr[^"'\s]+/);

    function _releasePrintLock() {
        setTimeout(function() { _printInFlight = false; }, 400);
    }

    function _dispatchPrint() {
        _windowPrint(htmlContent, _releasePrintLock);
    }

    if (qrMatch) {
        const qrUrl = qrMatch[0];
        const preloadImg = new Image();
        let finished = false;

        function _finishPreload() {
            if (finished) return;
            finished = true;
            _dispatchPrint();
        }

        preloadImg.onload = _finishPreload;
        preloadImg.onerror = function() {
            console.warn('QR code failed to preload, printing anyway');
            _finishPreload();
        };
        preloadImg.src = qrUrl;
        setTimeout(_finishPreload, 800);
        return;
    }

    _dispatchPrint();
}

function _waitForPrintImages(doc, maxMs) {
    return new Promise(function(resolve) {
        const images = Array.from(doc.getElementsByTagName('img'));
        if (!images.length) {
            resolve();
            return;
        }

        let pending = 0;
        images.forEach(function(img) {
            if (!img.complete || img.naturalWidth === 0) pending++;
        });

        if (pending === 0) {
            resolve();
            return;
        }

        let settled = false;
        function finish() {
            if (settled) return;
            settled = true;
            resolve();
        }

        function oneDone() {
            pending--;
            if (pending <= 0) finish();
        }

        images.forEach(function(img) {
            if (img.complete && img.naturalWidth > 0) return;
            img.addEventListener('load', oneDone, { once: true });
            img.addEventListener('error', oneDone, { once: true });
        });

        setTimeout(finish, maxMs);
    });
}

function _windowPrint(htmlContent, onDone) {
    const w = window.open('', '_blank', 'width=400,height=600,alwaysRaised=yes');
    if (!w) {
        if (typeof onDone === 'function') onDone();
        return;
    }

    let printed = false;
    function triggerPrint() {
        if (printed) return;
        printed = true;
        w.focus();
        setTimeout(function() {
            w.print();
            setTimeout(function() {
                try { w.close(); } catch(_) {}
                if (typeof onDone === 'function') onDone();
            }, 600);
        }, 0);
    }

    function startPrint() {
        _waitForPrintImages(w.document, 600).then(triggerPrint);
    }

    w.document.open();
    w.document.write(htmlContent);
    w.document.close();

    // document.write can finish before the load listener is attached
    if (w.document.readyState === 'complete') {
        startPrint();
    } else {
        w.addEventListener('load', startPrint, { once: true });
    }
    setTimeout(startPrint, 800);
}

// ── A4 / Letter Job Invoice ───────────────────────────────────────────────────
const A4_STYLES = `
@media print { @page { size: A4; margin: 15mm 20mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: #000 !important; background: transparent !important; } body { background: white !important; } img { display: block !important; } }
body { font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #000; background: white; max-width: 680px; margin: 0 auto; padding: 20px; }
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

    const imgSrc = opts.imgSrc || _receiptLogoSrc();
    
    // Generate QR code URL for job tracking
    const jobId = j.id;
    const trackerUrl = `https://servicellbze.github.io/ServiCell/tracker.html?job=${jobId}`;
    // Use quickchart.io - a free, reliable QR code API
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(trackerUrl)}&size=200`;

    return `<style>${A4_STYLES}</style>
<div id="printInvoice" class="a4-invoice">
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
<div class="pi-footer">Thank you for choosing Servicell Belize!<br>Devices not collected within <strong>90 days of completion</strong> may be considered <strong>abandoned</strong>.<br>We are not responsible for data loss. Please back up your device.</div>
</div>`;
}
