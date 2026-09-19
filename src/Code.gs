/**
 * Hexam Bricks — Delivery Trip Cost Calculator
 *
 * Total cost = fuel cost + toll fee + ZRP fee + VID fee (+ optional other fee).
 * Fuel cost = round-trip distance (one-way km x 2) x FuelRatePerKm.
 * Toll/ZRP/VID default from the Settings sheet but can be overridden per trip.
 *
 * Every save recomputes the full cost server-side from Settings and raw
 * inputs only — client-submitted cost fields (fuelCost, totalCost, etc.)
 * are never read or trusted.
 */

var SETTINGS_SHEET_NAME = 'Settings';
var TRIPS_SHEET_NAME = 'Trips';

var TRIPS_HEADERS = [
  'Trip ID', 'Timestamp', 'Client Name', 'One-Way Distance (km)',
  'Round-Trip Distance (km)', 'Fuel Rate/km', 'Fuel Cost',
  'Toll Fee', 'ZRP Fee', 'VID Fee', 'Other Fee Label', 'Other Fee Amount',
  'Total Cost'
];

var SETTINGS_DEFAULTS = [
  ['FuelRatePerKm', 3.5, 'Fuel cost per km, applied to round-trip distance'],
  ['DefaultTollFee', 0, 'Default toll fee per trip (editable per trip)'],
  ['DefaultZrpFee', 0, 'Default ZRP fee per trip (editable per trip)'],
  ['DefaultVidFee', 0, 'Default VID fee per trip (editable per trip)']
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks - Trip Cost Calculator')
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

/** One-time setup: creates the Settings/Trips sheets with headers/defaults if missing. */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var settings = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settings) {
    settings = ss.insertSheet(SETTINGS_SHEET_NAME);
    settings.appendRow(['Key', 'Value', 'Notes']);
    settings.getRange(2, 1, SETTINGS_DEFAULTS.length, 3).setValues(SETTINGS_DEFAULTS);
    settings.setFrozenRows(1);
    settings.autoResizeColumns(1, 3);
  }

  var trips = ss.getSheetByName(TRIPS_SHEET_NAME);
  if (!trips) {
    trips = ss.insertSheet(TRIPS_SHEET_NAME);
    trips.appendRow(TRIPS_HEADERS);
    trips.setFrozenRows(1);
    trips.autoResizeColumns(1, TRIPS_HEADERS.length);
  }
}

/** Reads the Settings sheet into a { key: number } map. */
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
    if (key) settings[key] = Number(row[1]);
  });

  ['FuelRatePerKm', 'DefaultTollFee', 'DefaultZrpFee', 'DefaultVidFee'].forEach(function (key) {
    if (!(key in settings) || isNaN(settings[key])) {
      throw new Error('Settings sheet is missing a valid numeric value for "' + key + '".');
    }
  });

  return settings;
}

/** Client-callable: current defaults, used only to prefill the form. */
function getFormDefaults() {
  return getSettings_();
}

/**
 * Recomputes trip cost server-side from raw inputs only. Fee overrides fall
 * back to the current Settings defaults when left blank.
 */
function computeCost_(rawInput) {
  var settings = getSettings_();

  var clientName = String(rawInput.clientName || '').trim();
  if (!clientName) {
    throw new Error('Client name is required.');
  }

  var oneWayDistanceKm = Number(rawInput.oneWayDistanceKm);
  if (!isFinite(oneWayDistanceKm) || oneWayDistanceKm <= 0) {
    throw new Error('One-way distance must be a positive number.');
  }

  var tollFee = normalizeOverride_(rawInput.tollFee, settings.DefaultTollFee);
  var zrpFee = normalizeOverride_(rawInput.zrpFee, settings.DefaultZrpFee);
  var vidFee = normalizeOverride_(rawInput.vidFee, settings.DefaultVidFee);

  var otherFeeLabel = String(rawInput.otherFeeLabel || '').trim();
  var otherFeeAmount = otherFeeLabel ? normalizeOverride_(rawInput.otherFeeAmount, 0) : 0;

  var roundTripDistanceKm = oneWayDistanceKm * 2;
  var fuelCost = roundTripDistanceKm * settings.FuelRatePerKm;
  var totalCost = fuelCost + tollFee + zrpFee + vidFee + otherFeeAmount;

  return {
    clientName: clientName,
    oneWayDistanceKm: oneWayDistanceKm,
    roundTripDistanceKm: roundTripDistanceKm,
    fuelRatePerKm: settings.FuelRatePerKm,
    fuelCost: fuelCost,
    tollFee: tollFee,
    zrpFee: zrpFee,
    vidFee: vidFee,
    otherFeeLabel: otherFeeLabel,
    otherFeeAmount: otherFeeAmount,
    totalCost: totalCost
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
      cost.clientName,
      cost.oneWayDistanceKm,
      cost.roundTripDistanceKm,
      cost.fuelRatePerKm,
      cost.fuelCost,
      cost.tollFee,
      cost.zrpFee,
      cost.vidFee,
      cost.otherFeeLabel,
      cost.otherFeeAmount,
      cost.totalCost
    ]);
    cost.tripId = tripId;
    return cost;
  } finally {
    lock.releaseLock();
  }
}
