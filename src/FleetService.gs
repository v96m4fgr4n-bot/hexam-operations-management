/**
 * Trucks sheet:   TruckId | RegNumber | RoadworthyExpiry | NextServiceDue | Status | CreatedAt
 * Trailers sheet: TrailerId | RegNumber | RoadworthyExpiry | NextServiceDue | Status | CreatedAt
 * Drivers sheet:  DriverId | Name | Phone | AssignedTruckId | Active | CreatedAt
 *
 * Status is one of 'Active', 'In Repair', 'Offline' for trucks/trailers.
 * A driver's truck assignment lives on the Driver record (AssignedTruckId)
 * - trucks don't store a driver id, getTrucks() derives it by looking for
 * the active driver (if any) whose AssignedTruckId matches.
 */

var FLEET_STATUSES = ['Active', 'In Repair', 'Offline'];

/**
 * How urgent a roadworthy/service date is: 'expired' (past due), 'due-soon'
 * (within 14 days), 'ok', or '' if no date is set.
 */
function dateStatus_(dateValue) {
  if (!dateValue) return '';
  var date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var diffDays = Math.floor((date - today) / 86400000);

  if (diffDays < 0) return 'expired';
  if (diffDays <= 14) return 'due-soon';
  return 'ok';
}

function validateFleetStatus_(status) {
  var s = validateNonEmptyString_(status, 'Status');
  if (FLEET_STATUSES.indexOf(s) === -1) {
    throw new Error('Status must be one of: ' + FLEET_STATUSES.join(', '));
  }
  return s;
}

/* ---------- Trucks ---------- */

function truckRowToObject_(row) {
  return {
    id: row.TruckId,
    regNumber: row.RegNumber,
    roadworthyExpiry: row.RoadworthyExpiry || '',
    nextServiceDue: row.NextServiceDue || '',
    status: row.Status || 'Active',
    createdAt: row.CreatedAt
  };
}

function getTrucks() {
  var sheet = getSpreadsheet_().getSheetByName('Trucks');
  var trucks = sheetToObjects_(sheet).map(truckRowToObject_);
  var drivers = getDrivers(false);

  trucks.forEach(function (t) {
    t.roadworthyStatus = dateStatus_(t.roadworthyExpiry);
    t.serviceStatus = dateStatus_(t.nextServiceDue);
    var assigned = drivers.filter(function (d) { return d.assignedTruckId === t.id; })[0];
    t.assignedDriverId = assigned ? assigned.id : '';
    t.assignedDriverName = assigned ? assigned.name : '';
  });

  return trucks;
}

function getTruck(truckId) {
  return getTrucks().filter(function (t) { return t.id === truckId; })[0] || null;
}

function addTruck(data) {
  data = data || {};
  var regNumber = validateNonEmptyString_(data.regNumber, 'Registration number');
  var status = validateFleetStatus_(data.status || 'Active');

  var sheet = getSpreadsheet_().getSheetByName('Trucks');
  var id = generateId_('truck');
  sheet.appendRow([id, regNumber, data.roadworthyExpiry || '', data.nextServiceDue || '', status, new Date()]);

  logAudit_('CREATE', 'Truck', id, 'Added truck ' + regNumber);
  return { success: true, truck: getTruck(id) };
}

function updateTruck(truckId, data) {
  validateNonEmptyString_(truckId, 'Truck id');
  data = data || {};

  var sheet = getSpreadsheet_().getSheetByName('Trucks');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('TruckId');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === truckId) {
      var rowNum = r + 1;
      if (data.regNumber !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('RegNumber') + 1).setValue(validateNonEmptyString_(data.regNumber, 'Registration number'));
      }
      if (data.roadworthyExpiry !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('RoadworthyExpiry') + 1).setValue(data.roadworthyExpiry);
      }
      if (data.nextServiceDue !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('NextServiceDue') + 1).setValue(data.nextServiceDue);
      }
      if (data.status !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('Status') + 1).setValue(validateFleetStatus_(data.status));
      }
      logAudit_('UPDATE', 'Truck', truckId, 'Updated truck ' + (data.regNumber || rows[r][headers.indexOf('RegNumber')]) + (data.status ? ' (status: ' + data.status + ')' : ''));
      return { success: true, truck: getTruck(truckId) };
    }
  }

  throw new Error('Truck not found: ' + truckId);
}

/* ---------- Trailers ---------- */

function trailerRowToObject_(row) {
  return {
    id: row.TrailerId,
    regNumber: row.RegNumber,
    roadworthyExpiry: row.RoadworthyExpiry || '',
    nextServiceDue: row.NextServiceDue || '',
    status: row.Status || 'Active',
    createdAt: row.CreatedAt
  };
}

function getTrailers() {
  var sheet = getSpreadsheet_().getSheetByName('Trailers');
  var trailers = sheetToObjects_(sheet).map(trailerRowToObject_);
  trailers.forEach(function (t) {
    t.roadworthyStatus = dateStatus_(t.roadworthyExpiry);
    t.serviceStatus = dateStatus_(t.nextServiceDue);
  });
  return trailers;
}

function getTrailer(trailerId) {
  return getTrailers().filter(function (t) { return t.id === trailerId; })[0] || null;
}

function addTrailer(data) {
  data = data || {};
  var regNumber = validateNonEmptyString_(data.regNumber, 'Registration number');
  var status = validateFleetStatus_(data.status || 'Active');

  var sheet = getSpreadsheet_().getSheetByName('Trailers');
  var id = generateId_('trailer');
  sheet.appendRow([id, regNumber, data.roadworthyExpiry || '', data.nextServiceDue || '', status, new Date()]);

  logAudit_('CREATE', 'Trailer', id, 'Added trailer ' + regNumber);
  return { success: true, trailer: getTrailer(id) };
}

function updateTrailer(trailerId, data) {
  validateNonEmptyString_(trailerId, 'Trailer id');
  data = data || {};

  var sheet = getSpreadsheet_().getSheetByName('Trailers');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('TrailerId');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === trailerId) {
      var rowNum = r + 1;
      if (data.regNumber !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('RegNumber') + 1).setValue(validateNonEmptyString_(data.regNumber, 'Registration number'));
      }
      if (data.roadworthyExpiry !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('RoadworthyExpiry') + 1).setValue(data.roadworthyExpiry);
      }
      if (data.nextServiceDue !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('NextServiceDue') + 1).setValue(data.nextServiceDue);
      }
      if (data.status !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('Status') + 1).setValue(validateFleetStatus_(data.status));
      }
      logAudit_('UPDATE', 'Trailer', trailerId, 'Updated trailer ' + (data.regNumber || rows[r][headers.indexOf('RegNumber')]) + (data.status ? ' (status: ' + data.status + ')' : ''));
      return { success: true, trailer: getTrailer(trailerId) };
    }
  }

  throw new Error('Trailer not found: ' + trailerId);
}

/* ---------- Drivers ---------- */

function driverRowToObject_(row) {
  return {
    id: row.DriverId,
    name: row.Name,
    phone: row.Phone || '',
    assignedTruckId: row.AssignedTruckId || '',
    active: row.Active === true || row.Active === 'TRUE',
    createdAt: row.CreatedAt
  };
}

function getDrivers(includeInactive) {
  var sheet = getSpreadsheet_().getSheetByName('Drivers');
  var rows = sheetToObjects_(sheet).map(driverRowToObject_);
  if (!includeInactive) {
    rows = rows.filter(function (d) { return d.active; });
  }
  return rows;
}

function getDriver(driverId) {
  var drivers = getDrivers(true);
  for (var i = 0; i < drivers.length; i++) {
    if (drivers[i].id === driverId) return drivers[i];
  }
  return null;
}

/** Throws if truckId is already assigned to a different active driver. */
function validateTruckAssignment_(truckId, excludeDriverId) {
  if (!truckId) return;
  var conflict = getDrivers(false).filter(function (d) {
    return d.assignedTruckId === truckId && d.id !== excludeDriverId;
  })[0];
  if (conflict) {
    throw new Error('That truck is already assigned to ' + conflict.name + '. Unassign them first.');
  }
}

function addDriver(data) {
  data = data || {};
  var name = validateNonEmptyString_(data.name, 'Driver name');
  var assignedTruckId = String(data.assignedTruckId || '').trim();
  validateTruckAssignment_(assignedTruckId, null);

  var sheet = getSpreadsheet_().getSheetByName('Drivers');
  var id = generateId_('driver');
  sheet.appendRow([id, name, data.phone || '', assignedTruckId, true, new Date()]);

  logAudit_('CREATE', 'Driver', id, 'Added driver ' + name);
  return { success: true, driver: getDriver(id) };
}

function updateDriver(driverId, data) {
  validateNonEmptyString_(driverId, 'Driver id');
  data = data || {};

  if (data.assignedTruckId !== undefined) {
    validateTruckAssignment_(String(data.assignedTruckId || '').trim(), driverId);
  }

  var sheet = getSpreadsheet_().getSheetByName('Drivers');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('DriverId');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === driverId) {
      var rowNum = r + 1;
      if (data.name !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('Name') + 1).setValue(validateNonEmptyString_(data.name, 'Driver name'));
      }
      if (data.phone !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('Phone') + 1).setValue(data.phone);
      }
      if (data.assignedTruckId !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('AssignedTruckId') + 1).setValue(String(data.assignedTruckId || '').trim());
      }
      logAudit_('UPDATE', 'Driver', driverId, 'Updated driver ' + (data.name || rows[r][headers.indexOf('Name')]));
      return { success: true, driver: getDriver(driverId) };
    }
  }

  throw new Error('Driver not found: ' + driverId);
}

function setDriverActive_(driverId, active) {
  validateNonEmptyString_(driverId, 'Driver id');
  var sheet = getSpreadsheet_().getSheetByName('Drivers');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('DriverId');
  var activeCol = headers.indexOf('Active');
  var nameCol = headers.indexOf('Name');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === driverId) {
      sheet.getRange(r + 1, activeCol + 1).setValue(active);
      logAudit_(active ? 'REACTIVATE' : 'DEACTIVATE', 'Driver', driverId, (active ? 'Reactivated' : 'Deactivated') + ' driver ' + rows[r][nameCol]);
      return { success: true };
    }
  }

  throw new Error('Driver not found: ' + driverId);
}

function deactivateDriver(driverId) {
  return setDriverActive_(driverId, false);
}

function reactivateDriver(driverId) {
  return setDriverActive_(driverId, true);
}
