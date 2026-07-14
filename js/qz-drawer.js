// ── QZ Tray Cash Drawer Helper ────────────────────────────────────────────────
// Requires QZ Tray installed and running on the POS machine.
// Download: https://qz.io/download
//
// Set this to match the printer name exactly as shown in Windows Devices & Printers
const QZ_PRINTER_NAME = 'LR2000';

// ESC/POS drawer kick: ESC p 0 25 250
const DRAWER_KICK_BYTES = '\x1B\x70\x00\x19\xFA';

// Desktop-only guard — drawer/thermal print not available on mobile/tablet
const IS_DESKTOP = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// ── PASTE YOUR private-key.pem CONTENTS HERE ─────────────────────────────────
// Open private-key.pem in Notepad and paste the full contents below.
const QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCi4Z+NTdvWpbUD
xFgvK7NXMRIK/bfBUFYwE3/YLQuH8qlWcRdsa+NqEUn6GhgWrdi/D0JEuUIicIMB
QHFMb5VRbAevKKm9SZy9V4rCkK2QqE8n1icV3hQM0cfUmI4vD1ZlE0JE+OhxsWbJ
cAZ0agFsfVHbHwg/LhVOwJhIbLcA0vhnJTu2d3OzQwpN09+03zBfnyAufRvSnQL8
10iePy4BhKLLt6AFYN6zfEdsy8mWArmBYyxmwXEVfuvTzLc3umhp8QLQzoUsKIq7
sZmajCJGMUqBTaxzyDMlrPVlx58IuWvYzfx6xm0w67973bEAHhZxPI+Lzv7WEZc4
rxYRdXSTAgMBAAECggEAOKMUzFlA8rvvHA63jTt4Yn61I+5Caa1qMtBs+Xn8Uvrt
qBmuB+ziCH1XiGhvbN9piVIgfG4g0YHnA9XpL6dzN/tFFsKgdyn0HyCkJvCQ8cac
s6DzOVbeCPEfN80OT83ZAE94kSwuA26o662RCQTdVuCiyHtbbkCzdw1gRnrLDbVA
Ikv7EXM+/bn6Qo2XdHyyKFbLJ8yx5UEVH+5rLMBTA8pp9aSgB2afPFD5iwURhqzJ
rMPjNeipp7FHjw9jN3CEN7dg38Rfqss6BgEMiwiPaCi9hIcORTHo0JeprFYfgO/V
x+l9KWsKiz2qL0pBxMhf4kzjHqr4YLBqyvRb+yrb4QKBgQDXvEVkaFUuyx8KSBsX
95h/6UyYgbco7gUdM1m4pdC0jiXEeLELRbmYXNOxEWy19gHoctEfE39wKA9oiAGY
seISUIUeUkR/IJL3zBUpETq5+j+YKqp7U+dmns/dvKlQ9utL9Tw8lk/Hi5Jc5jaO
/ihPjFLuphshDsfErpqMDYWG8wKBgQDBSAK2Sj/DlZcBb/0urzclU4yEwjnJ9TEC
WUPUvdBcuYasIZ/YurQI5XK9cGwS1f6fQ0XcCKxAZ8QfX7BhPH9UZRAPtXa2q+Ew
t4JNxF3x5t9fVy/ljtfLhAhyMAyQJU2aQVh06fXJCNxh7YvYbo4TkW6B9X2YezuP
t4kskqcD4QKBgQCyLrUdrjKU+H1Fr7J5BC33j8iMua5+5sBgktYK9SFAz5sQACMy
TT9yQVEzEVI5o9uFkrd4NFFwYBYB3zt6U4mGWOzp00bxvQTGF9BuX+WiT7eQxcST
IgSgtJC48qbh0V8cGIvM+tUf2f5kLlxnlDHVKfAhXh5QGnYS06ef/1cG0wKBgQCk
NIeJUx9FDMuTvw78IIPbRFX3XAM4nwSaGDhWf0SL4lqV1qM0v7nAbR7D7sUCY6fE
qqSpQP0GYqHufZ8dnQYYLxwsHGDU5MWWW/FqHFAr+ZcAKtRYVLjlADEkwcmKlQaO
7ME34qSbvNluoR/UKmiuGzolUuj3KIr7mFQD+DvIQQKBgG4MISa+JHYYnKajIFVC
Q9NcYewogsPgu3jHgndYxzr14tcVFAlxUweu02zyWm0FAFdS+xh9FL+yS27ECJG9
t34gM8Yi+U0kuem9/WhHja4nSBxyvZGIYmgpDwgudBr3VLyn/SEZRe2EF8z+0qsh
Co0lEboq7AjdmskP4gylNCo2
-----END PRIVATE KEY-----
`;

// ── Certificate (from digital-certificate.txt) ────────────────────────────────
const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZ1+jR6EMA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI2MDQxMDIxNTc1MFoXDTQ2MDQxMDIxNTc1MFowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCi
4Z+NTdvWpbUDxFgvK7NXMRIK/bfBUFYwE3/YLQuH8qlWcRdsa+NqEUn6GhgWrdi/
D0JEuUIicIMBQHFMb5VRbAevKKm9SZy9V4rCkK2QqE8n1icV3hQM0cfUmI4vD1Zl
E0JE+OhxsWbJcAZ0agFsfVHbHwg/LhVOwJhIbLcA0vhnJTu2d3OzQwpN09+03zBf
nyAufRvSnQL810iePy4BhKLLt6AFYN6zfEdsy8mWArmBYyxmwXEVfuvTzLc3umhp
8QLQzoUsKIq7sZmajCJGMUqBTaxzyDMlrPVlx58IuWvYzfx6xm0w67973bEAHhZx
PI+Lzv7WEZc4rxYRdXSTAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBTEJlW/Z/tvZ0xeIzZvzgplW4u1/jANBgkq
hkiG9w0BAQsFAAOCAQEAjRzfYnV7ULoI4O3DJzIq0Ben/79Gtz0OviyCJDo2Q4Gj
1wPY2ZJsw5xLz/NoVHBtUeOFh1uhNjvxTUiDLIxbas7MgOYOXV21d5Vyo+YuHrXm
d0LVdxLsWiA3cljC86+IX52IDcTZEzUMK5+9rDJqcMdSM7nCbjxq5BK9KBajCGPi
YW8nv06QJIyGBLreaaDW655nFZLcX3p29693roGMW2j/qWCMb0HdSlp/sgs6U1ot
eNqsio1NymyiyFeg92sYDC+QWXzTAY4ixmD0cd6bR2xfGHAZVXRpryFCD15Fzs60
D9UT1IG38WeOrzS3KzCaVrJGDD/twPaMpxPCvK9wNw==
-----END CERTIFICATE-----`;

let _qzReady = false;
let _qzConnecting = false;
let _qzWaiters = [];
let _qzPrintQueue = Promise.resolve();

function _loadQZScript(cb) {
    if (window.qz) { cb(); return; }
    // Load jsrsasign for signing, then qz-tray
    const rsa = document.createElement('script');
    rsa.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/11.1.0/jsrsasign-all-min.js';
    rsa.onload = function() {
        const qzs = document.createElement('script');
        qzs.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
        qzs.onload = cb;
        qzs.onerror = () => console.warn('[QZ] Could not load qz-tray.js');
        document.head.appendChild(qzs);
    };
    rsa.onerror = () => console.warn('[QZ] Could not load jsrsasign');
    document.head.appendChild(rsa);
}

function _resolveQZWaiters(err) {
    const waiters = _qzWaiters;
    _qzWaiters = [];
    waiters.forEach(function(w) { err ? w.reject(err) : w.resolve(); });
}

function _connectQZ() {
    return new Promise(function(resolve, reject) {
        if (_qzReady) { resolve(); return; }
        if (_qzConnecting) {
            _qzWaiters.push({ resolve: resolve, reject: reject });
            return;
        }
        _qzConnecting = true;

        _loadQZScript(function() {
            if (!window.qz) {
                _qzConnecting = false;
                const err = new Error('no-lib');
                reject(err);
                _resolveQZWaiters(err);
                return;
            }

            qz.security.setCertificatePromise(function(resolve) {
                resolve(QZ_CERTIFICATE);
            });

            qz.security.setSignatureAlgorithm('SHA512');
            qz.security.setSignaturePromise(function(toSign) {
                return function(resolve, reject) {
                    try {
                        const sig = new KJUR.crypto.Signature({ alg: 'SHA512withRSA' });
                        sig.init(QZ_PRIVATE_KEY);
                        sig.updateString(toSign);
                        resolve(hex2b64(sig.sign()));
                    } catch(e) {
                        reject(e);
                    }
                };
            });

            qz.websocket.connect({ retries: 2, delay: 1 })
                .then(function() {
                    _qzReady = true;
                    _qzConnecting = false;
                    resolve();
                    _resolveQZWaiters();
                })
                .catch(function(e) {
                    _qzConnecting = false;
                    reject(e);
                    _resolveQZWaiters(e);
                });
        });
    });
}

function _qzPrinterConfig() {
    return qz.configs.create(QZ_PRINTER_NAME);
}

function _qzThermalConfig() {
    return qz.configs.create(QZ_PRINTER_NAME, {
        units: 'mm',
        size: { width: 72, height: null },
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        scaleContent: true
    });
}

function _qzPrint(config, data) {
    const job = _qzPrintQueue.then(function() { return qz.print(config, data); });
    _qzPrintQueue = job.catch(function() {});
    return job;
}

// ── Silent thermal printing (HTML → faithful image → QZ) ──────────────────────
// Capture at CSS pixel density (96dpi) so layout matches browser print, then
// scale up for crisp thermal output.
const CAPTURE_DPI = 96;
const CAPTURE_SCALE = 2;

function _mmToPx(mm) {
    return Math.round(mm * CAPTURE_DPI / 25.4);
}

function _captureWidthPx(html) {
    if (_isA4Html(html)) return 720;
    if (/width:\s*72mm/i.test(html)) return _mmToPx(72);
    return _mmToPx(68);
}

function _prepareHtmlForSilentPrint(html) {
    let out = _absolutizeHtmlUrls(html);
    out = out.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '');
    out = out.replace(/font-family:\s*'IBM Plex Mono'[^;]*/gi, "font-family:'Courier New',Courier,monospace");
    if (!/<html[\s>]/i.test(out)) {
        out = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + out + '</body></html>';
    }
    const isA4 = _isA4Html(out);
    const captureWidth = _captureWidthPx(out);
    const captureCss = '<style id="qz-capture-base">'
        + 'html,body{margin:0!important;padding:0!important;background:#fff!important;color:#000!important;'
        + 'width:' + captureWidth + 'px!important;max-width:' + captureWidth + 'px!important;'
        + '-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}'
        + '#printInvoice,.po-slip,.po-report{width:100%!important;max-width:100%!important;margin:0!important;'
        + 'box-sizing:border-box!important;'
        + (isA4 ? 'padding:0!important;' : 'padding:10px 12px 18px!important;')
        + '}'
        + '.a4-invoice{width:100%!important;max-width:100%!important;margin:0!important;'
        + 'padding:24px 28px 32px!important;box-sizing:border-box!important;}'
        + 'img{display:block!important;max-width:100%!important;}'
        + '*{color:#000!important;}</style>';
    if (/<head[^>]*>/i.test(out)) {
        out = out.replace(/<head([^>]*)>/i, '<head$1>' + captureCss);
    } else {
        out = out.replace(/<html([^>]*)>/i, '<html$1><head><meta charset="utf-8">' + captureCss + '</head>');
    }
    return { html: out, width: captureWidth };
}

function _loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise(function(resolve, reject) {
        const existing = document.querySelector('script[data-qz-src="' + src + '"]');
        if (existing) {
            existing.addEventListener('load', function() { resolve(window[globalName]); });
            existing.addEventListener('error', reject);
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.dataset.qzSrc = src;
        s.onload = function() { resolve(globalName ? window[globalName] : undefined); };
        s.onerror = function() { reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
    });
}

function _absolutizeHtmlUrls(html) {
    const base = new URL('.', window.location.href).href;
    return html
        .replace(/src="(?!https?:|data:)([^"]+)"/g, function(_, path) {
            return 'src="' + new URL(path, base).href + '"';
        })
        .replace(/href="(?!https?:|data:)([^"]+)"/g, function(_, path) {
            return 'href="' + new URL(path, base).href + '"';
        });
}

function _isA4Html(html) {
    return /class=["'][^"']*a4-invoice/i.test(html)
        || /@page\s*\{[^}]*size:\s*A4/i.test(html)
        || (/pi-qr-a4/i.test(html) && /max-width:\s*72\dpx/i.test(html));
}

function _waitForImagesIn(root, maxMs) {
    const images = Array.from(root.querySelectorAll('img'));
    if (!images.length) return Promise.resolve();
    return Promise.all(images.map(function(img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function(resolve) {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, maxMs);
        });
    }));
}

async function _htmlToPngBase64(html) {
    const html2canvas = await _loadScriptOnce(
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'html2canvas'
    );
    const prepared = _prepareHtmlForSilentPrint(html);
    const captureWidth = prepared.width;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + captureWidth + 'px;height:' + (_isA4Html(html) ? 2400 : 1200) + 'px;border:0;';
    document.body.appendChild(frame);

    try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        doc.open();
        doc.write(prepared.html);
        doc.close();

        await new Promise(function(resolve) {
            if (doc.readyState === 'complete') resolve();
            else frame.addEventListener('load', resolve, { once: true });
            setTimeout(resolve, 1500);
        });

        await _waitForImagesIn(doc.body, 3000);
        await new Promise(function(r) { setTimeout(r, 150); });

        const target = doc.getElementById('printInvoice') || doc.body;
        const captureHeight = Math.max(target.scrollHeight, target.offsetHeight) + 20;

        const canvas = await html2canvas(target, {
            backgroundColor: '#ffffff',
            scale: CAPTURE_SCALE,
            width: captureWidth,
            height: captureHeight,
            windowWidth: captureWidth,
            windowHeight: captureHeight,
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 3000
        });

        return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    } finally {
        document.body.removeChild(frame);
    }
}

async function _printImageBase64(base64, html) {
    await _connectQZ();
    const config = _isA4Html(html)
        ? qz.configs.create(QZ_PRINTER_NAME, { units: 'mm', size: { width: 210, height: 297 }, margins: 0 })
        : _qzThermalConfig();
    await _qzPrint(config, [{
        type: 'pixel',
        format: 'image',
        flavor: 'base64',
        data: base64
    }]);
}

async function printSilentHTML(htmlContent, fallback) {
    if (!IS_DESKTOP) {
        if (typeof fallback === 'function') fallback();
        return false;
    }
    try {
        const base64 = await _htmlToPngBase64(htmlContent);
        await _printImageBase64(base64, htmlContent);
        console.log('[QZ] Silent print sent.');
        return true;
    } catch (e) {
        console.warn('[QZ] Silent print failed:', e);
        if (typeof fallback === 'function') fallback();
        return false;
    }
}

async function kickDrawer() {
    if (!IS_DESKTOP) return; // silently ignore on mobile/tablet
    try {
        await _connectQZ();
        const config = _qzPrinterConfig();
        await _qzPrint(config, [{ type: 'raw', format: 'plain', data: DRAWER_KICK_BYTES }]);
        console.log('[QZ] Drawer kicked.');
    } catch (e) {
        console.warn('[QZ] Drawer kick failed:', e);
    }
}

function _base64ToPngBlob(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
}

async function receiptHtmlToPngBlob(htmlContent) {
    const base64 = await _htmlToPngBase64(htmlContent);
    return _base64ToPngBlob(base64);
}

window.receiptHtmlToPngBlob = receiptHtmlToPngBlob;

// Pre-warm QZ connection on desktop so first receipt prints immediately
if (IS_DESKTOP) {
    const _warmQZ = function() { _connectQZ().catch(function() {}); };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _warmQZ);
    } else {
        _warmQZ();
    }
}
