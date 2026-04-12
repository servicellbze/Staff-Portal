// ─────────────────────────────────────────────────────────────────────────────
// ServiCell Belize — Google Apps Script Backend
// Sheet tabs: Sheet1 (jobs), Special Orders, Users, Customers, AuditLog,
//             PendingNotifications, Inventory, StockMovements, PushSubscriptions
// ─────────────────────────────────────────────────────────────────────────────
// @OnlyCurrentDoc — removed to allow Drive access across files
/**
 * @fileoverview ServiCell GAS Backend
 * Required OAuth scopes:
 * https://www.googleapis.com/auth/spreadsheets
 * https://www.googleapis.com/auth/drive
 * https://www.googleapis.com/auth/script.external_request
 */
const JOBS_SHEET     = "Sheet1";
const SO_SHEET       = "Special Orders";
const USERS_SHEET    = "Users";
const CUST_SHEET     = "Customers";
const AUDIT_SHEET    = "AuditLog";
const NOTIF_SHEET    = "PendingNotifications";
const INV_SHEET      = "Inventory";
const MOV_SHEET      = "StockMovements";
const PUSH_SHEET     = "PushSubscriptions";
const SALES_SHEET    = "DailySales";
const PAYOUTS_SHEET  = "Payouts";
const BILLS_SHEET    = "ActiveBills";
const DAYCLOSE_SHEET = "DayClose";

// Cloudflare Worker URL for Web Push delivery
const WORKER_URL  = 'https://servicell-push.ericsonchee33.workers.dev';

function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  let payload = {};
  if (e.postData && e.postData.contents) {
    try { payload = JSON.parse(e.postData.contents); } catch (_) {}
  }
  const data   = Object.assign({}, e.parameter, payload);
  const action = (data.action || "").toLowerCase().trim();
  const id     = data.id || data.repairId || data.orderNumber;

  const readOnly = ['list','listorders','listinventory','listmovements','lowstock','getpending','checkrole','lastid','listsales','listpayouts','listbills','listdaycloses','listcustomers'];
  if (readOnly.includes(action)) {
    try { return routeAction(action, id, data); }
    catch (err) { console.error("handleRequest error:", err); return json({ error: err.toString() }); }
  }

  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(10000);
  if (!acquired) return json({ error: 'Server busy — please retry in a moment.', busy: true });
  try { return routeAction(action, id, data); }
  catch (err) { console.error("handleRequest error:", err); return json({ error: err.toString() }); }
  finally { lock.releaseLock(); }
}

function routeAction(action, id, data) {
  switch (action) {
    case "login":          return loginUser(data);
    case "changepassword": return changePassword(data);
    case "checkrole":      return checkUserRole(data.username);
    case "list":           return json({ jobs: getJobs() });
    case "lastid":         return json({ lastId: getLastJobId() });
    case "create":         createJob(data); return json({ success: true });
    case "update":         updateJob(id, data); return json({ success: true });
    case "delete":         deleteJob(id); return json({ success: true });
    case "archive":        archiveOldJobs(); return json({ success: true });
    case "listorders":     return json({ orders: getSpecialOrders() });
    case "createorder":    return json(createSpecialOrder(data));
    case "updateorder":    return json(updateSpecialOrder(id, data));
    case "deleteorder":    return json(deleteSpecialOrder(id));
    case "listinventory":  return json({ items: getInventory() });
    case "listmovements":  return json({ movements: getMovements(data) });
    case "createitem":     return json(createItem(data));
    case "updateitem":     return json(updateItem(data));
    case "deleteitem":     return json(deleteItem(data.sku));
    case "adjuststock":    return json(adjustStock(data));
    case "upsertitem":     return json(upsertItem(data));
    case "lowstock":       return json({ items: getLowStock() });
    case "getpending":     return getPendingNotificationsForRole((data.role || '').toLowerCase(), data.username || '');
    case "markdelivered":  return markDelivered(data);
    case "subscribe":      return json(saveSubscription(data));
    case "unsubscribe":    return json(removeSubscription(data));
    case "testpush":       notify('update', '🔔 Test Push', 'Push notifications are working!'); return json({ success: true });
    case "listsales":      return json({ sales: getSales(data) });
    case "listpayouts":    return json({ payouts: getPayouts(data) });
    case "listbills":      return json({ bills: getBills() });
    case "createsale":     return json(createSale(data));
    case "createpayout":   return json(createPayout(data));
    case "createbill":     return json(createBill(data));
    case "settlebill":     return json(settleBill(data));
    case "updatebill":     return json(updateBill(data));
    case "reversesale":    return json(reverseSale(data));
    case "updatesale":     return json(updateSale(data));
    case "submitdayclose": return json(submitDayClose(data));
    case "listdaycloses":  return json({ closes: getDayCloses(data) });
    case "listcustomers":  return json({ customers: getCustomers() });
    case "uploadimage":    return json(uploadInspectionImage(data));
    default:
      if (id && !action) return json(getJobByIdVerified(id, data.phone4 || ''));
      return json({ error: "Unknown action: " + action });
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function loginUser(data) {
  const sheet = getSheet(USERS_SHEET);
  if (!sheet) return json({ success: false, error: "Users sheet not found" });
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.username) && String(rows[i][1]) === String(data.password))
      return json({ success: true, role: rows[i][2], username: rows[i][0], displayName: rows[i][3] || '' });
  }
  return json({ success: false });
}

function checkUserRole(username) {
  const sheet = getSheet(USERS_SHEET);
  if (!sheet) return json({ success: false, error: "Users sheet not found" });
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(username))
      return json({ success: true, role: rows[i][2], username: rows[i][0] });
  }
  return json({ success: false, error: "User not found" });
}

function changePassword(data) {
  const curPw = data.currentPassword || data.currentpassword;
  const newPw = data.newPassword || data.newpassword;
  if (!data.username || !curPw || !newPw) return json({ success: false, message: "Missing required fields" });
  const sheet = getSheet(USERS_SHEET);
  if (!sheet) return json({ success: false, message: "Users sheet not found" });
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.username)) {
      if (String(rows[i][1]) !== String(curPw)) return json({ success: false, message: "Current password incorrect" });
      sheet.getRange(i + 1, 2).setValue(newPw);
      auditLog("PW_CHANGE", data.username);
      return json({ success: true, message: "Password updated" });
    }
  }
  return json({ success: false, message: "User not found" });
}

// ── REPAIR JOBS ───────────────────────────────────────────────────────────────
function getJobs() {
  const sheet = getSheet(JOBS_SHEET);
  if (!sheet) return [];
  updateAbandonedJobs(sheet);
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    customerName:        r[0],
    id:                  r[1],
    device:              r[2],
    status:              r[3],
    dateReceived:        r[4] instanceof Date ? r[4].toISOString() : r[4],
    dateCompleted:       (r[5] instanceof Date && r[5].getFullYear() > 1900) ? r[5].toISOString() : (r[5] || ""),
    customerPhone:       r[6],
    notes:               r[7],
    issue:               r[9],
    jobType:             r[10],
    priority:            r[11],
    payStatus:           r[13],
    technician:          r[14] || "Unknown",
    estimatedCompletion: (r[15] instanceof Date && r[15].getFullYear() > 1900) ? r[15].toISOString() : (r[15] || ""),
    inspection:          r[16] || "No damage noted",
    inspectionImages:    r[17] ? String(r[17]).split(',').map(s => s.trim()).filter(Boolean) : []
  })).filter(j => j.id);
}

function getLastJobId() {
  const sheet = getSheet(JOBS_SHEET);
  if (!sheet) return 100;
  const ids = sheet.getDataRange().getValues().slice(1).map(r => Number(r[1])).filter(n => !isNaN(n) && n > 0);
  return ids.length ? Math.max(...ids) : 100;
}

function getJobById(id) {
  const job = getJobs().find(j => String(j.id) === String(id));
  return job ? { success: true, job } : { success: false, error: "Job not found" };
}

function getJobByIdVerified(id, phone4) {
  const result = getJobById(id);
  if (!result.success) return result;
  const job = result.job;
  const supplied = String(phone4 || '').trim();
  if (!supplied || supplied.length !== 4 || !/^\d{4}$/.test(supplied))
    return { success: false, authFailed: true };
  const storedPhone = String(job.customerPhone || '').replace(/\D/g, '');
  const storedLast4 = storedPhone.slice(-4);
  if (!storedLast4 || storedLast4 !== supplied)
    return { success: false, authFailed: true };
  const safeJob = Object.assign({}, job);
  delete safeJob.customerPhone;
  return { success: true, job: safeJob };
}

function createJob(data) {
  if (!data.customerName) return;
  if (!data.device) return;
  const sheet = getSheet(JOBS_SHEET);
  sheet.appendRow([
    data.customerName || "", data.repairId || data.id || "",
    data.device || "", data.status || "received", new Date(), "",
    data.customerPhone || "", data.notes || "", "",
    data.issue || "", data.jobType || "", data.priority || "low",
    "", "unpaid", data.technician || data.username || "Unknown",
    data.estimatedCompletion || "",
    data.inspection || "No damage noted"
  ]);
  saveCustomer(data);
  notify('received', '📦 New Job Received',
    'Job #' + (data.repairId || data.id) + ' — ' + (data.device || 'Device') + ' for ' + (data.customerName || 'Customer'));
}

function updateJob(id, updates) {
  const sheet = getSheet(JOBS_SHEET);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(id)) {
      const row = i + 1;
      if (updates.status        !== undefined) sheet.getRange(row, 4).setValue(updates.status);
      if (updates.notes         !== undefined) sheet.getRange(row, 8).setValue(updates.notes);
      if (updates.dateCompleted !== undefined) sheet.getRange(row, 6).setValue(updates.dateCompleted);
      if (updates.priority      !== undefined) sheet.getRange(row, 12).setValue(updates.priority);
      if (updates.payStatus     !== undefined) sheet.getRange(row, 14).setValue(updates.payStatus);
      if (updates.status === 'ready') {
        notify('ready', '✅ Device Ready for Pickup',
          'Job #' + id + ' — ' + (rows[i][2] || 'Device') + ' is ready for ' + (rows[i][0] || 'customer') + '.');
      } else if (updates.status === 'abandoned') {
        notify('abandoned', '⚠️ Abandoned Device',
          'Job #' + id + ' — ' + (rows[i][2] || 'Device') + ' has been marked as abandoned.');
      } else if (updates.status) {
        notify('jobstatus', '🔧 Job Status Updated', 'Job #' + id + ' is now: ' + updates.status + '.');
      }
      return;
    }
  }
}

function deleteJob(id) {
  const sheet = getSheet(JOBS_SHEET);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(id)) { sheet.deleteRow(i + 1); return; }
  }
}

function archiveOldJobs() { console.log("archiveOldJobs called"); }

function updateAbandonedJobs(sheet) {
  const ABANDON_DAYS = 90;
  const ABANDON_MS   = ABANDON_DAYS * 24 * 60 * 60 * 1000;
  const SKIP         = ['abandoned', 'resolved', 'unsuccessful'];
  const rows         = sheet.getDataRange().getValues();
  const now          = Date.now();
  const props        = PropertiesService.getScriptProperties();
  let notified       = {};
  try { notified = JSON.parse(props.getProperty('abandoned_notified') || '{}'); } catch(_) {}
  for (let i = 1; i < rows.length; i++) {
    const status = String(rows[i][3] || '').toLowerCase();
    if (SKIP.includes(status)) continue;
    const d1 = rows[i][4] instanceof Date ? rows[i][4].getTime() : (rows[i][4] ? new Date(rows[i][4]).getTime() : 0);
    const d2 = rows[i][5] instanceof Date ? rows[i][5].getTime() : (rows[i][5] ? new Date(rows[i][5]).getTime() : 0);
    const lastUpdated = Math.max(d1, d2);
    if (!lastUpdated || (now - lastUpdated) < ABANDON_MS) continue;
    sheet.getRange(i + 1, 4).setValue('abandoned');
    const jobId = String(rows[i][1]);
    if (!notified[jobId]) {
      notified[jobId] = true;
      props.setProperty('abandoned_notified', JSON.stringify(notified));
      queueNotification('abandoned', '⚠️ Abandoned Device',
        'Job #' + jobId + ' — ' + (rows[i][2] || 'Device') + ' for ' + (rows[i][0] || 'customer') + ' has been marked abandoned after ' + ABANDON_DAYS + ' days.');
    }
  }
}

// ── SPECIAL ORDERS ────────────────────────────────────────────────────────────
function getSpecialOrders() {
  const sheet = getSheet(SO_SHEET);
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    orderNumber:   String(r[0] || ""),
    customer:      r[1],
    dateRequested: r[2] instanceof Date ? r[2].toISOString() : r[2],
    item: r[3], quantity: r[4], status: r[5] || "Pending",
    notes: r[6], updatedBy: r[7],
    dateUpdated: r[8] instanceof Date ? r[8].toISOString() : r[8],
    phone: r[9], requestedBy: r[10]
  })).filter(o => o.orderNumber).reverse();
}

function createSpecialOrder(data) {
  let sheet = getSheet(SO_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SO_SHEET);
    sheet.appendRow(["Order #","Customer Name","Date Requested","Item","Qty","Status","Notes","Updated By","Date Updated","Phone","Requested By"]);
  }
  const orderNumber = "SO-" + (100 + Math.max(0, sheet.getLastRow() - 1));
  const now = new Date();
  sheet.appendRow([orderNumber, data.customer || "", now, data.item || "",
    data.quantity || 1, "Pending", data.notes || "",
    data.requestedBy || "Unknown", now, data.phone || "", data.requestedBy || "Unknown"]);
  notify('specialorder', '🛒 New Special Order',
    (data.requestedBy || 'Someone') + ' requested: ' + (data.item || 'an item'));
  return { success: true, orderNumber, status: "Pending", dateRequested: now.toISOString(), dateUpdated: now.toISOString() };
}

function updateSpecialOrder(id, data) {
  const sheet = getSheet(SO_SHEET);
  if (!sheet) return { success: false, error: "Sheet not found" };
  const colA     = sheet.getRange("A:A").getValues().flat().map(String);
  const rowIndex = colA.indexOf(String(id)) + 1;
  if (rowIndex <= 1) return { success: false, error: "Order not found: " + id };
  const now = new Date();
  if (data.customer  !== undefined) sheet.getRange(rowIndex, 2).setValue(data.customer);
  if (data.item      !== undefined) sheet.getRange(rowIndex, 4).setValue(data.item);
  if (data.quantity  !== undefined) sheet.getRange(rowIndex, 5).setValue(data.quantity);
  if (data.status    !== undefined) sheet.getRange(rowIndex, 6).setValue(data.status);
  if (data.notes     !== undefined) sheet.getRange(rowIndex, 7).setValue(data.notes);
  if (data.updatedBy !== undefined) sheet.getRange(rowIndex, 8).setValue(data.updatedBy);
  sheet.getRange(rowIndex, 9).setValue(now);
  if (data.phone     !== undefined) sheet.getRange(rowIndex, 10).setValue(data.phone);
  if (data.status === 'Acknowledged' || data.status === 'Ordered' || data.status === 'Arrived') {
    notify('specialorder', 'Special Order ' + id + ' — ' + data.status, 'Order has been marked as ' + data.status + '.');
  }
  return { success: true, orderNumber: id, status: data.status || "Updated", dateUpdated: now.toISOString() };
}

function deleteSpecialOrder(id) {
  const sheet = getSheet(SO_SHEET);
  if (!sheet) return { success: false, error: "Sheet not found" };
  const colA     = sheet.getRange("A:A").getValues().flat().map(String);
  const rowIndex = colA.indexOf(String(id)) + 1;
  if (rowIndex <= 1) return { success: false, error: "Order not found: " + id };
  sheet.deleteRow(rowIndex);
  return { success: true };
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────
function ensureInvSheet() {
  let sheet = getSheet(INV_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(INV_SHEET);
    sheet.appendRow(["SKU","Name","Category","Qty","MinQty","CostPrice","SalePrice","Supplier","Location","Compatible","Notes","LastUpdated","UpdatedBy"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureMovSheet() {
  let sheet = getSheet(MOV_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(MOV_SHEET);
    sheet.appendRow(["Timestamp","SKU","ItemName","Type","Qty","QtyBefore","QtyAfter","JobID","Reason","UpdatedBy"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getInventory() {
  const sheet = ensureInvSheet();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    sku: String(r[0] || ""), name: r[1], category: r[2],
    qty: Number(r[3]) || 0, minQty: Number(r[4]) || 0,
    costPrice: Number(r[5]) || 0, salePrice: Number(r[6]) || 0,
    supplier: r[7], location: r[8], compat: r[9], notes: r[10],
    lastUpdated: r[11] instanceof Date ? r[11].toISOString() : r[11],
    updatedBy: r[12]
  })).filter(i => i.sku);
}

function getMovements(data) {
  const sheet = ensureMovSheet();
  if (sheet.getLastRow() < 2) return [];
  const limit = parseInt(data.limit) || 500;
  const sku   = data.sku || null;
  let rows = sheet.getDataRange().getValues().slice(1).reverse();
  if (sku) rows = rows.filter(r => String(r[1]) === String(sku));
  return rows.slice(0, limit).map(r => ({
    timestamp: r[0] instanceof Date ? r[0].toISOString() : r[0],
    sku: String(r[1] || ""), itemName: r[2], type: r[3],
    qty: Number(r[4]) || 0, qtyBefore: Number(r[5]) || 0, qtyAfter: Number(r[6]) || 0,
    jobId: r[7], reason: r[8], updatedBy: r[9]
  }));
}

function getLowStock() { return getInventory().filter(i => i.qty <= i.minQty); }

function createItem(data) {
  if (!data.sku || !data.name) return { success: false, error: "SKU and Name are required" };
  const sheet = ensureInvSheet();
  const skus = sheet.getRange("A:A").getValues().flat().map(String);
  if (skus.includes(String(data.sku))) return { success: false, error: "SKU already exists: " + data.sku };
  const now = new Date();
  sheet.appendRow([data.sku, data.name, data.category || "Other",
    Number(data.qty) || 0, Number(data.minQty) || 1,
    Number(data.costPrice) || 0, Number(data.salePrice) || 0,
    data.supplier || "", data.location || "", data.compat || "", data.notes || "",
    now, data.updatedBy || "Unknown"]);
  if (Number(data.qty) > 0) {
    logMovement(data.sku, data.name, 'add', Number(data.qty), 0, Number(data.qty), '', 'Initial stock', data.updatedBy || "Unknown");
  }
  return { success: true, sku: data.sku };
}

function updateItem(data) {
  if (!data.sku) return { success: false, error: "SKU required" };
  const sheet = ensureInvSheet();
  const skus  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = skus.indexOf(String(data.sku)) + 1;
  if (row <= 1) return { success: false, error: "Item not found: " + data.sku };
  const now = new Date();
  if (data.name      !== undefined) sheet.getRange(row, 2).setValue(data.name);
  if (data.category  !== undefined) sheet.getRange(row, 3).setValue(data.category);
  if (data.minQty    !== undefined) sheet.getRange(row, 5).setValue(Number(data.minQty));
  if (data.costPrice !== undefined) sheet.getRange(row, 6).setValue(Number(data.costPrice));
  if (data.salePrice !== undefined) sheet.getRange(row, 7).setValue(Number(data.salePrice));
  if (data.supplier  !== undefined) sheet.getRange(row, 8).setValue(data.supplier);
  if (data.location  !== undefined) sheet.getRange(row, 9).setValue(data.location);
  if (data.compat    !== undefined) sheet.getRange(row, 10).setValue(data.compat);
  if (data.notes     !== undefined) sheet.getRange(row, 11).setValue(data.notes);
  sheet.getRange(row, 12).setValue(now);
  sheet.getRange(row, 13).setValue(data.updatedBy || "Unknown");
  if (data.cashierEdit === '1') {
    notify('manageronly', '✏️ Inventory Edit by ' + (data.updatedBy || 'Cashier'),
      (data.updatedBy || 'A cashier') + ' edited item: ' + (data.name || data.sku) + '. Please review.');
  }
  return { success: true };
}

function deleteItem(sku) {
  if (!sku) return { success: false, error: "SKU required" };
  const sheet = ensureInvSheet();
  const skus  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = skus.indexOf(String(sku)) + 1;
  if (row <= 1) return { success: false, error: "Item not found: " + sku };
  sheet.deleteRow(row);
  return { success: true };
}

function adjustStock(data) {
  if (!data.sku) return { success: false, error: "SKU required" };
  const sheet = ensureInvSheet();
  const skus  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = skus.indexOf(String(data.sku)) + 1;
  if (row <= 1) return { success: false, error: "Item not found: " + data.sku };
  const currentQty = Number(sheet.getRange(row, 4).getValue()) || 0;
  const adjQty     = Number(data.qty) || 0;
  const type       = data.type || 'add';
  let newQty;
  if (type === 'set')         newQty = adjQty;
  else if (type === 'remove') newQty = Math.max(0, currentQty - adjQty);
  else                        newQty = currentQty + adjQty;
  const now      = new Date();
  const itemName = String(sheet.getRange(row, 2).getValue());
  sheet.getRange(row, 4).setValue(newQty);
  sheet.getRange(row, 12).setValue(now);
  sheet.getRange(row, 13).setValue(data.updatedBy || "Unknown");
  logMovement(data.sku, itemName, type, adjQty, currentQty, newQty, data.jobId || "", data.reason || "", data.updatedBy || "Unknown");
  const minQty = Number(sheet.getRange(row, 5).getValue()) || 0;
  if (newQty <= 0) {
    notify('manageronly', '🔴 Out of Stock: ' + itemName, itemName + ' is now out of stock. Reorder needed.');
  } else if (newQty <= minQty) {
    notify('manageronly', '🟡 Low Stock: ' + itemName, itemName + ' has only ' + newQty + ' units left (min: ' + minQty + ').');
  }
  return { success: true, sku: data.sku, newQty, qtyBefore: currentQty };
}

function logMovement(sku, itemName, type, qty, qtyBefore, qtyAfter, jobId, reason, updatedBy) {
  const sheet = ensureMovSheet();
  sheet.appendRow([new Date(), sku, itemName, type, qty, qtyBefore, qtyAfter, jobId || "", reason || "", updatedBy || ""]);
}

function upsertItem(data) {
  if (!data.sku || !data.name) return { success: false, error: "SKU and Name required" };
  const sheet = ensureInvSheet();
  const skus  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = skus.indexOf(String(data.sku)) + 1;
  const now   = new Date();
  if (row <= 1) {
    sheet.appendRow([data.sku, data.name, data.category || 'Other',
      Number(data.qty) || 0, Number(data.minQty) || 2,
      Number(data.costPrice) || 0, Number(data.salePrice) || 0,
      data.supplier || '', '', '', '', now, data.updatedBy || 'Import']);
    return { success: true, action: 'created' };
  } else {
    if (data.name)      sheet.getRange(row, 2).setValue(data.name);
    if (data.category)  sheet.getRange(row, 3).setValue(data.category);
    if (data.qty !== undefined && data.qty !== '') sheet.getRange(row, 4).setValue(Number(data.qty) || 0);
    if (data.minQty !== undefined && data.minQty !== '') sheet.getRange(row, 5).setValue(Number(data.minQty) || 2);
    if (data.costPrice !== undefined && data.costPrice !== '') sheet.getRange(row, 6).setValue(Number(data.costPrice) || 0);
    if (data.salePrice !== undefined && data.salePrice !== '') sheet.getRange(row, 7).setValue(Number(data.salePrice) || 0);
    if (data.supplier)  sheet.getRange(row, 8).setValue(data.supplier);
    sheet.getRange(row, 12).setValue(now);
    sheet.getRange(row, 13).setValue(data.updatedBy || 'Import');
    return { success: true, action: 'updated' };
  }
}

// ── PENDING NOTIFICATIONS ─────────────────────────────────────────────────────
function queueNotification(type, title, body) {
  let sheet = getSheet(NOTIF_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(NOTIF_SHEET);
    sheet.appendRow(["ID","Type","Title","Body","Timestamp","Delivered","DeliveredTo"]);
  }
  const id = Utilities.getUuid();
  sheet.appendRow([id, type, title, body, new Date().toISOString(), false]);
  return id;
}

function getPendingNotificationsForRole(role) {
  const sheet = getSheet(NOTIF_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return json({ notifications: [] });
  const ROLE_TYPES = {
    manager:    ['received','ready','abandoned','jobstatus','specialorder','update','manageronly'],
    cashier:    ['received','ready','abandoned','jobstatus','specialorder','update'],
    technician: ['received','ready','abandoned','jobstatus','specialorder','update']
  };
  const allowed  = ROLE_TYPES[role] || ROLE_TYPES.technician;
  const username = arguments[1] || '';
  const rows = sheet.getDataRange().getValues().slice(1);
  const pending = rows.filter(r => {
    if (!allowed.includes(String(r[1]))) return false;
    const deliveredTo = String(r[6] || '').split(',').map(s => s.trim()).filter(Boolean);
    return !deliveredTo.includes(username);
  }).map(r => ({ id: String(r[0]), type: String(r[1]), title: String(r[2]), body: String(r[3]) }));
  return json({ notifications: pending });
}

function markDelivered(data) {
  const sheet = getSheet(NOTIF_SHEET);
  if (!sheet) return json({ success: true });
  const ids = Array.isArray(data.ids) ? data.ids : String(data.ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const username = data.username || '';
  const colA = sheet.getRange("A:A").getValues().flat().map(String);
  ids.forEach(id => {
    const row = colA.indexOf(String(id)) + 1;
    if (row <= 1) return;
    const current = String(sheet.getRange(row, 7).getValue() || '');
    const list = current.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.includes(username)) {
      list.push(username);
      sheet.getRange(row, 7).setValue(list.join(','));
    }
  });
  return json({ success: true });
}

function notify(type, title, body) {
  queueNotification(type, title, body);
  pushToAll(type, title, body);
}

// ── PUSH SUBSCRIPTIONS ────────────────────────────────────────────────────────
function saveSubscription(data) {
  let sheet = getSheet(PUSH_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(PUSH_SHEET);
    sheet.appendRow(["Username","Endpoint","p256dh","Auth","Date Added"]);
  }
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(data.endpoint)) {
      sheet.getRange(i + 1, 1).setValue(data.username || "");
      sheet.getRange(i + 1, 3).setValue(data.p256dh   || "");
      sheet.getRange(i + 1, 4).setValue(data.auth     || "");
      return { success: true, updated: true };
    }
  }
  sheet.appendRow([data.username || "", data.endpoint, data.p256dh, data.auth, new Date()]);
  return { success: true, updated: false };
}

function removeSubscription(data) {
  const sheet = getSheet(PUSH_SHEET);
  if (!sheet) return { success: true };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) === String(data.endpoint)) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  return { success: true };
}

function pushToAll(type, title, body) {
  const sheet = getSheet(PUSH_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;
  const rows = sheet.getDataRange().getValues().slice(1);
  rows.forEach((row, i) => {
    try { sendWebPush(row[1], row[2], row[3], title, body, type); }
    catch (e) {
      console.warn('Push failed row ' + (i + 2) + ':', e.message);
      if (e.message && e.message.includes('410')) sheet.deleteRow(i + 2);
    }
  });
}

function sendWebPush(endpoint, p256dh, auth, title, body, type) {
  const res = UrlFetchApp.fetch(WORKER_URL, {
    method: 'POST', contentType: 'application/json',
    payload: JSON.stringify({ endpoint, p256dh, auth, title, body, type }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 410 || code === 404) throw new Error('410');
  if (code >= 400) throw new Error('Worker error: ' + code + ' — ' + res.getContentText());
}

function cleanupOldNotifications() {
  const sheet = getSheet(NOTIF_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows   = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const ts = String(rows[i][4]);
    if (ts && ts < cutoff) sheet.deleteRow(i + 1);
  }
}

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────
function saveCustomer(data) {
  if (!data.customerName) return;
  let sheet = getSheet(CUST_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(CUST_SHEET);
    sheet.appendRow(["Name","Phone","Last Seen"]);
  }
  const rows = sheet.getDataRange().getValues();
  const now  = new Date();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(data.customerName).toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue(data.customerPhone || "");
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  sheet.appendRow([data.customerName, data.customerPhone || "", now]);
}

function getCustomers() {
  const sheet = getSheet(CUST_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    name:     String(r[0] || ''),
    phone:    String(r[1] || ''),
    lastSeen: r[2] instanceof Date ? r[2].toISOString() : r[2]
  })).filter(c => c.name);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getSheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function auditLog(event, username) {
  try {
    let sheet = getSheet(AUDIT_SHEET) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(AUDIT_SHEET);
    sheet.appendRow([new Date().toISOString(), event, username]);
  } catch (e) { console.log("auditLog failed:", e); }
}

// ── SALES ─────────────────────────────────────────────────────────────────────
function ensureSalesSheet() {
  let sheet = getSheet(SALES_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SALES_SHEET);
    sheet.appendRow(["SaleID","Timestamp","ShiftDate","Shift","Cashier","Customer","Items","Total","Method","AmountPaid","JobID","Status"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSales(data) {
  const sheet = ensureSalesSheet();
  if (sheet.getLastRow() < 2) return [];
  const tz         = Session.getScriptTimeZone();
  const filterDate = data.date || '';
  const filterFrom = data.from || '';
  const filterTo   = data.to   || '';
  return sheet.getDataRange().getValues().slice(1).map(r => {
    const shiftDate = r[2] instanceof Date
      ? Utilities.formatDate(r[2], tz, 'yyyy-MM-dd')
      : String(r[2] || '').slice(0, 10);
    let itemsStr = r[6];
    try {
      const parsed = typeof itemsStr === 'string' ? JSON.parse(itemsStr) : itemsStr;
      itemsStr = JSON.stringify(parsed);
    } catch (_) { itemsStr = JSON.stringify([{ name: '(unreadable item data)', qty: 1, price: 0, total: 0 }]); }
    return {
      saleId:     String(r[0] || ''),
      timestamp:  r[1] instanceof Date ? r[1].toISOString() : r[1],
      shiftDate,
      shift:      r[3], cashier: r[4], customer: r[5],
      items:      itemsStr,
      total:      Number(r[7]) || 0,
      method:     r[8],
      amountPaid: Number(r[9]) || 0,
      jobId:      r[10],
      status:     String(r[11] || 'paid')
    };
  }).filter(s => {
    if (!s.saleId) return false;
    if (s.status === 'reversed') return false;
    if (filterDate) return s.shiftDate === filterDate;
    if (filterFrom && filterTo) return s.shiftDate >= filterFrom && s.shiftDate <= filterTo;
    return true;
  });
}

function createSale(data) {
  if (!data.items)   return { success: false, error: "Items required" };
  if (!data.cashier) return { success: false, error: "Cashier required" };
  let items;
  try { items = JSON.parse(data.items); } catch(e) { return { success: false, error: "Invalid items data" }; }
  if (!Array.isArray(items) || !items.length) return { success: false, error: "At least one item required" };
  const total = Number(data.total) || 0;
  if (total < 0) return { success: false, error: "Invalid total" };
  const sheet  = ensureSalesSheet();
  const saleId = 'S-' + Date.now();
  const now    = new Date();
  sheet.appendRow([saleId, now, data.shiftDate || '', data.shift || '',
    data.cashier, data.customer || '', data.items, total,
    data.method || 'cash', Number(data.amountPaid) || total, data.jobId || '', 'paid']);
  items.forEach(function(item) {
    if (item.sku) {
      try {
        adjustStock({ sku: item.sku, qty: Math.abs(Number(item.qty) || 1), type: 'remove',
          reason: 'Sale ' + saleId, updatedBy: data.cashier });
      } catch(e) { console.warn('Inventory deduct error for ' + item.sku + ':', e); }
    }
  });
  auditLog('SALE_CREATE', data.cashier + ' | ' + saleId + ' | BZ$' + total.toFixed(2));
  return { success: true, saleId };
}

function reverseSale(data) {
  if (!data.saleId) return { success: false, error: "SaleID required" };
  const sheet = ensureSalesSheet();
  const colA  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = colA.indexOf(String(data.saleId)) + 1;
  if (row <= 1) return { success: false, error: "Sale not found" };
  sheet.getRange(row, 12).setValue('reversed');
  auditLog('SALE_REVERSE', (data.cashier || 'Unknown') + ' | ' + data.saleId + ' | Reason: ' + (data.reason || 'No reason given'));
  return { success: true };
}

function updateSale(data) {
  if (!data.saleId) return { success: false, error: "SaleID required" };
  const sheet = ensureSalesSheet();
  const colA  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = colA.indexOf(String(data.saleId)) + 1;
  if (row <= 1) return { success: false, error: "Sale not found" };
  if (data.customer !== undefined) sheet.getRange(row, 6).setValue(data.customer);
  if (data.items    !== undefined) sheet.getRange(row, 7).setValue(data.items);
  if (data.total    !== undefined) sheet.getRange(row, 8).setValue(Number(data.total));
  return { success: true };
}

// ── PAYOUTS ───────────────────────────────────────────────────────────────────
function ensurePayoutsSheet() {
  let sheet = getSheet(PAYOUTS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(PAYOUTS_SHEET);
    sheet.appendRow(["PayoutID","Timestamp","ShiftDate","Shift","LoggedBy","TakenBy","Amount","Reason"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getPayouts(data) {
  const sheet = ensurePayoutsSheet();
  if (sheet.getLastRow() < 2) return [];
  const tz         = Session.getScriptTimeZone();
  const filterDate = data.date || '';
  const filterFrom = data.from || '';
  const filterTo   = data.to   || '';
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    payoutId:  String(r[0] || ''),
    timestamp: r[1] instanceof Date ? r[1].toISOString() : r[1],
    shiftDate: r[2] instanceof Date ? Utilities.formatDate(r[2], tz, 'yyyy-MM-dd') : String(r[2] || '').slice(0, 10),
    shift: r[3], loggedBy: r[4], takenBy: r[5],
    amount: Number(r[6]) || 0, reason: r[7]
  })).filter(p => {
    if (!p.payoutId) return false;
    if (filterDate) return p.shiftDate === filterDate;
    if (filterFrom && filterTo) return p.shiftDate >= filterFrom && p.shiftDate <= filterTo;
    return true;
  });
}

function createPayout(data) {
  if (!data.amount || !data.reason) return { success: false, error: "Amount and reason required" };
  if (Number(data.amount) <= 0) return { success: false, error: "Amount must be positive" };
  const sheet    = ensurePayoutsSheet();
  const payoutId = 'P-' + Date.now();
  sheet.appendRow([payoutId, new Date(), data.shiftDate || '', data.shift || '',
    data.loggedBy || 'Unknown', data.takenBy || '', Number(data.amount), data.reason]);
  auditLog('PAYOUT_CREATE', (data.loggedBy || 'Unknown') + ' | ' + payoutId + ' | BZ$' + Number(data.amount).toFixed(2) + ' | ' + data.reason);
  notify('manageronly', '💸 Payout Logged',
    (data.loggedBy || 'Cashier') + ' logged a BZ$' + Number(data.amount).toFixed(2) + ' payout: ' + data.reason);
  return { success: true, payoutId };
}

// ── BILLS ─────────────────────────────────────────────────────────────────────
function ensureBillsSheet() {
  let sheet = getSheet(BILLS_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(BILLS_SHEET);
    sheet.appendRow(["BillID","CreatedAt","ShiftDate","PersonName","Items","TotalOwed","TotalPaid","Status","Cashier"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getBills() {
  const sheet = ensureBillsSheet();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    billId: String(r[0] || ''), createdAt: r[1] instanceof Date ? r[1].toISOString() : r[1],
    shiftDate: r[2], personName: r[3], items: r[4],
    totalOwed: Number(r[5]) || 0, totalPaid: Number(r[6]) || 0,
    status: r[7] || 'open', cashier: r[8]
  })).filter(b => b.billId);
}

function createBill(data) {
  if (!data.personName || !data.items) return { success: false, error: "Person name and items required" };
  let items;
  try { items = JSON.parse(data.items); } catch(e) { return { success: false, error: "Invalid items data" }; }
  if (!Array.isArray(items) || !items.length) return { success: false, error: "At least one item required" };
  const sheet  = ensureBillsSheet();
  const billId = 'B-' + Date.now();
  sheet.appendRow([billId, new Date(), data.shiftDate || '', data.personName,
    data.items, Number(data.totalOwed) || 0, 0, 'open', data.cashier || 'Unknown']);
  return { success: true, billId };
}

function settleBill(data) {
  if (!data.billId || !data.amount) return { success: false, error: "BillID and amount required" };
  const sheet = ensureBillsSheet();
  const colA  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = colA.indexOf(String(data.billId)) + 1;
  if (row <= 1) return { success: false, error: "Bill not found" };
  const rowVals    = sheet.getRange(row, 1, 1, 9).getValues()[0];
  const totalOwed  = Number(rowVals[5]) || 0;
  const prevPaid   = Number(rowVals[6]) || 0;
  const newPaid    = prevPaid + (Number(data.amount) || 0);
  const isFullyPaid = newPaid >= totalOwed - 0.01;
  sheet.getRange(row, 7).setValue(newPaid);
  sheet.getRange(row, 8).setValue(isFullyPaid ? 'settled' : 'open');
  const saleResult = createSale({
    cashier: data.cashier || 'Unknown', customer: rowVals[3],
    items: JSON.stringify([{ name: 'Bill settlement — ' + rowVals[3], qty: 1, price: Number(data.amount), total: Number(data.amount) }]),
    total: Number(data.amount), method: data.payMethod || 'cash',
    amountPaid: Number(data.amount), shiftDate: data.shiftDate || ''
  });
  return { success: true, fullySettled: isFullyPaid, saleId: saleResult.saleId };
}

function updateBill(data) {
  if (!data.billId) return { success: false, error: "BillID required" };
  const sheet = ensureBillsSheet();
  const colA  = sheet.getRange("A:A").getValues().flat().map(String);
  const row   = colA.indexOf(String(data.billId)) + 1;
  if (row <= 1) return { success: false, error: "Bill not found" };
  if (data.personName !== undefined) sheet.getRange(row, 4).setValue(data.personName);
  if (data.items      !== undefined) sheet.getRange(row, 5).setValue(data.items);
  if (data.totalOwed  !== undefined) sheet.getRange(row, 6).setValue(Number(data.totalOwed) || 0);
  return { success: true };
}

// ── DAY CLOSE ─────────────────────────────────────────────────────────────────
function ensureDayCloseSheet() {
  let sheet = getSheet(DAYCLOSE_SHEET);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(DAYCLOSE_SHEET);
    sheet.appendRow(["CloseID","Timestamp","ShiftDate","Shift","ClosedBy","GrossSales","TotalPayouts","NetExpected","ActualDrawer","Variance"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function submitDayClose(data) {
  const sheet    = ensureDayCloseSheet();
  const closeId  = 'DC-' + Date.now();
  const variance = Number(data.variance) || 0;
  sheet.appendRow([closeId, new Date(), data.shiftDate || '', data.shift || '',
    data.closedBy || 'Unknown', Number(data.grossSales) || 0,
    Number(data.totalPayouts) || 0, Number(data.netExpected) || 0,
    Number(data.actualDrawer) || 0, variance]);
  if (variance < -0.01) {
    notify('manageronly', '⚠️ Cashier Short',
      (data.closedBy || 'Cashier') + ' is short BZ$' + Math.abs(variance).toFixed(2) + ' on ' + (data.shiftDate || 'today') + '.');
  }
  return { success: true, closeId };
}

function getDayCloses(data) {
  const sheet = ensureDayCloseSheet();
  if (sheet.getLastRow() < 2) return [];
  const tz         = Session.getScriptTimeZone();
  const filterDate = data.date || '';
  const filterFrom = data.from || '';
  const filterTo   = data.to   || '';
  return sheet.getDataRange().getValues().slice(1).map(r => ({
    closeId:      String(r[0] || ''),
    timestamp:    r[1] instanceof Date ? r[1].toISOString() : r[1],
    shiftDate:    r[2] instanceof Date ? Utilities.formatDate(r[2], tz, 'yyyy-MM-dd') : String(r[2] || '').slice(0, 10),
    shift:        r[3], closedBy: r[4],
    grossSales:   Number(r[5]) || 0, totalPayouts: Number(r[6]) || 0,
    netExpected:  Number(r[7]) || 0, actualDrawer: Number(r[8]) || 0,
    variance:     Number(r[9]) || 0
  })).filter(c => {
    if (!c.closeId) return false;
    if (filterDate) return c.shiftDate === filterDate;
    if (filterFrom && filterTo) return c.shiftDate >= filterFrom && c.shiftDate <= filterTo;
    return true;
  });
}

// ── STALE JOB CHECKER ─────────────────────────────────────────────────────────
function checkStaleJobsScheduled() {
  const STALE_DAYS = 3;
  const STALE_MS   = STALE_DAYS * 24 * 60 * 60 * 1000;
  const SKIP       = ['abandoned', 'unsuccessful', 'resolved', 'ready'];
  const todayKey   = new Date().toISOString().slice(0, 10);
  const now        = Date.now();
  const props      = PropertiesService.getScriptProperties();
  const trackerKey = 'stale_checked_' + todayKey;
  let checked      = {};
  try { checked = JSON.parse(props.getProperty(trackerKey) || '{}'); } catch (_) {}
  const jobs = getJobs();
  let fired  = 0;
  jobs.forEach(function(j) {
    if (SKIP.includes((j.status || '').toLowerCase())) return;
    const d1 = j.dateReceived  ? new Date(j.dateReceived).getTime()  : 0;
    const d2 = j.dateCompleted ? new Date(j.dateCompleted).getTime() : 0;
    const lastUpdated = Math.max(d1, d2);
    if (!lastUpdated || (now - lastUpdated) < STALE_MS) return;
    const key = String(j.id);
    if (checked[key]) return;
    notify('jobstatus', '⏰ Job #' + j.id + ' needs attention',
      (j.device || 'Device') + ' for ' + (j.customerName || 'customer') +
      ' hasn\'t been updated in ' + STALE_DAYS + '+ days.');
    checked[key] = true;
    fired++;
  });
  props.setProperty(trackerKey, JSON.stringify(checked));
  const allKeys = props.getKeys();
  allKeys.forEach(function(k) {
    if (k.startsWith('stale_checked_') && k < 'stale_checked_' + todayKey) {
      try { props.deleteProperty(k); } catch (_) {}
    }
  });
  console.log('checkStaleJobsScheduled: ' + fired + ' stale alert(s) queued.');
}

// ── DRIVE IMAGE UPLOAD ────────────────────────────────────────────────────────
const INSPECTIONS_FOLDER_ID = '1LWcfxrcKXgwXxCsYJm6my9R2vdAck9hk';

function uploadInspectionImage(data) {
  if (!data.repairId || !data.imageData || !data.mimeType) {
    return { success: false, error: 'Missing repairId, imageData, or mimeType' };
  }
  try {
    const parent     = DriveApp.getFolderById(INSPECTIONS_FOLDER_ID);
    const folderName = 'Job-#' + data.repairId;
    let jobFolder;
    const existing = parent.getFoldersByName(folderName);
    if (existing.hasNext()) {
      jobFolder = existing.next();
    } else {
      jobFolder = parent.createFolder(folderName);
    }
    const imageIndex = data.imageIndex || '1';
    const ext        = data.mimeType.split('/')[1] || 'jpg';
    const fileName   = 'inspection-' + imageIndex + '.' + ext;
    const blob       = Utilities.newBlob(
      Utilities.base64Decode(data.imageData.replace(/^data:[^;]+;base64,/, '')),
      data.mimeType,
      fileName
    );
    const file = jobFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';
    const sheet = getSheet(JOBS_SHEET);
    const rows  = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1]) === String(data.repairId)) {
        const current = String(sheet.getRange(i + 1, 18).getValue() || '');
        const updated = current ? current + ',' + fileUrl : fileUrl;
        sheet.getRange(i + 1, 18).setValue(updated);
        break;
      }
    }
    return { success: true, url: fileUrl };
  } catch (e) {
    console.error('uploadInspectionImage error:', e);
    return { success: false, error: e.toString() };
  }
}

// ── Run this ONCE to authorize Drive access ───────────────────────────────────
function authorizeDrive() {
  DriveApp.getFolderById('1LWcfxrcKXgwXxCsYJm6my9R2vdAck9hk');
  Logger.log('Drive access authorized.');
}
