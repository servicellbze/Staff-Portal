// Shared partial-sales modal — used by sales.html and statistics.html
(function () {
    function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }
    function escH(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
    function tryParseJSON(str, fb) { try { return JSON.parse(str); } catch (_) { return fb; } }

    function saleOutstanding(s) {
        if (!s || s.status === 'reversed' || s.method !== 'partial') return 0;
        return Math.max(0, (parseFloat(s.total) || 0) - (parseFloat(s.amountPaid) || 0));
    }

    function sumPartialOutstanding(sales) {
        return (sales || [])
            .filter(s => s.status !== 'reversed' && s.method === 'partial')
            .reduce((t, s) => t + saleOutstanding(s), 0);
    }

    function getPartialSalesList(sales, from, to) {
        return (sales || []).filter(s => {
            if (s.status === 'reversed' || s.method !== 'partial') return false;
            if (saleOutstanding(s) <= 0.009) return false;
            if (from && to) {
                const d = s.shiftDate || (s.timestamp || '').slice(0, 10);
                if (!d || d < from || d > to) return false;
            }
            return true;
        }).sort((a, b) => saleOutstanding(b) - saleOutstanding(a));
    }

    function openModal(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.add('open'); document.body.classList.add('modal-open'); }
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
        if (!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
    }

    function renderPartialSalesList(container, sales, opts) {
        opts = opts || {};
        const partials = getPartialSalesList(sales, opts.from, opts.to);
        const totalOwed = sumPartialOutstanding(partials);
        const summary = document.getElementById('partialSalesSummary');
        if (summary) {
            summary.innerHTML = partials.length
                ? '<strong>' + partials.length + '</strong> partial sale' + (partials.length === 1 ? '' : 's')
                    + ' &bull; <strong style="color:var(--warning);">' + bz(totalOwed) + '</strong> still owed'
                : 'No outstanding partial payments in this view.';
        }
        if (!partials.length) {
            container.innerHTML = '<div class="empty-state">' + escH(opts.emptyText || 'All partial sales are fully paid.') + '</div>';
            return;
        }
        container.innerHTML = partials.map(s => {
            const items = tryParseJSON(s.items, []);
            const desc = items.map(i => i.name).slice(0, 2).join(', ') + (items.length > 2 ? '…' : '') || 'Sale';
            const owed = saleOutstanding(s);
            const paid = parseFloat(s.amountPaid) || 0;
            const total = parseFloat(s.total) || 0;
            const ts = s.timestamp
                ? new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : (s.shiftDate || '—');
            const rowClick = opts.onRowClick
                ? ' onclick="' + opts.onRowClick + '(\'' + String(s.saleId).replace(/'/g, "\\'") + '\')" style="cursor:pointer;"'
                : '';
            return '<div class="partial-sale-row"' + rowClick + '>'
                + '<div style="flex:1;min-width:0;">'
                + '<div style="font-size:0.85rem;font-weight:700;">' + escH(desc) + '</div>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">'
                + escH(ts) + ' &bull; ' + escH(s.cashier || 'Unknown')
                + (s.customer ? ' &bull; ' + escH(s.customer) : '')
                + '</div>'
                + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:2px;">Paid ' + bz(paid) + ' of ' + bz(total) + '</div>'
                + '</div>'
                + '<div style="text-align:right;flex-shrink:0;">'
                + '<div style="font-size:0.95rem;font-weight:800;color:var(--warning);">' + bz(owed) + '</div>'
                + '<div style="font-size:0.65rem;color:var(--text-dim);font-weight:700;">OWED</div>'
                + '</div></div>';
        }).join('');
    }

    window.openPartialSalesModal = function (sales, opts) {
        opts = opts || {};
        sales = sales || window._allSales || window.allSales || [];
        const container = document.getElementById('partialSalesList');
        if (!container) return;
        renderPartialSalesList(container, sales, opts);
        openModal('partialSalesModal');
        if (typeof initDataIcons === 'function') initDataIcons(document.getElementById('partialSalesModal'));
    };

    window.closePartialSalesModal = function () { closeModal('partialSalesModal'); };
    window.partialSaleOutstanding = saleOutstanding;
    window.sumPartialOutstanding = sumPartialOutstanding;
    window.getPartialSalesList = getPartialSalesList;
})();
