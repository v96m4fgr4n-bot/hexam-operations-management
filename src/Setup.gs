/**
 * One-time bootstrap. Runs automatically on every doGet(), and is also safe
 * to run manually from the Apps Script editor's function dropdown (select
 * initializeSpreadsheet, click Run). Idempotent: only creates sheets that
 * don't exist, and only adds Settings keys that aren't already present -
 * it never overwrites a value someone has already edited.
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
    'OneWayDistanceKm', 'RoundTripDistanceKm',
    'FuelPricePerLitre', 'FuelConsumptionLPerKm', 'FuelRatePerKm', 'FuelCost',
    'TollFee', 'ZrpFee', 'VidFee', 'OtherFeesDescription', 'OtherFeesAmount', 'TripExpenses',
    'Subtotal', 'MarginPercent', 'MarginAmount', 'TotalCost',
    'Notes', 'CreatedAt'
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

/**
 * Adds any Settings key that isn't already present, and drops keys that are
 * no longer used (e.g. a flat FUEL_RATE_PER_KM from before fuel rate was
 * derived from price-per-litre x consumption). Never touches the value of a
 * key that's already there and still in use.
 */
function seedDefaultSettings_(sheet) {
  var defaults = [
    ['FUEL_PRICE_PER_LITRE', 1.5, 'Cost of fuel per litre'],
    ['FUEL_CONSUMPTION_L_PER_KM', 0.4, 'Truck fuel consumption in litres per km (round-trip), used to derive the fuel rate per km'],
    ['DEFAULT_TOLL_FEE', 0, 'Default toll fee applied to a new trip'],
    ['DEFAULT_ZRP_FEE', 0, 'Default ZRP fee applied to a new trip'],
    ['DEFAULT_VID_FEE', 0, 'Default VID fee applied to a new trip'],
    ['COMPANY_MARGIN_PERCENT', 15, 'Margin percentage applied on top of fuel cost + trip expenses to produce the client quote'],
    ['CURRENCY_SYMBOL', '$', 'Currency symbol used for display only']
  ];
  var obsoleteKeys = { FUEL_RATE_PER_KM: true };

  var lastRow = sheet.getLastRow();
  var existing = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
  var kept = existing.filter(function (row) { return row[0] && !obsoleteKeys[row[0]]; });
  var keptKeys = {};
  kept.forEach(function (row) { keptKeys[row[0]] = true; });

  var now = new Date();
  var toAdd = defaults
    .filter(function (d) { return !keptKeys[d[0]]; })
    .map(function (d) { return [d[0], d[1], d[2], now]; });

  var finalRows = kept.concat(toAdd);

  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
  }
  if (finalRows.length) {
    sheet.getRange(2, 1, finalRows.length, 4).setValues(finalRows);
  }
}
