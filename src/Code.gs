/**
 * Hexam Bricks — Operations Management (Trip Costing MVP)
 *
 * Total cost = fuel cost + toll fee + ZRP fee + VID fee (+ optional other fee).
 * Fuel cost = round-trip distance (one-way km x 2) x FuelRatePerKm.
 * Toll/ZRP/VID fees default from the Settings sheet but can be overridden
 * per trip. Every fee component is rounded to cents individually (using
 * integer-cent arithmetic for the sum) so the line items always add up
 * exactly to the displayed total.
 *
 * Every save recomputes the full cost server-side from Settings and raw
 * inputs only — client-submitted cost fields are never read or trusted.
 */

var SETTINGS_SHEET_NAME = 'Settings';
var CLIENTS_SHEET_NAME = 'Clients';
var TRIPS_SHEET_NAME = 'Trips';

var CLIENTS_HEADERS = ['Client ID', 'Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Active'];

var TRIPS_HEADERS = [
  'Trip ID', 'Timestamp', 'Client ID', 'Client Name', 'Destination',
  'One-Way Distance (km)', 'Round-Trip Distance (km)', 'Fuel Rate/km',
  'Fuel Cost', 'Toll Fee', 'ZRP Fee', 'VID Fee', 'Other Fee Label',
  'Other Fee Amount', 'Total Cost', 'Notes'
];

var SETTINGS_ROWS = [
  ['FuelRatePerKm', 0.5, 'Fuel cost per km, applied to round-trip distance'],
  ['CurrencySymbol', '$', 'Symbol shown next to all costs (display only)'],
  ['DefaultTollFee', 0, 'Default toll fee per trip (editable per trip)'],
  ['DefaultZrpFee', 0, 'Default ZRP fee per trip (editable per trip)'],
  ['DefaultVidFee', 0, 'Default VID fee per trip (editable per trip)']
];

var SETTINGS_NUMERIC_KEYS = ['FuelRatePerKm', 'DefaultTollFee', 'DefaultZrpFee', 'DefaultVidFee'];

function doGet() {
  ensureSheetsExist_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks - Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Hexam Ops')
    .addItem('Initialize sheets', 'setupSheets')
    .addToUi();
}

/** Manual entry point (Hexam Ops menu) — same idempotent setup doGet() runs automatically. */
function setupSheets() {
  ensureSheetsExist_();
}

/** Creates Settings/Clients/Trips with headers/defaults if missing. Safe to call repeatedly. */
function ensureSheetsExist_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var settings = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settings) {
    settings = ss.insertSheet(SETTINGS_SHEET_NAME);
    settings.appendRow(['Key', 'Value', 'Notes']);
    settings.getRange(2, 1, SETTINGS_ROWS.length, 3).setValues(SETTINGS_ROWS);
    settings.setFrozenRows(1);
    settings.autoResizeColumns(1, 3);
  }

  var clients = ss.getSheetByName(CLIENTS_SHEET_NAME);
  if (!clients) {
    clients = ss.insertSheet(CLIENTS_SHEET_NAME);
    clients.appendRow(CLIENTS_HEADERS);
    clients.setFrozenRows(1);
    clients.autoResizeColumns(1, CLIENTS_HEADERS.length);
  }

  var trips = ss.getSheetByName(TRIPS_SHEET_NAME);
  if (!trips) {
    trips = ss.insertSheet(TRIPS_SHEET_NAME);
    trips.appendRow(TRIPS_HEADERS);
    trips.setFrozenRows(1);
    trips.autoResizeColumns(1, TRIPS_HEADERS.length);
  }

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 3 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}

/* ---------- Settings ---------- */

function getSettings_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Settings sheet not found. Run "Hexam Ops > Initialize sheets" first.');
  }

  var lastRow = sheet.getLastRow();
  var rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
  var settings = {};
  rows.forEach(function (row) {
    var key = row[0];
    if (key) settings[key] = row[1];
  });

  SETTINGS_NUMERIC_KEYS.forEach(function (key) {
    var num = Number(settings[key]);
    if (!(key in settings) || isNaN(num)) {
      throw new Error('Settings sheet is missing a valid numeric value for "' + key + '".');
    }
    settings[key] = num;
  });

  if (!settings.CurrencySymbol) settings.CurrencySymbol = '$';

  return settings;
}

/** Client-callable: current settings, for the Settings screen and to prefill New Trip. */
function getSettings() {
  return getSettings_();
}

/** Client-callable: persist new settings. Validates before writing. */
function updateSettings(rawInput) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Settings sheet not found. Run "Hexam Ops > Initialize sheets" first.');
  }

  var updates = {
    FuelRatePerKm: requirePositiveNumber_(rawInput.FuelRatePerKm, 'Fuel rate per km'),
    DefaultTollFee: requireNonNegativeNumber_(rawInput.DefaultTollFee, 'Default toll fee'),
    DefaultZrpFee: requireNonNegativeNumber_(rawInput.DefaultZrpFee, 'Default ZRP fee'),
    DefaultVidFee: requireNonNegativeNumber_(rawInput.DefaultVidFee, 'Default VID fee'),
    CurrencySymbol: requireShortString_(rawInput.CurrencySymbol, 'Currency symbol', 5)
  };

  var lastRow = sheet.getLastRow();
  var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  keys.forEach(function (row, i) {
    var key = row[0];
    if (key in updates) {
      sheet.getRange(2 + i, 2).setValue(updates[key]);
    }
  });

  return getSettings_();
}

/* ---------- Clients ---------- */

function getClientsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CLIENTS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Clients sheet not found. Run "Hexam Ops > Initialize sheets" first.');
  }
  return sheet;
}

function readClients_() {
  var sheet = getClientsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, CLIENTS_HEADERS.length).getValues();
  return rows.map(function (row, i) {
    return {
      rowIndex: i + 2,
      clientId: row[0],
      name: row[1],
      contactPerson: row[2],
      phone: row[3],
      email: row[4],
      address: row[5],
      active: row[6] === true || row[6] === 'TRUE'
    };
  });
}

/** Client-callable: every client (active and inactive), for the Clients screen. */
function getAllClients() {
  return readClients_().sort(function (a, b) { return a.name.localeCompare(b.name); });
}

/** Client-callable: active clients only, for the New Trip dropdown. */
function getClients() {
  return readClients_()
    .filter(function (c) { return c.active; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
}

/** Client-callable: create a client. */
function createClient(rawInput) {
  var name = requireNonEmptyString_(rawInput.name, 'Client name');

  var sheet = getClientsSheet_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var clientId = Utilities.getUuid();
    sheet.appendRow([
      clientId,
      name,
      String(rawInput.contactPerson || '').trim(),
      String(rawInput.phone || '').trim(),
      String(rawInput.email || '').trim(),
      String(rawInput.address || '').trim(),
      true
    ]);
    return { clientId: clientId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Client-callable: update a client's details, and/or its Active flag
 * (soft delete — trips already referencing this client keep working).
 */
function updateClient(rawInput) {
  var clientId = requireNonEmptyString_(rawInput.clientId, 'Client ID');
  var name = requireNonEmptyString_(rawInput.name, 'Client name');
  var active = rawInput.active !== false;

  var sheet = getClientsSheet_();
  var match = readClients_().filter(function (c) { return c.clientId === clientId; })[0];
  if (!match) {
    throw new Error('Client not found.');
  }

  sheet.getRange(match.rowIndex, 2, 1, 6).setValues([[
    name,
    String(rawInput.contactPerson || '').trim(),
    String(rawInput.phone || '').trim(),
    String(rawInput.email || '').trim(),
    String(rawInput.address || '').trim(),
    active
  ]]);

  return { clientId: clientId };
}

/* ---------- Trip costing ---------- */

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function centsOf_(n) {
  return Math.round(n * 100);
}

/**
 * Recomputes trip cost server-side from raw inputs only. Fee overrides fall
 * back to the current Settings defaults when left blank. Each component is
 * rounded individually and the total is summed in integer cents, so the
 * displayed line items always add up exactly to the displayed total.
 */
function computeCost_(rawInput) {
  var settings = getSettings_();

  var clientId = requireNonEmptyString_(rawInput.clientId, 'Client');
  var client = readClients_().filter(function (c) { return c.clientId === clientId; })[0];
  if (!client) {
    throw new Error('Selected client was not found.');
  }

  var destination = String(rawInput.destination || '').trim();

  var oneWayDistanceKm = Number(rawInput.oneWayDistanceKm);
  if (!isFinite(oneWayDistanceKm) || oneWayDistanceKm <= 0) {
    throw new Error('One-way distance must be a positive number.');
  }

  var tollFee = round2_(normalizeOverride_(rawInput.tollFee, settings.DefaultTollFee));
  var zrpFee = round2_(normalizeOverride_(rawInput.zrpFee, settings.DefaultZrpFee));
  var vidFee = round2_(normalizeOverride_(rawInput.vidFee, settings.DefaultVidFee));

  var otherFeeLabel = String(rawInput.otherFeeLabel || '').trim();
  var otherFeeAmount = otherFeeLabel ? round2_(normalizeOverride_(rawInput.otherFeeAmount, 0)) : 0;

  var roundTripDistanceKm = round2_(oneWayDistanceKm * 2);
  var fuelCost = round2_(roundTripDistanceKm * settings.FuelRatePerKm);

  var totalCents = centsOf_(fuelCost) + centsOf_(tollFee) + centsOf_(zrpFee) +
    centsOf_(vidFee) + centsOf_(otherFeeAmount);

  return {
    clientId: clientId,
    clientName: client.name,
    destination: destination,
    oneWayDistanceKm: oneWayDistanceKm,
    roundTripDistanceKm: roundTripDistanceKm,
    fuelRatePerKm: settings.FuelRatePerKm,
    fuelCost: fuelCost,
    tollFee: tollFee,
    zrpFee: zrpFee,
    vidFee: vidFee,
    otherFeeLabel: otherFeeLabel,
    otherFeeAmount: otherFeeAmount,
    totalCost: totalCents / 100,
    currencySymbol: settings.CurrencySymbol,
    notes: String(rawInput.notes || '').trim()
  };
}

function normalizeOverride_(value, fallback) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return fallback;
  }
  var num = Number(value);
  if (!isFinite(num) || num < 0) {
    throw new Error('Fee overrides must be non-negative numbers.');
  }
  return num;
}

/** Client-callable: preview a cost breakdown without saving anything. */
function previewCost(rawInput) {
  return computeCost_(rawInput);
}

/** Client-callable: recompute (never trusting client cost fields) and persist a trip. */
function saveTrip(rawInput) {
  var cost = computeCost_(rawInput);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRIPS_SHEET_NAME);
    if (!sheet) {
      throw new Error('Trips sheet not found. Run "Hexam Ops > Initialize sheets" first.');
    }
    var tripId = Utilities.getUuid();
    sheet.appendRow([
      tripId,
      new Date(),
      cost.clientId,
      cost.clientName,
      cost.destination,
      cost.oneWayDistanceKm,
      cost.roundTripDistanceKm,
      cost.fuelRatePerKm,
      cost.fuelCost,
      cost.tollFee,
      cost.zrpFee,
      cost.vidFee,
      cost.otherFeeLabel,
      cost.otherFeeAmount,
      cost.totalCost,
      cost.notes
    ]);
    cost.tripId = tripId;
    return cost;
  } finally {
    lock.releaseLock();
  }
}

/** Client-callable: full trip history, newest first. */
function getTripHistory() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRIPS_SHEET_NAME);
  if (!sheet) {
    throw new Error('Trips sheet not found. Run "Hexam Ops > Initialize sheets" first.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var rows = sheet.getRange(2, 1, lastRow - 1, TRIPS_HEADERS.length).getValues();
  var settings = getSettings_();

  return rows.map(function (row) {
    return {
      tripId: row[0],
      timestamp: row[1] instanceof Date ? row[1].toISOString() : row[1],
      clientId: row[2],
      clientName: row[3],
      destination: row[4],
      oneWayDistanceKm: row[5],
      roundTripDistanceKm: row[6],
      fuelRatePerKm: row[7],
      fuelCost: row[8],
      tollFee: row[9],
      zrpFee: row[10],
      vidFee: row[11],
      otherFeeLabel: row[12],
      otherFeeAmount: row[13],
      totalCost: row[14],
      notes: row[15],
      currencySymbol: settings.CurrencySymbol
    };
  }).reverse();
}

/* ---------- Validation helpers ---------- */

function requireNonEmptyString_(value, label) {
  var s = String(value || '').trim();
  if (!s) throw new Error(label + ' is required.');
  return s;
}

function requireShortString_(value, label, maxLen) {
  var s = String(value || '').trim();
  if (!s) throw new Error(label + ' is required.');
  if (s.length > maxLen) throw new Error(label + ' must be ' + maxLen + ' characters or fewer.');
  return s;
}

function requirePositiveNumber_(value, label) {
  var num = Number(value);
  if (!isFinite(num) || num <= 0) throw new Error(label + ' must be a positive number.');
  return num;
}

function requireNonNegativeNumber_(value, label) {
  var num = Number(value);
  if (!isFinite(num) || num < 0) throw new Error(label + ' must be a non-negative number.');
  return num;
}
