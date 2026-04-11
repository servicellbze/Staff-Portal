// ── Shared Receipt Helper ─────────────────────────────────────────────────────
// Used by: current-jobs.html, new-job.html, sales.js
// Requires: js/qz-drawer.js loaded before this file

const RECEIPT_STYLES = `
@media print { @page { size: 72mm auto; margin: 3mm 2mm; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; color: #000 !important; background: transparent !important; } body, #printInvoice { background: white !important; color: #000 !important; } }
#printInvoice { font-family: 'IBM Plex Mono','Courier New',monospace; color: #000; background: white; width: 47mm; margin: 0 auto; padding: 2px 0 20mm; font-size: 9px; font-weight: 700; line-height: 1.5; letter-spacing: -0.2px; word-spacing: -0.3px; }
#printInvoice * { font-weight: 700; box-sizing: border-box; }
.pi-shop { text-align: center; margin-bottom: 5px; }
.pi-shop img { max-width: 70px; margin-bottom: 3px; display: block; margin-left: auto; margin-right: auto; }
.pi-shop h1 { font-size: 13px; font-weight: 900; letter-spacing: 1px; margin: 0 0 2px; }
.pi-shop p { font-size: 8px; margin: 1px 0; letter-spacing: 0; }
.pi-rule { border: none; border-top: 2px solid #000; margin: 5px 0 4px; }
.pi-dash { border: none; border-top: 1px dashed #000; margin: 4px 0 3px; }
.pi-title { text-align: center; font-size: 9px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 3px 0 4px; }
.pi-meta { font-size: 8px; line-height: 1.5; margin-bottom: 3px; }
.pi-meta-row { font-size: 8px; margin: 3px 0 4px; padding: 3px 5px; background: #f0f0f0; line-height: 1.6; }
.pi-meta-row strong { display: block; }
.pi-section { font-size: 7px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin: 4px 0 2px; }
.pi-grid { margin-bottom: 3px; }
.pi-field-label { font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2px; }
.pi-field-value { font-size: 9px; padding: 1px 0; border-bottom: 1px dashed #000; min-height: 13px; margin-bottom: 3px; }
.pi-notes { border: 1px solid #000; padding: 3px 4px; min-height: 28px; font-size: 8px; line-height: 1.4; margin: 2px 0 5px; }
.pi-cost-table { width: 100%; border-collapse: collapse; margin: 3px 0 5px; font-size: 8px; }
.pi-cost-table th { text-align: left; font-size: 7px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; padding: 2px 0; border-bottom: 2px solid #000; }
.pi-cost-table th:last-child { text-align: right; }
.pi-cost-table td { padding: 3px 0; border-bottom: 1px dashed #000; }
.pi-cost-table td:last-child { text-align: right; }
.pi-cost-table .pi-total-row td { border-top: 2px solid #000; border-bottom: none; font-size: 10px; padding-top: 4px; }
.pi-payment-status { text-align: center; font-size: 8px; margin: 4px 0 5px; padding: 3px 5px; background: #f0f0f0; }
.pi-footer { text-align: center; font-size: 8px; margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px; line-height: 1.55; }
.pi-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
.pi-sig { border-top: 1px solid #000; padding-top: 2px; font-size: 7px; text-align: center; }
`;

const RECEIPT_FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@700&display=swap">';

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
    <div class="pi-footer">
        Thank you for choosing Servicell Belize!<br>
        Devices not collected within <strong>90 days of completion</strong> may be considered <strong>abandoned</strong>.<br>
        We are not responsible for data loss. Please back up your device.
    </div>
</div>`;
}

// ── Sale Receipt (sales.js) ───────────────────────────────────────────────────
function buildSaleReceiptHTML(items, total, amountPaid, method, saleId, customer, cashier) {
    const change = method === 'cash' ? Math.max(0, amountPaid - total) : 0;
    function bz(n) { return 'BZ$' + parseFloat(n||0).toFixed(2); }

    const rows = items.map(i =>
        `<tr><td>${_esc(i.name)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${bz(i.price)}</td><td style="text-align:right">${bz(i.total)}</td></tr>`
    ).join('');

    return `<style>
@media print { @page { size: 72mm auto; margin: 3mm 2mm; } * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color:#000!important; background:transparent!important; } body { background:white!important; } }
body { font-family:'IBM Plex Mono','Courier New',monospace; font-size:9px; font-weight:700; width:47mm; margin:0 auto; padding:2px 0 20mm; line-height:1.5; letter-spacing:-0.2px; background:white; }
* { box-sizing:border-box; font-weight:700; }
h2 { text-align:center; font-size:13px; font-weight:900; letter-spacing:1px; margin:0 0 2px; }
p { text-align:center; margin:1px 0; font-size:8px; }
img { display:block; margin:0 auto 3px; max-width:70px; }
hr { border:none; border-top:1px dashed #000; margin:4px 0 3px; }
hr.solid { border-top:2px solid #000; margin:5px 0 4px; }
table { width:100%; border-collapse:collapse; font-size:8px; }
th { border-bottom:2px solid #000; padding:2px 0; font-size:7px; text-align:left; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; }
th:nth-child(2),th:nth-child(3),th:nth-child(4) { text-align:right; }
td { padding:3px 0; border-bottom:1px dashed #000; }
.divider td { border-top:2px solid #000; border-bottom:none; font-size:10px; padding-top:4px; }
.footer { text-align:center; font-size:8px; margin-top:6px; border-top:1px dashed #000; padding-top:4px; line-height:1.55; }
</style>${RECEIPT_FONT_LINK}
<img src="img/logo.png" alt="Servicell Belize">
<h2>SERVICELL BELIZE</h2>
<p>Device Repair &amp; Services &middot; Belize City, Belize</p>
<p>Tel: +501 615-3388</p>
<p>${new Date().toLocaleString()}</p>
<p>Cashier: ${_esc(cashier||'')}</p>
${customer ? `<p>Customer: ${_esc(customer)}</p>` : ''}
<p>Receipt #${_esc(saleId||'')}</p>
<hr class="solid">
<table>
    <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
    ${rows}
    <tr class="divider"><td colspan="3">TOTAL</td><td style="text-align:right">${bz(total)}</td></tr>
    <tr><td colspan="3">Paid (${_esc(method)})</td><td style="text-align:right">${bz(amountPaid)}</td></tr>
    ${change > 0 ? `<tr><td colspan="3">Change</td><td style="text-align:right">${bz(change)}</td></tr>` : ''}
</table>
<div class="footer">Thank you for choosing Servicell Belize!<br>We are not responsible for data loss.</div>`;
}

// ── Unified print entry point ─────────────────────────────────────────────────
// Tries QZ Tray first, falls back to window.print()
function printHTML(htmlContent) {
    if (typeof printReceiptQZ === 'function' && typeof IS_DESKTOP !== 'undefined' && IS_DESKTOP) {
        printReceiptQZ(htmlContent, () => _windowPrint(htmlContent));
    } else {
        _windowPrint(htmlContent);
    }
}

function _windowPrint(htmlContent) {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    w.document.write('<!DOCTYPE html><html><head></head><body>' + htmlContent + '</body></html>');
    w.document.close();
    w.focus();
    w.onload = function() { w.print(); setTimeout(() => w.close(), 1500); };
    setTimeout(() => { try { w.print(); setTimeout(() => w.close(), 1500); } catch(_) {} }, 800);
}
