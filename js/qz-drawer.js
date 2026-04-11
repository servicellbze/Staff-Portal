// ── QZ Tray Cash Drawer Helper ────────────────────────────────────────────────
// Requires QZ Tray installed and running on the POS machine.
// Download: https://qz.io/download
//
// Set this to match the printer name exactly as shown in Windows Devices & Printers
const QZ_PRINTER_NAME = 'LR2000';

// ESC/POS drawer kick: ESC p 0 25 250
const DRAWER_KICK_BYTES = '\x1B\x70\x00\x19\xFA';

// Desktop-only guard — drawer not available on mobile/tablet
const IS_DESKTOP = !(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
                   && window.innerWidth >= 1024;

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

function _connectQZ() {
    return new Promise(function(resolve, reject) {
        if (_qzReady) { resolve(); return; }
        if (_qzConnecting) { reject('connecting'); return; }
        _qzConnecting = true;

        _loadQZScript(function() {
            if (!window.qz) { _qzConnecting = false; reject('no-lib'); return; }

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
                .then(function() { _qzReady = true; _qzConnecting = false; resolve(); })
                .catch(function(e) { _qzConnecting = false; reject(e); });
        });
    });
}

async function kickDrawer() {
    if (!IS_DESKTOP) return; // silently ignore on mobile/tablet
    try {
        await _connectQZ();
        const config = qz.configs.create(QZ_PRINTER_NAME);
        await qz.print(config, [{ type: 'raw', format: 'plain', data: DRAWER_KICK_BYTES }]);
        console.log('[QZ] Drawer kicked.');
    } catch (e) {
        console.warn('[QZ] Drawer kick failed:', e);
    }
}
