/**
 * ServiCell — job status names, in one place.
 *
 * Jobs store a status value (received, fixing, testing, ready, resolved,
 * unsuccessful). Every page shows the same name for each one, taken from here.
 * "abandoned" is not stored: a Ready or Unsuccessful job becomes Abandoned
 * 90 days after it was completed.
 *
 *   SCJobStatus.key(job)     → 'received' | 'fixing' | 'testing' | 'ready' |
 *                              'resolved' | 'unsuccessful' | 'abandoned'
 *   SCJobStatus.label(key)   → the name staff see, e.g. 'In Progress'
 *   SCJobStatus.ABANDON_DAYS → 90
 */
(function (global) {
    'use strict';

    var LABELS = {
        received: 'Received',
        fixing: 'In Progress',
        testing: 'Testing',
        ready: 'Ready for Pickup',
        resolved: 'Picked Up',
        unsuccessful: 'Unsuccessful',
        abandoned: 'Abandoned'
    };

    var ABANDON_DAYS = 90;

    /** The stored status text → its key, without the abandonment rule. */
    function keyOfStatus(status) {
        var s = String(status || '').toLowerCase();
        if (s.indexOf('resolved') !== -1 || s.indexOf('picked up') !== -1 || s.indexOf('handed over') !== -1) return 'resolved';
        if (s.indexOf('abandoned') !== -1) return 'abandoned';
        if (/fixing|repairing|work/.test(s)) return 'fixing';
        if (/testing|qc|checking/.test(s)) return 'testing';
        if (/completed|ready|pickup/.test(s)) return 'ready';
        if (/unsuccessful|no fix/.test(s)) return 'unsuccessful';
        return 'received';
    }

    /** A job → its key, including Abandoned 90 days after completion. */
    function key(job) {
        var k = keyOfStatus(job && job.status);
        if ((k === 'ready' || k === 'unsuccessful') && job && job.dateCompleted) {
            var days = Math.floor((new Date() - new Date(job.dateCompleted)) / 86400000);
            if (ABANDON_DAYS - days <= 0) return 'abandoned';
        }
        return k;
    }

    function label(k) {
        return LABELS[k] || (k ? String(k).charAt(0).toUpperCase() + String(k).slice(1) : '');
    }

    global.SCJobStatus = { key: key, keyOfStatus: keyOfStatus, label: label, LABELS: LABELS, ABANDON_DAYS: ABANDON_DAYS };
})(window);
