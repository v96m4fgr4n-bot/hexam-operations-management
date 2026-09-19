/**
 * One-time bootstrap. Run this manually from the Apps Script editor's
 * function dropdown (select initializeSpreadsheet, click Run) before using
 * the web app for the first time. Safe to re-run: it only creates sheets
 * or seeds settings that don't already exist.
 */
function initializeSpreadsheet() {
  var ss = getOrCreateSpreadsheet_();

  var settingsSheet = ensureSheetWithHeaders_(ss, 'Settings', ['Key', 'Value', 'Description', 'LastUpdated']);
  seedDefaultSettings_(settingsSheet);

  ensureSheetWithHeaders_(ss, 'Clients', [
    'ClientId', 'ClientName', 'ContactPerson', 'Phone', 'Email', 'Address', 'Active', 'CreatedAt'
  ]);

  ensureSheetWithHeaders_(ss, 'Trips', [
    'TripId', 'TripDate', 'ClientId', 'ClientName', 'Destination',
    'OneWayDistanceKm', 'RoundTripDistanceKm', 'FuelRatePerKm', 'FuelCost',
    'TollFee', 'ZrpFee', 'VidFee', 'OtherFeesDescription', 'OtherFeesAmount',
    'TotalMiscFees', 'TotalCost', 'Notes', 'CreatedAt'
  ]);

  // Remove the default blank "Sheet1" if it's still there and unused.
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    var isEmpty = defaultSheet.getDataRange().getValues().join('') === '';
    if (isEmpty) ss.deleteSheet(defaultSheet);
  }

  Logger.log('Spreadsheet ready: ' + ss.getUrl());
  return ss.getUrl();
}

/**
 * Returns the spreadsheet backing this app, creating it (and storing its ID
 * in script properties) if this is the very first run.
 */
function getOrCreateSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(SPREADSHEET_ID_PROPERTY);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      // Stored ID is stale (e.g. file was deleted) - fall through and try the default.
    }
  }

  if (DEFAULT_SPREADSHEET_ID) {
    try {
      var defaultSs = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
      props.setProperty(SPREADSHEET_ID_PROPERTY, defaultSs.getId());
      return defaultSs;
    } catch (err) {
      // Default ID isn't accessible - fall through and create a new one.
    }
  }

  var ss = SpreadsheetApp.create('Hexam Bricks Operations Data');
  props.setProperty(SPREADSHEET_ID_PROPERTY, ss.getId());
  return ss;
}

function ensureSheetWithHeaders_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var hasHeaders = headers.every(function (h, i) { return firstRow[i] === h; });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedDefaultSettings_(sheet) {
  if (sheet.getLastRow() > 1) return; // already seeded

  var now = new Date();
  var defaults = [
    ['FUEL_RATE_PER_KM', 0.5, 'Fuel cost per km, applied to round-trip distance', now],
    ['DEFAULT_TOLL_FEE', 0, 'Default toll fee applied to a new trip', now],
    ['DEFAULT_ZRP_FEE', 0, 'Default ZRP fee applied to a new trip', now],
    ['DEFAULT_VID_FEE', 0, 'Default VID fee applied to a new trip', now],
    ['CURRENCY_SYMBOL', '$', 'Currency symbol used for display only', now]
  ];
  sheet.getRange(2, 1, defaults.length, 4).setValues(defaults);
}
