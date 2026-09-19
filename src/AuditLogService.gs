/**
 * AuditLog sheet: LogId | Timestamp | UserEmail | Action | EntityType | EntityId | Summary
 *
 * Every create/update/deactivate/reactivate across Clients, Load Bringers,
 * Trucks, Trailers, Drivers, Settings, and every trip saved, is logged here
 * with the signed-in user's email (available because the web app is
 * restricted to the Workspace domain, not opened to anonymous access).
 * Logging is best-effort and never blocks or fails the action it's
 * recording - a Sheets write error here is swallowed, not thrown.
 */
function logAudit_(action, entityType, entityId, summary) {
  try {
    var sheet = getSpreadsheet_().getSheetByName('AuditLog');
    if (!sheet) return;

    var email = '';
    try {
      email = Session.getActiveUser().getEmail() || '';
    } catch (err) {
      email = '';
    }

    sheet.appendRow([generateId_('log'), new Date(), email, action, entityType, entityId, summary]);
  } catch (err) {
    // Never let audit logging break the calling operation.
  }
}

/**
 * Client-callable. options: { entityType, limit }. Newest first.
 */
function getAuditLog(options) {
  options = options || {};
  var sheet = getSpreadsheet_().getSheetByName('AuditLog');
  if (!sheet) return [];

  var rows = sheetToObjects_(sheet).map(function (row) {
    return {
      id: row.LogId,
      timestamp: row.Timestamp,
      userEmail: row.UserEmail || '(unknown)',
      action: row.Action,
      entityType: row.EntityType,
      entityId: row.EntityId,
      summary: row.Summary
    };
  });

  if (options.entityType) {
    rows = rows.filter(function (r) { return r.entityType === options.entityType; });
  }

  rows.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

  if (options.limit) {
    rows = rows.slice(0, options.limit);
  }

  return rows;
}
