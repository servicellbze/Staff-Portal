// ── Shared Receipt Helper ─────────────────────────────────────────────────────
// Used by: current-jobs.html, new-job.html, sales.js
// Requires: js/qz-drawer.js loaded before this file

const RECEIPT_STYLES = `
@media print { @page { size: 72mm auto; margin: 0; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; color: #000 !important; background: transparent !important; -webkit-font-smoothing: none !important; -moz-osx-font-smoothing: unset !important; text-rendering: geometricPrecision !important; } body, #printInvoice, .po-slip, .po-report { background: white !important; color: #000 !important; } body:has(.po-slip) { text-align: left; } img { display: block !important; } }
#printInvoice { font-family: 'Courier New', Courier, monospace; color: #000; background: white; width: 68mm; margin: 0 auto; padding: 0 0 12mm; font-size: 11px; font-weight: 700; line-height: 1.4; letter-spacing: 0; -webkit-font-smoothing: none; text-rendering: geometricPrecision; }
#printInvoice * { font-weight: 700; box-sizing: border-box; color: #000; }
.pi-shop { text-align: center; margin-bottom: 4px; }
.pi-shop img { max-width: 72px; margin-bottom: 2px; display: block; margin-left: auto; margin-right: auto; }
.pi-shop h1 { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; margin: 0 0 2px; }
.pi-shop p { font-size: 10px; margin: 1px 0; letter-spacing: 0; }
.pi-shop-tagline { font-size: 9px; white-space: nowrap; letter-spacing: -0.25px; }
.pi-rule { border: none; border-top: 2px solid #000; margin: 4px 0 3px; }
.pi-dash { border: none; border-top: 1px solid #000; margin: 3px 0 2px; }
.pi-title { text-align: center; font-size: 11px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; margin: 2px 0 3px; }
.pi-meta { font-size: 10px; line-height: 1.4; margin-bottom: 2px; }
.pi-meta-row { font-size: 10px; margin: 2px 0 3px; padding: 3px 4px; background: transparent; border: 1px solid #000; line-height: 1.4; }
.pi-meta-row strong { display: block; }
.pi-section { font-size: 9px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 3px 0 1px; }
.pi-grid { margin-bottom: 2px; }
.pi-field-label { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
.pi-field-value { font-size: 11px; padding: 1px 0; border-bottom: 1px solid #000; min-height: 12px; margin-bottom: 2px; }
.pi-notes { border: 1px solid #000; padding: 3px 4px; min-height: 18px; font-size: 10px; line-height: 1.4; margin: 2px 0 4px; }
.pi-cost-table { width: 100%; border-collapse: collapse; margin: 2px 0 4px; font-size: 10px; }
.pi-cost-table th { text-align: left; font-size: 9px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; padding: 2px 0; border-bottom: 2px solid #000; }
.pi-cost-table th:last-child { text-align: right; }
.pi-cost-table td { padding: 2px 0; border-bottom: 1px solid #000; }
.pi-cost-table td:last-child { text-align: right; }
.pi-cost-table .pi-total-row td { border-top: 2px solid #000; border-bottom: none; font-size: 12px; font-weight: 900; padding-top: 3px; }
.pi-payment-status { text-align: center; font-size: 10px; margin: 3px 0 4px; padding: 3px 4px; background: transparent; border: 1px solid #000; font-weight: 900; }
.pi-footer { text-align: center; font-size: 9px; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; line-height: 1.4; }
.pi-qr { text-align: center; margin-top: 5px; }
.pi-qr img { max-width: 110px; margin: 0 auto 3px; display: block !important; }
.pi-qr-text { font-size: 10px; font-weight: 900; letter-spacing: 0.3px; }
.pi-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
.pi-sig { border-top: 1px solid #000; padding-top: 2px; font-size: 9px; text-align: center; }
.po-slip { font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; width: 68mm; margin: 0 auto; padding: 2mm 2mm 10mm; font-size: 11px; font-weight: 700; line-height: 1.35; text-align: left; }
.po-slip * { box-sizing: border-box; color: #000; font-weight: 700; }
.po-rule-eq { display: block; width: 100%; height: 0; border: none; border-top: 2px solid #000; margin: 5px 0; }
.po-rule-dash { display: block; width: 100%; height: 0; border: none; border-top: 1px dashed #000; margin: 5px 0; }
.po-banner { text-align: center; margin: 3px 0; }
.po-company { font-size: 12px; font-weight: 900; letter-spacing: 0.4px; margin: 0 0 2px; }
.po-title { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; margin: 0; }
.po-meta-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-size: 10px; line-height: 1.5; letter-spacing: 0.2px; margin: 2px 0; font-weight: 700; }
.po-meta-row span:last-child { text-align: right; white-space: nowrap; flex-shrink: 0; }
.po-meta-row span:first-child { min-width: 0; word-break: break-word; }
.po-block { margin: 2px 0; }
.po-line { font-size: 11px; font-weight: 700; line-height: 1.35; margin: 1px 0; word-break: break-word; }
.po-line .po-k { font-weight: 900; }
.po-line-label { font-size: 11px; font-weight: 900; margin: 0 0 2px; line-height: 1.35; }
.po-line-body { font-size: 11px; font-weight: 700; line-height: 1.35; word-break: break-word; margin: 0 0 2px; }
.po-total-line { font-size: 12px; font-weight: 700; line-height: 1.35; margin: 2px 0 0; }
.po-total-line .po-k { font-weight: 900; }
.po-words { font-size: 10px; font-weight: 700; line-height: 1.35; margin: 0 0 2px; }
.po-foot { margin-top: 2px; font-size: 10px; font-weight: 700; text-align: center; line-height: 1.35; }
.po-slip#printInvoice, .po-slip#printInvoice * { font-weight: 700 !important; }
.po-slip#printInvoice .po-company, .po-slip#printInvoice .po-title, .po-slip#printInvoice .po-line-label, .po-slip#printInvoice .po-total-line, .po-slip#printInvoice .po-k { font-weight: 900 !important; }
.po-report { font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; width: 68mm; margin: 0 auto; padding: 2mm 2mm 12mm; font-weight: 700; font-size: 11px; line-height: 1.5; letter-spacing: 0.2px; }
.po-report * { box-sizing: border-box; color: #000; font-weight: 700; }
.po-report-head { text-align: center; margin-bottom: 3px; }
.po-report-company { font-size: 15px; font-weight: 900; letter-spacing: 0.4px; margin: 0 0 2px; }
.po-report-title { font-size: 12px; font-weight: 900; margin: 0 0 2px; }
.po-report-date { font-size: 11px; font-weight: 700; margin: 0 0 2px; }
.po-report-rule { height: 0; border: none; border-top: 2px solid #000; margin: 5px 0; }
.po-report-table { width: 100%; border-collapse: collapse; font-size: 11px; font-weight: 700; line-height: 1.5; letter-spacing: 0.2px; }
.po-report-table th { text-align: left; font-size: 10px; font-weight: 900; padding: 3px 2px; border-bottom: 2px solid #000; }
.po-report-table th.col-amt { text-align: right; }
.po-report-table td { padding: 3px 2px; border-bottom: 1px solid #000; vertical-align: top; word-break: break-word; }
.po-report-table td + td { padding-left: 4px; }
.po-report-table td.col-amt { text-align: right; font-weight: 900; white-space: nowrap; padding-left: 6px; }
.po-report-table tr.total td { border-top: 3px solid #000; border-bottom: none; font-size: 13px; font-weight: 900; padding-top: 4px; }
.po-report-table tr.total td.col-amt { text-align: right; }
.po-report-table td.empty { text-align: center; padding: 8px 0; border-bottom: none; }
.po-report-foot { text-align: center; font-size: 10px; font-weight: 700; margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px; line-height: 1.35; }
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
    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(trackerUrl)}&size=120`;

    return `<style>${RECEIPT_STYLES}</style>
<div id="printInvoice">
    <div class="pi-shop">
        <img src="${imgSrc}" alt="Servicell Belize">
        <h1>SERVICELL BELIZE</h1>
        <p class="pi-shop-tagline">Device Repair &amp; Services &middot; Belize City, Belize</p>
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
@media print { @page { size: 72mm auto; margin: 0; } * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color:#000!important; background:transparent!important; -webkit-font-smoothing:none!important; text-rendering:geometricPrecision!important; } body { background:white!important; } }
#printInvoice { font-family:'Courier New',Courier,monospace; font-size:12px; font-weight:700; width:68mm; margin:0 auto; padding:0 0 12mm; line-height:1.4; letter-spacing:0; background:white; color:#000; -webkit-font-smoothing:none; text-rendering:geometricPrecision; }
#printInvoice * { box-sizing:border-box; font-weight:700; color:#000; }
#printInvoice h2 { text-align:center; font-size:16px; font-weight:900; letter-spacing:0.5px; margin:0 0 2px; }
#printInvoice p { text-align:center; margin:1px 0; font-size:11px; }
#printInvoice img { display:block; margin:0 auto 3px; max-width:72px; }
#printInvoice hr { border:none; border-top:1px solid #000; margin:4px 0 3px; }
#printInvoice hr.solid { border-top:2px solid #000; margin:4px 0 3px; }
#printInvoice table { width:100%; border-collapse:collapse; font-size:11px; }
#printInvoice th { border-bottom:2px solid #000; padding:3px 0; font-size:10px; text-align:left; font-weight:900; letter-spacing:0.3px; text-transform:uppercase; }
#printInvoice th:nth-child(2),#printInvoice th:nth-child(3),#printInvoice th:nth-child(4) { text-align:right; }
#printInvoice td { padding:3px 0; border-bottom:1px solid #000; }
#printInvoice .divider td { border-top:2px solid #000; border-bottom:none; font-size:13px; font-weight:900; padding-top:4px; }
#printInvoice .gst-row td { border-bottom:1px solid #000; font-size:11px; }
#printInvoice .footer { text-align:center; font-size:11px; margin-top:5px; border-top:1px solid #000; padding-top:4px; line-height:1.4; }
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

function formatPayoutSlipNo(payoutId) {
    if (!payoutId) return '—';
    const s = String(payoutId).trim();
    const m = s.match(/^P-(\d+)$/i);
    if (m) return 'P-' + m[1].slice(-6);
    const digits = s.replace(/\D/g, '');
    if (digits.length > 6) return 'P-' + digits.slice(-6);
    return s;
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
    const slipNo     = formatPayoutSlipNo(p.payoutId);
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
    function finish(ok) {
        if (typeof onDone === 'function') onDone(ok !== false);
    }

    function runPrint(doc, win) {
        let printed = false;
        function triggerPrint() {
            if (printed) return;
            printed = true;
            try { win.focus(); } catch (_) {}
            setTimeout(function() {
                try { win.print(); } catch (_) { finish(false); return; }
                setTimeout(function() {
                    try { if (win !== window && win.close) win.close(); } catch (_) {}
                    finish(true);
                }, 600);
            }, 0);
        }
        _waitForPrintImages(doc, 600).then(triggerPrint);
        setTimeout(triggerPrint, 800);
    }

    const w = window.open('', '_blank', 'width=400,height=600,alwaysRaised=yes');
    if (w) {
        w.document.open();
        w.document.write(htmlContent);
        w.document.close();
        if (w.document.readyState === 'complete') {
            runPrint(w.document, w);
        } else {
            w.addEventListener('load', function() { runPrint(w.document, w); }, { once: true });
        }
        return;
    }

    let frame = document.getElementById('_scPrintFrame');
    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = '_scPrintFrame';
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;left:-9999px;';
        document.body.appendChild(frame);
    }

    const fwin = frame.contentWindow;
    const fdoc = fwin.document;
    fdoc.open();
    fdoc.write(htmlContent);
    fdoc.close();
    runPrint(fdoc, fwin);
}

// ── Mobile preview & text sharing ─────────────────────────────────────────────

function isMobileReceipt() {
    return window.matchMedia('(max-width: 768px)').matches
        || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function _receiptNotify(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'ok');
}

function _receiptCashierName(cashier) {
    const nameMap = {
        Cashier_Chee: 'Ericson',
        Cashier_Coleman: 'Kiana',
        Technician_Bailey: 'Kareem',
        Technician_Bat: 'Bat',
        Manager_Chee: 'Eric'
    };
    return cashier ? (nameMap[cashier] || cashier.replace(/^(Cashier_|Manager_|Technician_)/i, '')) : 'Staff';
}

function buildSaleReceiptText(items, total, amountPaid, method, saleId, customer, cashier) {
    const change = method === 'cash' ? Math.max(0, amountPaid - total) : 0;
    const gst = total * 12.5 / 112.5;
    const preTax = total - gst;
    function bz(n) { return 'BZ$' + parseFloat(n || 0).toFixed(2); }
    const displayMethod = method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Cash';
    const lines = [
        'SERVICELL BELIZE',
        '#7 Douglas Jones, Belize City',
        'Tel: +501 615-3388',
        new Date().toLocaleString(),
        'Served by: ' + _receiptCashierName(cashier),
        customer ? 'Customer: ' + customer : '',
        'Receipt #' + (saleId || ''),
        '--------------------------------',
        'Item                    Qty  Total'
    ];
    (items || []).forEach(function(i) {
        const qty = i.qty || 1;
        const lineTotal = bz((i.price || 0) * qty);
        lines.push(String(i.name || 'Item').slice(0, 24).padEnd(24) + String(qty).padStart(3) + '  ' + lineTotal);
    });
    lines.push(
        '--------------------------------',
        'Subtotal (excl. GST): ' + bz(preTax),
        'GST (12.5%): ' + bz(gst),
        'TOTAL: ' + bz(total),
        'Paid (' + displayMethod + '): ' + bz(amountPaid)
    );
    if (change > 0) lines.push('Change: ' + bz(change));
    lines.push('', 'Thank you for choosing ServiCell Belize!', 'Prices include GST.');
    return lines.filter(Boolean).join('\n');
}

function buildJobReceiptText(j) {
    j = j || {};
    function bzDate(d) {
        if (!d || d === '—') return '—';
        try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
        catch (_) { return d; }
    }
    function fmtPhone(p) {
        if (!p) return '—';
        const c = p.replace(/\D/g, '');
        return c.length === 7 ? '+501 ' + c.slice(0, 3) + '-' + c.slice(3) : p;
    }
    function fmtStatus(s) {
        return ({ ordered: 'Parts Ordered', received: 'Received', inqueue: 'In Queue',
            fixing: 'Being Repaired', testing: 'Testing', ready: 'Ready for Pickup' })[s] || s || '—';
    }

    let items = [];
    try { items = j.invoiceItems ? JSON.parse(j.invoiceItems) : []; } catch (_) { items = []; }
    const total = items.reduce(function(s, i) { return s + (parseFloat(i.price || 0) || 0); }, 0);
    const priorityLabel = (j.priority || 'low').toLowerCase() === 'high' ? 'HIGH — URGENT' : 'LOW — NORMAL';
    let paymentStatus = 'N/A — Invoice Pending';
    if (items.length && total > 0) {
        const p = String(j.payment || 'unpaid').toLowerCase();
        paymentStatus = p.startsWith('paid') ? 'Paid via ' + (p.includes('card') ? 'Card' : 'Cash') : 'UNPAID';
    }

    const lines = [
        'SERVICELL BELIZE',
        'Device Repair & Services · Belize City',
        'Tel: +501 615-3388',
        '',
        'JOB RECEIPT & INTAKE FORM',
        'JOB #: ' + (j.id || '—'),
        'DATE: ' + (j.dateReceived ? bzDate(j.dateReceived) : bzDate(new Date())),
        'Type: ' + (j.jobType || 'Repair') + ' · Priority: ' + priorityLabel,
        '',
        'CUSTOMER',
        'Name: ' + (j.customerName || 'Walk-in'),
        'Phone: ' + fmtPhone(j.customerPhone),
        '',
        'DEVICE',
        'Device: ' + (j.device || '—'),
        'Issue: ' + (j.issue || '—'),
        'Status: ' + fmtStatus(j.status),
        (j.dateCompleted ? 'Completed: ' : 'Est. Completion: ') + (j.dateCompleted ? bzDate(j.dateCompleted) : (j.estimatedCompletion || '—')),
        '',
        'NOTES',
        j.notes || 'No additional notes.',
        '',
        'COST BREAKDOWN'
    ];
    if (items.length) {
        items.forEach(function(i) {
            lines.push('• ' + (i.desc || 'Service') + ' — BZ$' + (parseFloat(i.price || 0) || 0).toFixed(2));
        });
        lines.push('TOTAL: BZ$' + total.toFixed(2));
    } else {
        lines.push('Price To Be Determined');
        lines.push('Final cost after diagnostic.');
    }
    lines.push('Payment Status: ' + paymentStatus);
    if (j.id) {
        lines.push('', 'Track your repair:', 'https://servicellbze.github.io/ServiCell/tracker.html?job=' + j.id);
    }
    lines.push('', 'Thank you for choosing ServiCell Belize!');
    return lines.join('\n');
}

async function shareReceiptText(text, title) {
    if (!text) {
        _receiptNotify('Nothing to share', 'err');
        return false;
    }
    if (navigator.share) {
        try {
            await navigator.share({ title: title || 'ServiCell Receipt', text: text });
            _receiptNotify('Shared!', 'ok');
            if (typeof haptic === 'function') haptic('success');
            return true;
        } catch (e) {
            if (e && e.name === 'AbortError') return false;
        }
    }
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            _receiptNotify('Receipt copied — paste into your message app', 'ok');
            if (typeof haptic === 'function') haptic('light');
            return true;
        }
    } catch (_) {}
    _receiptNotify('Could not share — try copying manually', 'err');
    return false;
}

function _ensureReceiptPreviewModal() {
    if (document.getElementById('receiptPreviewModal')) return;

    const style = document.createElement('style');
    style.textContent = `
.receipt-preview-overlay { display:none; position:fixed; inset:0; z-index:10050; background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); align-items:flex-end; justify-content:center; padding:0; }
.receipt-preview-overlay.open { display:flex; }
.receipt-preview-sheet { width:100%; max-width:480px; max-height:92vh; background:var(--glass-strong,#fff); border-radius:28px 28px 0 0; box-shadow:0 -8px 40px rgba(0,0,0,0.25); display:flex; flex-direction:column; animation:receiptSlideUp 0.3s ease both; }
@keyframes receiptSlideUp { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
.receipt-preview-head { display:flex; align-items:center; justify-content:space-between; padding:18px 20px 12px; border-bottom:1px solid var(--glass-border,rgba(0,0,0,0.08)); }
.receipt-preview-head h3 { margin:0; font-size:1rem; font-weight:800; }
.receipt-preview-close { width:36px; height:36px; border-radius:50%; border:1px solid var(--glass-border,rgba(0,0,0,0.1)); background:transparent; cursor:pointer; font-size:1.1rem; }
.receipt-preview-body { overflow:auto; padding:16px; background:#f3f4f6; flex:1; -webkit-overflow-scrolling:touch; }
.receipt-preview-paper { background:#fff; color:#000; margin:0 auto; max-width:320px; padding:12px 14px 20px; box-shadow:0 2px 12px rgba(0,0,0,0.12); border-radius:4px; }
.receipt-preview-actions { display:flex; gap:10px; padding:14px 20px calc(14px + env(safe-area-inset-bottom)); border-top:1px solid var(--glass-border,rgba(0,0,0,0.08)); }
.receipt-preview-actions button { flex:1; padding:14px; border-radius:12px; border:none; font-family:inherit; font-size:0.9rem; font-weight:700; cursor:pointer; }
.receipt-preview-share { background:var(--primary,#2563eb); color:#fff; }
.receipt-preview-print { background:var(--glass,rgba(0,0,0,0.06)); color:var(--text-main,#111); border:1px solid var(--glass-border,rgba(0,0,0,0.1)) !important; }
@media (min-width:769px) {
    .receipt-preview-overlay { align-items:center; padding:24px; }
    .receipt-preview-sheet { border-radius:20px; max-height:88vh; }
}`;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'receiptPreviewModal';
    modal.className = 'receipt-preview-overlay';
    modal.innerHTML =
        '<div class="receipt-preview-sheet" role="dialog" aria-labelledby="receiptPreviewTitle">'
        + '<div class="receipt-preview-head">'
        + '<h3 id="receiptPreviewTitle">Receipt</h3>'
        + '<button type="button" class="receipt-preview-close" aria-label="Close">&times;</button>'
        + '</div>'
        + '<div class="receipt-preview-body"><div class="receipt-preview-paper" id="receiptPreviewPaper"></div></div>'
        + '<div class="receipt-preview-actions">'
        + '<button type="button" class="receipt-preview-share" id="receiptPreviewShareBtn">Share / Copy</button>'
        + '<button type="button" class="receipt-preview-print" id="receiptPreviewPrintBtn">Print</button>'
        + '</div></div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeReceiptPreview();
    });
    modal.querySelector('.receipt-preview-close').addEventListener('click', closeReceiptPreview);
}

let _receiptPreviewState = null;

function showReceiptPreview(html, plainText, opts) {
    opts = opts || {};
    _ensureReceiptPreviewModal();
    _receiptPreviewState = { html: html, text: plainText || '' };

    const modal = document.getElementById('receiptPreviewModal');
    const titleEl = document.getElementById('receiptPreviewTitle');
    const paper = document.getElementById('receiptPreviewPaper');
    if (titleEl) titleEl.textContent = opts.title || 'Receipt';
    if (paper) paper.innerHTML = html;

    document.getElementById('receiptPreviewShareBtn').onclick = function() {
        shareReceiptText(_receiptPreviewState.text, opts.title || 'ServiCell Receipt');
    };
    document.getElementById('receiptPreviewPrintBtn').onclick = function() {
        if (_receiptPreviewState && _receiptPreviewState.html) printHTML(_receiptPreviewState.html);
    };

    modal.classList.add('open');
    document.body.classList.add('modal-open');
}

function closeReceiptPreview() {
    const modal = document.getElementById('receiptPreviewModal');
    if (modal) modal.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open, .paper-modal-overlay.open, .mark-called-modal.open')) {
        document.body.classList.remove('modal-open');
    }
    _receiptPreviewState = null;
}

window.buildSaleReceiptText = buildSaleReceiptText;
window.buildJobReceiptText = buildJobReceiptText;
window.shareReceiptText = shareReceiptText;
window.showReceiptPreview = showReceiptPreview;
window.closeReceiptPreview = closeReceiptPreview;
window.isMobileReceipt = isMobileReceipt;
window.openReceiptPreview = showReceiptPreview;

// ── A4 / Letter Job Invoice ───────────────────────────────────────────────────
const A4_STYLES = `
@media print {
    @page { size: A4; margin: 14mm 16mm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: #000 !important; background: transparent !important; }
    html, body { background: white !important; }
    img { display: block !important; max-width: 100%; }
    .a4-invoice { box-shadow: none !important; }
}
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.45; }
* { box-sizing: border-box; }
.a4-invoice { max-width: 720px; margin: 0 auto; padding: 24px 28px 32px; background: #fff; color: #000; }
.pi-shop { text-align: center; margin-bottom: 14px; }
.pi-shop img { max-width: 72px; height: auto; display: block; margin: 0 auto 8px; }
.pi-shop h1 { font-size: 22px; font-weight: 900; letter-spacing: 2px; margin: 0 0 4px; }
.pi-shop p { font-size: 11px; margin: 2px 0; line-height: 1.5; }
.pi-rule { border: none; border-top: 2px solid #000; margin: 12px 0 10px; }
.pi-dash { border: none; border-top: 1px dashed #000; margin: 10px 0 8px; }
.pi-title { text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 14px; }
.pi-meta-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 12px; margin-bottom: 10px; line-height: 1.6; }
.pi-meta-bar strong { font-weight: 900; }
.pi-meta-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; font-size: 11px; margin: 0 0 12px; padding: 10px 14px; border: 1px solid #000; line-height: 1.5; }
.pi-meta-row span { display: block; }
.pi-meta-row .pi-k { font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
.pi-meta-row .pi-v { font-size: 12px; font-weight: 700; }
.pi-section { font-size: 9px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin: 12px 0 8px; }
.pi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 28px; margin-bottom: 4px; }
.pi-field { min-width: 0; }
.pi-field-label { font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
.pi-field-value { font-size: 13px; font-weight: 700; padding: 4px 0 6px; border-bottom: 1px solid #000; min-height: 28px; word-break: break-word; }
.pi-notes { border: 1px solid #000; padding: 10px 12px; min-height: 64px; font-size: 12px; line-height: 1.55; margin: 4px 0 12px; white-space: pre-wrap; word-break: break-word; }
.pi-cost-table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
.pi-cost-table th { text-align: left; font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; padding: 6px 0; border-bottom: 2px solid #000; }
.pi-cost-table th.col-amt { text-align: right; width: 120px; }
.pi-cost-table td { padding: 7px 0; border-bottom: 1px dashed #ccc; vertical-align: top; word-break: break-word; }
.pi-cost-table td.col-amt { text-align: right; font-weight: 700; white-space: nowrap; padding-left: 12px; }
.pi-cost-table tr.pi-subtotal td { border-bottom: 1px solid #000; font-size: 11px; padding-top: 10px; }
.pi-cost-table tr.pi-gst td { border-bottom: 1px solid #000; font-size: 11px; }
.pi-cost-table tr.pi-total-row td { border-top: 2px solid #000; border-bottom: none; font-weight: 900; font-size: 14px; padding-top: 10px; }
.pi-cost-table tr.pi-total-row td.col-amt { text-align: right; }
.pi-payment-status { text-align: center; font-size: 12px; font-weight: 900; margin: 14px 0 16px; padding: 10px 14px; border: 2px solid #000; }
.pi-inspection { border: 1px solid #000; padding: 10px 12px; margin: 4px 0 12px; font-size: 11px; line-height: 1.65; }
.pi-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; page-break-inside: avoid; }
.pi-sig { border-top: 1px solid #000; padding-top: 6px; font-size: 10px; text-align: center; min-height: 48px; }
.pi-qr-a4 { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #000; page-break-inside: avoid; }
.pi-qr-a4 img { max-width: 140px; height: auto; margin: 0 auto 10px; }
.pi-qr-a4-title { font-size: 11px; font-weight: 900; letter-spacing: 1px; }
.pi-qr-a4-url { font-size: 10px; margin-top: 4px; color: #333; }
.pi-footer { text-align: center; font-size: 10px; font-weight: 700; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px; line-height: 1.65; page-break-inside: avoid; }
.pi-pending { border: 1px solid #000; padding: 16px; text-align: center; font-size: 12px; line-height: 1.5; margin: 4px 0 8px; }
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

    const costTableHTML = items.length ? (() => {
        const gst = total * 12.5 / 112.5;
        const preTax = total - gst;
        function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }
        return `
        <table class="pi-cost-table">
            <thead><tr><th>Service / Item</th><th class="col-amt">Amount</th></tr></thead>
            <tbody>
                ${items.map(i => `<tr><td>${_esc(i.desc || '')}</td><td class="col-amt">${bz(i.price || 0)}</td></tr>`).join('')}
                <tr class="pi-subtotal"><td>Subtotal (excl. GST)</td><td class="col-amt">${bz(preTax)}</td></tr>
                <tr class="pi-gst"><td>GST (12.5%)</td><td class="col-amt">${bz(gst)}</td></tr>
                <tr class="pi-total-row"><td><strong>TOTAL</strong></td><td class="col-amt"><strong>${bz(total)}</strong></td></tr>
            </tbody>
        </table>`;
    })() :
        `<div class="pi-pending"><strong>Price To Be Determined</strong><br><span style="font-size:10px;">Final cost will be provided after diagnostic assessment.</span></div>`;

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

    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Job Invoice #${_esc(j.id)}</title><style>${A4_STYLES}</style></head><body>
<div id="printInvoice" class="a4-invoice">
<div class="pi-shop">
    <img src="${imgSrc}" alt="Servicell Belize">
    <h1>SERVICELL BELIZE</h1>
    <p>Device Repair &amp; Services</p>
    <p>#7 Douglas Jones, Belize City &middot; Tel: +501 615-3388</p>
</div>
<hr class="pi-rule">
<div class="pi-title">Job Invoice &amp; Intake Form</div>
<div class="pi-meta-bar">
    <div><strong>JOB #:</strong> ${_esc(j.id)}</div>
    <div><strong>DATE RECEIVED:</strong> ${_esc(receivedDate)}</div>
</div>
<div class="pi-meta-row">
    <span><span class="pi-k">Job Type</span><span class="pi-v">${_esc(j.jobType || 'Repair')}</span></span>
    <span><span class="pi-k">Priority</span><span class="pi-v">${_esc(priorityLabel)}</span></span>
    <span><span class="pi-k">Technician</span><span class="pi-v">${_esc(j.technician || '—')}</span></span>
</div>
<div class="pi-section">Customer Information</div>
<div class="pi-grid">
    <div class="pi-field"><div class="pi-field-label">Name</div><div class="pi-field-value">${_esc(j.customerName || 'Walk-in')}</div></div>
    <div class="pi-field"><div class="pi-field-label">Phone</div><div class="pi-field-value">${_esc(fmtPhone(j.customerPhone))}</div></div>
</div>
<div class="pi-section">Device Information</div>
<div class="pi-grid">
    <div class="pi-field"><div class="pi-field-label">Device</div><div class="pi-field-value">${_esc(j.device || '—')}</div></div>
    <div class="pi-field"><div class="pi-field-label">Issue Reported</div><div class="pi-field-value">${_esc(j.issue || '—')}</div></div>
    <div class="pi-field"><div class="pi-field-label">Status</div><div class="pi-field-value">${_esc(fmtStatus(j.status))}</div></div>
    <div class="pi-field"><div class="pi-field-label">${j.dateCompleted ? 'Completed On' : 'Est. Completion'}</div><div class="pi-field-value">${_esc(j.dateCompleted ? bzDate(j.dateCompleted) : estimatedDate)}</div></div>
</div>
<div class="pi-section">Work Notes</div>
<div class="pi-notes">${_esc(j.notes || 'No additional notes.')}</div>
${inspectionHTML}
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
    <div class="pi-qr-a4-url">servicellbze.github.io/ServiCell/tracker.html?job=${_esc(j.id)}</div>
</div>
<div class="pi-footer">Thank you for choosing Servicell Belize!<br>Devices not collected within <strong>90 days of completion</strong> may be considered <strong>abandoned</strong>.<br>We are not responsible for data loss. Please back up your device.<br>Prices include GST where applicable.</div>
</div></body></html>`;
}
