/**
 * LoadBringers sheet: LoadBringerId | Name | Phone | Active | CreatedAt
 *
 * A load bringer is someone paid a load levy (see Settings: LOAD_LEVY_AMOUNT)
 * on the spot for referring a load/client on a trip. The levy is baked into
 * that trip's client-facing total (see TripService.gs). getLoadBringerSummary()
 * below is a running record of what's been paid to each bringer, for
 * reference - not an outstanding balance, since payment already happened at
 * the time of the trip. Never hard-deleted (Trips reference LoadBringerId) -
 * deactivateLoadBringer just flips Active to false, and reactivateLoadBringer
 * flips it back.
 */

function loadBringerRowToObject_(row) {
  return {
    id: row.LoadBringerId,
    name: row.Name,
    phone: row.Phone || '',
    active: row.Active === true || row.Active === 'TRUE',
    createdAt: row.CreatedAt
  };
}

function getLoadBringers(includeInactive) {
  var sheet = getSpreadsheet_().getSheetByName('LoadBringers');
  var rows = sheetToObjects_(sheet).map(loadBringerRowToObject_);
  if (!includeInactive) {
    rows = rows.filter(function (b) { return b.active; });
  }
  return rows;
}

function getLoadBringer(loadBringerId) {
  var bringers = getLoadBringers(true);
  for (var i = 0; i < bringers.length; i++) {
    if (bringers[i].id === loadBringerId) return bringers[i];
  }
  return null;
}

function addLoadBringer(data) {
  data = data || {};
  var name = validateNonEmptyString_(data.name, 'Load bringer name');

  var sheet = getSpreadsheet_().getSheetByName('LoadBringers');
  var id = generateId_('bringer');
  var now = new Date();

  sheet.appendRow([id, name, data.phone || '', true, now]);

  logAudit_('CREATE', 'LoadBringer', id, 'Added load bringer ' + name);
  return { success: true, loadBringer: getLoadBringer(id) };
}

function updateLoadBringer(loadBringerId, data) {
  validateNonEmptyString_(loadBringerId, 'Load bringer id');
  data = data || {};

  var sheet = getSpreadsheet_().getSheetByName('LoadBringers');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('LoadBringerId');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === loadBringerId) {
      var rowNum = r + 1;
      if (data.name !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('Name') + 1)
          .setValue(validateNonEmptyString_(data.name, 'Load bringer name'));
      }
      if (data.phone !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('Phone') + 1).setValue(data.phone);
      }
      logAudit_('UPDATE', 'LoadBringer', loadBringerId, 'Updated load bringer ' + (data.name || rows[r][headers.indexOf('Name')]));
      return { success: true, loadBringer: getLoadBringer(loadBringerId) };
    }
  }

  throw new Error('Load bringer not found: ' + loadBringerId);
}

function setLoadBringerActive_(loadBringerId, active) {
  validateNonEmptyString_(loadBringerId, 'Load bringer id');
  var sheet = getSpreadsheet_().getSheetByName('LoadBringers');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('LoadBringerId');
  var activeCol = headers.indexOf('Active');
  var nameCol = headers.indexOf('Name');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === loadBringerId) {
      sheet.getRange(r + 1, activeCol + 1).setValue(active);
      logAudit_(active ? 'REACTIVATE' : 'DEACTIVATE', 'LoadBringer', loadBringerId, (active ? 'Reactivated' : 'Deactivated') + ' load bringer ' + rows[r][nameCol]);
      return { success: true };
    }
  }

  throw new Error('Load bringer not found: ' + loadBringerId);
}

function deactivateLoadBringer(loadBringerId) {
  return setLoadBringerActive_(loadBringerId, false);
}

function reactivateLoadBringer(loadBringerId) {
  return setLoadBringerActive_(loadBringerId, true);
}

/**
 * Resolves a freehand name typed on the New Trip screen to a load bringer -
 * reusing an existing active bringer on an exact (case-insensitive) name
 * match, or creating a new one. Mirrors findOrCreateClient_ in
 * ClientService.gs. Only called from saveTrip, never from the quote preview
 * (computeTripQuote_ works off the raw typed name so previewing a trip
 * never creates a bringer record as a side effect).
 */
function findOrCreateLoadBringer_(name) {
  name = validateNonEmptyString_(name, 'Load bringer name');

  var existing = getLoadBringers(false).filter(function (b) {
    return b.name.trim().toLowerCase() === name.trim().toLowerCase();
  })[0];
  if (existing) return existing;

  return addLoadBringer({ name: name }).loadBringer;
}

/**
 * Client-callable: every load bringer (active and inactive) with a running
 * tally of loads brought and total levy paid, derived from Trips. Load
 * bringers are paid on the spot per load, not batched - this is a
 * historical record of what's gone out to each person, not an outstanding
 * balance.
 */
function getLoadBringerSummary() {
  var bringers = getLoadBringers(true);
  var totals = {};
  bringers.forEach(function (b) {
    totals[b.id] = { tripCount: 0, totalPaid: 0 };
  });

  getTrips({}).forEach(function (trip) {
    if (!trip.loadBringerId || !totals[trip.loadBringerId]) return;
    totals[trip.loadBringerId].tripCount += 1;
    totals[trip.loadBringerId].totalPaid = round2_(totals[trip.loadBringerId].totalPaid + trip.loadLevyAmount);
  });

  return bringers
    .map(function (b) {
      return {
        id: b.id,
        name: b.name,
        phone: b.phone,
        active: b.active,
        tripCount: totals[b.id].tripCount,
        totalPaid: totals[b.id].totalPaid
      };
    })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
}
