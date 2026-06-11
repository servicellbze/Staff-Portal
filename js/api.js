/**
 * ServiCell API Module
 * Routes all requests through the Supabase layer (js/supabase.js).
 *
 * The public interface is IDENTICAL to the old GAS version —
 * all existing callers work without modification.
 *
 * ⚠️ IMPORTANT: Set SUPABASE_URL and SUPABASE_ANON in js/supabase.js
 *    before going live.
 */

// Legacy timeout constant kept for any code that references it
const API_TIMEOUT = 15000;

// Kept for any code that still references SCRIPT_URL (logs, etc.)
const SCRIPT_URL = '[migrated to Supabase — see js/supabase.js]';

/**
 * GET-style read operations.
 * Accepts the same { action, ...params } object as before.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 *
 * @example
 * const { jobs } = await apiGet({ action: 'list' });
 */
async function apiGet(params) {
    const { action, id, repairId, orderNumber, ...rest } = params;
    const resolvedId = id || repairId || orderNumber;
    try {
        return await handleAction(
            (action || '').toLowerCase().trim(),
            resolvedId,
            { ...params }
        );
    } catch (error) {
        console.error('[API] GET error:', error.message, params);
        throw error;
    }
}

/**
 * POST-style write operations.
 * Accepts either a plain object or URLSearchParams.
 *
 * @param {Object|URLSearchParams} params
 * @returns {Promise<Object>}
 *
 * @example
 * await apiPost({ action: 'create', customerName: 'John', device: 'iPhone' });
 */
async function apiPost(params) {
    // Normalize URLSearchParams → plain object
    if (params instanceof URLSearchParams) {
        const obj = {};
        params.forEach((v, k) => { obj[k] = v; });
        params = obj;
    }

    const { action, id, repairId, orderNumber, ...rest } = params;
    const resolvedId = id || repairId || orderNumber;
    try {
        return await handleAction(
            (action || '').toLowerCase().trim(),
            resolvedId,
            { ...params }
        );
    } catch (error) {
        console.error('[API] POST error:', error.message, params);
        throw error;
    }
}

/**
 * Fire-and-forget POST — non-critical background operations.
 * Errors are logged but not thrown.
 *
 * @param {Object|URLSearchParams} params
 */
function apiPostAsync(params) {
    apiPost(params).catch(error => {
        console.warn('[API] Async POST failed:', error.message, params);
    });
}

/**
 * Image upload — still routed through the Cloudflare Worker / Drive.
 * Kept for backwards compatibility.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function apiUpload(params) {
    if (!(params instanceof URLSearchParams)) {
        params = new URLSearchParams(params);
    }
    try {
        const response = await fetch(
            'https://servicell-push.ericsonchee33.workers.dev/upload',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            }
        );
        if (!response.ok) throw new Error(`Upload HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('[API] Upload failed:', error);
        throw error;
    }
}

/**
 * Retry wrapper — unchanged from the original.
 *
 * @param {Function} apiFunction
 * @param {Object}   params
 * @param {number}   maxRetries
 * @returns {Promise<Object>}
 */
async function apiRetry(apiFunction, params, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiFunction(params);
        } catch (error) {
            lastError = error;
            console.warn(`[API] Attempt ${attempt}/${maxRetries} failed:`, error.message);
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

// ES6 module export (Node / bundlers)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { apiGet, apiPost, apiPostAsync, apiUpload, apiRetry, SCRIPT_URL };
}

console.log('[API] ServiCell API module loaded — powered by Supabase.');
