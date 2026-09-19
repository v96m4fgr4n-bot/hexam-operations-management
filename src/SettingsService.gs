/**
 * Settings sheet is a simple key-value table: Key | Value | Description | LastUpdated
 */

var SETTINGS_KEY_MAP = {
  fuelRatePerKm: 'FUEL_RATE_PER_KM',
  defaultTollFee: 'DEFAULT_TOLL_FEE',
  defaultZrpFee: 'DEFAULT_ZRP_FEE',
  defaultVidFee: 'DEFAULT_VID_FEE',
  currencySymbol: 'CURRENCY_SYMBOL'
};

/**
 * Returns current settings as a plain object with camelCase keys for use
 * by the client and by TripService.
 */
function getSettings() {
  var sheet = getSpreadsheet_().getSheetByName('Settings');
  var rows = sheetToObjects_(sheet);
  var byKey = {};
  rows.forEach(function (row) {
    byKey[row.Key] = row.Value;
  });

  return {
    fuelRatePerKm: Number(byKey.FUEL_RATE_PER_KM) || 0,
    defaultTollFee: Number(byKey.DEFAULT_TOLL_FEE) || 0,
    defaultZrpFee: Number(byKey.DEFAULT_ZRP_FEE) || 0,
    defaultVidFee: Number(byKey.DEFAULT_VID_FEE) || 0,
    currencySymbol: byKey.CURRENCY_SYMBOL || '$'
  };
}

/**
 * Updates one or more settings. newValues uses the same camelCase keys
 * returned by getSettings(), e.g. { fuelRatePerKm: 0.6, currencySymbol: "R" }.
 */
function updateSettings(newValues) {
  newValues = newValues || {};
  var sheet = getSpreadsheet_().getSheetByName('Settings');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var keyCol = headers.indexOf('Key');
  var valueCol = headers.indexOf('Value');
  var updatedCol = headers.indexOf('LastUpdated');
  var now = new Date();

  Object.keys(newValues).forEach(function (camelKey) {
    var sheetKey = SETTINGS_KEY_MAP[camelKey];
    if (!sheetKey) {
      throw new Error('Unknown setting: ' + camelKey);
    }

    var value = newValues[camelKey];
    if (camelKey === 'currencySymbol') {
      value = validateNonEmptyString_(value, 'Currency symbol');
    } else {
      value = validateNonNegativeNumber_(value, camelKey);
    }

    for (var r = 1; r < data.length; r++) {
      if (data[r][keyCol] === sheetKey) {
        sheet.getRange(r + 1, valueCol + 1).setValue(value);
        sheet.getRange(r + 1, updatedCol + 1).setValue(now);
        break;
      }
    }
  });

  return { success: true, settings: getSettings() };
}
