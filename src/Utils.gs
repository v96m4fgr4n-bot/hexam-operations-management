/**
 * Shared helpers used across all service files.
 */

var SPREADSHEET_ID_PROPERTY = 'SPREADSHEET_ID';

// Set this to a Google Sheets spreadsheet ID to pre-wire the app to a specific
// sheet on first run, instead of auto-creating one. Leave blank to auto-create.
// Can also be set per-deployment via a SPREADSHEET_ID script property, which
// takes priority over this constant (Project Settings > Script Properties).
var DEFAULT_SPREADSHEET_ID = '1Opv1xha3S5EvYPYmQDbRr90bEGAvBqbebvfJuvtLGKA';

/**
 * Returns the Spreadsheet backing this app, resolved via the script property
 * set by Setup.gs's initializeSpreadsheet(). Throws a clear error if setup
 * hasn't been run yet, rather than failing deep inside a service call.
 */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);
  if (!id) {
    throw new Error(
      'No spreadsheet is configured yet. Open this project in the Apps Script editor and run ' +
      'the initializeSpreadsheet function once from the Setup.gs file.'
    );
  }
  return SpreadsheetApp.openById(id);
}

function generateId_(prefix) {
  return prefix + '_' + Utilities.getUuid();
}

function round2_(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function formatCurrency_(num, symbol) {
  var amount = round2_(num).toFixed(2);
  return (symbol || '') + amount;
}

function validateNonNegativeNumber_(value, fieldName) {
  var num = Number(value);
  if (!isFinite(num) || isNaN(num) || num < 0) {
    throw new Error(fieldName + ' must be a number that is zero or greater.');
  }
  return num;
}

function validatePositiveNumber_(value, fieldName) {
  var num = Number(value);
  if (!isFinite(num) || isNaN(num) || num <= 0) {
    throw new Error(fieldName + ' must be a number greater than zero.');
  }
  return num;
}

function validateNonEmptyString_(value, fieldName) {
  var str = (value === null || value === undefined) ? '' : String(value).trim();
  if (!str) {
    throw new Error(fieldName + ' is required.');
  }
  return str;
}

/**
 * Converts a sheet's rows into an array of plain objects keyed by header row.
 */
function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1);
  return rows.map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) {
      obj[header] = row[i];
    });
    return obj;
  });
}
