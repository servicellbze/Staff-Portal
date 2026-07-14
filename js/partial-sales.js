// Shared partial-sales modal — used by sales.html and statistics.html
(function () {
    function bz(n) { return 'BZ$' + (parseFloat(n) || 0).toFixed(2); }
    function escH(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
    function tryParseJSON(str, fb) { try { return JSON.parse(str); } catch (_) { return fb; } }

    function saleOutstanding(s) {
        if (!s || s.status === 'reversed' || s.status === 'settled' || s.method !== 'partial') return 0;
        return Math.max(0, (parseFloat(s.total) || 0) - (parseFloat(s.amountPaid) || 0));
    }

    function sumPartialOutstanding(sales) {
        return (sales || [])
            .filter(s => s.status !== 'reversed' && s.method === 'partial')
            .reduce((t, s) => t + saleOutstanding(s), 0);
    }

    function getPartialSalesList(sales, from, to) {
        return (sales || []).filter(s => {
            if (s.status === 'reversed' || s.status === 'settled' || s.method !== 'partial') return false;
            if (saleOutstanding(s) <= 0.009) return false;
            if (from && to) {
                const d = s.shiftDate || (s.timestamp || '').slice(0, 10);
                if (!d || d < from || d > to) return false;
            }
            return true;
        }).sort((a, b) => saleOutstanding(b) - saleOutstanding(a));
    }

    // ── Date-range helpers for the All time / This week / Today toggle ──
    function dateStr(d) {
        return d.getFullYear() + '-'
            + String(d.getMonth() + 1).padStart(2, '0') + '-'
            + String(d.getDate()).padStart(2, '0');
    }

    function computeRange(mode) {
        if (mode === 'today') {
            const t = dateStr(new Date());
            return { from: t, to: t };
        }
        if (mode === 'week') {
            const now = new Date();
            const start = new Date(now);
            const dow = (now.getDay() + 6) % 7; // 0 = Monday
            start.setDate(now.getDate() - dow);
            return { from: dateStr(start), to: dateStr(now) };
        }
        // all time
        return { from: null, to: null };
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

    // ── State for the currently-open modal ──
    let _sales = [];
    let _opts = {};
    let _mode = 'all';

    function ensureToggleBar() {
        let bar = document.getElementById('partialRangeToggle');
        if (bar) return bar;
        const summary = document.getElementById('partialSalesSummary');
        if (!summary || !summary.parentNode) return null;

        bar = document.createElement('div');
        bar.id = 'partialRangeToggle';
        bar.style.cssText = 'display:flex;gap:4px;margin-bottom:12px;background:var(--glass);'
            + 'border:1px solid var(--glass-border);border-radius:99px;padding:4px;';

        const modes = [['today', 'Today'], ['week', 'This Week'], ['all', 'All Time']];
        bar.innerHTML = modes.map(([m, label]) =>
            '<button type="button" data-mode="' + m + '" class="partial-range-btn" '
            + 'style="flex:1;border:none;background:transparent;color:var(--text-dim);'
            + 'font-family:inherit;font-weight:700;font-size:0.78rem;padding:7px 10px;'
            + 'border-radius:99px;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s;">'
            + label + '</button>'
        ).join('');

        summary.parentNode.insertBefore(bar, summary);

        bar.addEventListener('click', function (e) {
            const btn = e.target.closest('.partial-range-btn');
            if (!btn) return;
            _mode = btn.dataset.mode;
            renderWithMode();
        });
        return bar;
    }

    function updateToggleActive() {
        const btns = document.querySelectorAll('#partialRangeToggle .partial-range-btn');
        btns.forEach(function (b) {
            const active = b.dataset.mode === _mode;
            b.style.background = active ? 'var(--primary)' : 'transparent';
            b.style.color = active ? '#fff' : 'var(--text-dim)';
            b.style.boxShadow = active ? '0 2px 8px rgba(var(--primary-rgb),0.3)' : 'none';
        });
    }

    function renderWithMode() {
        ensureToggleBar();
        updateToggleActive();
        const range = computeRange(_mode);
        const container = document.getElementById('partialSalesList');
        if (!container) return;
        renderPartialSalesList(container, _sales, Object.assign({}, _opts, range));
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
            const safeId = String(s.saleId).replace(/'/g, "\\'");
            const rowClick = opts.onRowClick
                ? ' onclick="' + opts.onRowClick + '(\'' + safeId + '\')" style="cursor:pointer;"'
                : '';
            const settleBtn = opts.onSettle
                ? '<button type="button" class="partial-settle-btn" title="Mark this balance as fulfilled"'
                    + ' onclick="event.stopPropagation();' + opts.onSettle + '(\'' + safeId + '\')"'
                    + ' style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;padding:4px 10px;'
                    + 'border:1px solid var(--success);background:rgba(16,185,129,0.1);color:var(--success);'
                    + 'border-radius:99px;font-family:inherit;font-size:0.68rem;font-weight:800;cursor:pointer;">'
                    + '&#10003; Mark Paid</button>'
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
                + '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;">'
                + '<div style="font-size:0.95rem;font-weight:800;color:var(--warning);">' + bz(owed) + '</div>'
                + '<div style="font-size:0.65rem;color:var(--text-dim);font-weight:700;">OWED</div>'
                + settleBtn
                + '</div></div>';
        }).join('');
    }

    window.openPartialSalesModal = function (sales, opts) {
        _opts = opts || {};
        _sales = sales || window._allSales || window.allSales || [];
        // Default to All Time so balances aren't hidden by the active date filter.
        _mode = _opts.defaultMode || 'all';
        const container = document.getElementById('partialSalesList');
        if (!container) return;
        renderWithMode();
        openModal('partialSalesModal');
        if (typeof initDataIcons === 'function') initDataIcons(document.getElementById('partialSalesModal'));
    };

    window.closePartialSalesModal = function () { closeModal('partialSalesModal'); };
    window.partialSaleOutstanding = saleOutstanding;
    window.sumPartialOutstanding = sumPartialOutstanding;
    window.getPartialSalesList = getPartialSalesList;
})();
