/**
 * ServiCell API Module
 * Central interface for all server communication
 * 
 * ⚠️ CRITICAL RULE: DO NOT call fetch() directly anywhere else in the codebase.
 * ALL server requests MUST go through these functions to ensure:
 * - Consistent Content-Type headers
 * - Proper error handling
 * - Request timeout management
 * - Centralized logging and debugging
 */

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyLNGR6L75MieV_R-s9yyjTfzpAAut_HIwhbZBBNyPxj9WDzRLNWics0FZ1ZayI3imx/exec';

// Request timeout (15 seconds - GAS can be slow)
const API_TIMEOUT = 15000;

/**
 * GET request - for reading data (list, load, fetch operations)
 * 
 * @param {Object} params - Query parameters as key-value pairs
 * @returns {Promise<Object>} JSON response from server
 * 
 * @example
 * const jobs = await apiGet({ action: 'list' });
 * const item = await apiGet({ action: 'listinventory' });
 */
async function apiGet(params) {
    const url = SCRIPT_URL + '?' + new URLSearchParams(params).toString();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - server took too long to respond');
        }
        throw error;
    }
}

/**
 * POST request - for creating/updating/deleting data
 * 
 * @param {Object|URLSearchParams} params - Request parameters
 * @returns {Promise<Object>} JSON response from server
 * 
 * @example
 * const result = await apiPost({ action: 'create', name: 'John', device: 'iPhone' });
 * const sale = await apiPost({ action: 'createsale', items: JSON.stringify(items) });
 */
async function apiPost(params) {
    // Normalize to URLSearchParams if plain object
    if (!(params instanceof URLSearchParams)) {
        params = new URLSearchParams(params);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString(),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout - server took too long to respond');
        }
        throw error;
    }
}

/**
 * Fire-and-forget POST - for non-critical background operations
 * Does not wait for response, logs errors to console
 * 
 * @param {Object|URLSearchParams} params - Request parameters
 * 
 * @example
 * // Don't block UI for inventory adjustments
 * apiPostAsync({ action: 'adjuststock', sku: 'ABC123', qty: 1, type: 'remove' });
 */
function apiPostAsync(params) {
    apiPost(params).catch(error => {
        console.warn('[API] Async POST failed:', error.message, params);
    });
}

/**
 * Upload file/image with base64 encoding
 * Special handling for large payloads (images)
 * 
 * @param {Object} params - Must include base64Data and mimeType
 * @returns {Promise<Object>} JSON response
 * 
 * @example
 * const result = await apiUpload({
 *     action: 'uploadimage',
 *     jobId: '12345',
 *     base64Data: imageBase64,
 *     mimeType: 'image/jpeg',
 *     imageIndex: 1
 * });
 */
async function apiUpload(params) {
    // Use standard POST but with mode: 'no-cors' for large uploads
    if (!(params instanceof URLSearchParams)) {
        params = new URLSearchParams(params);
    }
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for large base64 payloads
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        
        // no-cors mode doesn't allow reading response
        // Assume success if no error thrown
        return { success: true };
    } catch (error) {
        console.error('[API] Upload failed:', error);
        throw error;
    }
}

/**
 * Retry wrapper - automatically retries failed requests
 * Useful for flaky network conditions
 * 
 * @param {Function} apiFunction - apiGet or apiPost
 * @param {Object} params - Request parameters
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Object>} JSON response
 * 
 * @example
 * const data = await apiRetry(apiPost, { action: 'create', name: 'John' }, 3);
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
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Export for ES6 modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        apiGet, 
        apiPost, 
        apiPostAsync, 
        apiUpload, 
        apiRetry, 
        SCRIPT_URL 
    };
}

// Log initialization
console.log('[API] ServiCell API module loaded. All requests will use standardized communication.');
