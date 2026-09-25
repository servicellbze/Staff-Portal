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

/** Upload with exponential backoff — used for inspection photos. */
async function apiUploadWithRetry(params, maxRetries = 3) {
    return apiRetry(apiUpload, params, maxRetries);
}

/** Compress a data-URL image for upload (shared by new-job + current-jobs). */
function compressDataUrl(dataUrl, maxPx, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const timer = setTimeout(() => reject(new Error('Image compression timed out')), 30000);
        img.onerror = () => {
            clearTimeout(timer);
            reject(new Error('Invalid image data'));
        };
        img.onload = () => {
            clearTimeout(timer);
            let w = img.width, h = img.height;
            if (w > maxPx || h > maxPx) {
                if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
                else       { w = Math.round(w * maxPx / h); h = maxPx; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    });
}

async function _jobHasImageUrl(repairId, url) {
    const data = await apiGet({ action: 'list' });
    const job = (data.jobs || []).find(j => String(j.id) === String(repairId));
    if (!job) return false;
    const needle = String(url).trim();
    return (job.inspectionImages || []).some(u => String(u).trim() === needle);
}

async function _attachImageUrlToJob(repairId, driveUrl) {
    let lastErr = 'Could not save image URL to job';
    for (let attempt = 1; attempt <= 3; attempt++) {
        const saved = await apiPost({ action: 'addimage', repairId, imageUrl: driveUrl });
        if (saved && saved.success === false) {
            lastErr = saved.error || lastErr;
        } else {
            try {
                if (await _jobHasImageUrl(repairId, driveUrl)) return;
            } catch (_) {
                return;
            }
            lastErr = 'Image URL not found on job after save';
        }
        if (attempt < 3) {
            await new Promise(r => setTimeout(r, 400 * attempt));
        }
    }
    throw new Error(lastErr);
}

const REPAIR_PHOTOS_BUCKET = 'repair-photos';
const INSPECTION_PHOTO_STAGES = ['front', 'back', 'accessories'];

async function _uploadToRepairPhotosBucket(repairId, compressedDataUrl, imageIndex) {
    const client = typeof window !== 'undefined' ? window.supabase : null;
    if (!client || !client.storage) {
        throw new Error('Supabase Storage is not available on this page');
    }
    const blob = await fetch(compressedDataUrl).then(r => {
        if (!r.ok) throw new Error('Could not read compressed image');
        return r.blob();
    });
    const stage = INSPECTION_PHOTO_STAGES[imageIndex - 1] || `photo-${imageIndex}`;
    const fileName = `job-${repairId}-${stage}-${Date.now()}.jpg`;
    const { error: uploadError } = await client.storage
        .from(REPAIR_PHOTOS_BUCKET)
        .upload(fileName, blob, { contentType: 'image/jpeg' });
    if (uploadError) throw new Error(uploadError.message || 'Storage upload failed');
    const { data: urlData } = client.storage.from(REPAIR_PHOTOS_BUCKET).getPublicUrl(fileName);
    const publicUrl = urlData && urlData.publicUrl;
    if (!publicUrl) throw new Error('Storage returned no public URL');
    return publicUrl;
}

/**
 * Upload one inspection photo to Supabase Storage and attach URL to the job row.
 * @returns {Promise<string>} Public object URL
 */
async function uploadAndAttachJobImage(repairId, dataUrl, imageIndex) {
    const compressed = await compressDataUrl(dataUrl, 1200, 0.8);
    let publicUrl;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            publicUrl = await _uploadToRepairPhotosBucket(repairId, compressed, imageIndex);
            break;
        } catch (error) {
            lastError = error;
            console.warn(`[API] Storage upload attempt ${attempt}/3 failed:`, error.message);
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            }
        }
    }
    if (!publicUrl) {
        throw new Error(lastError ? lastError.message : 'Storage upload failed');
    }
    await _attachImageUrlToJob(repairId, publicUrl);
    return publicUrl;
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
    module.exports = {
        apiGet, apiPost, apiPostAsync, apiUpload, apiUploadWithRetry,
        apiRetry, compressDataUrl, uploadAndAttachJobImage, SCRIPT_URL
    };
}

console.log('[API] ServiCell API module loaded — powered by Supabase.');
