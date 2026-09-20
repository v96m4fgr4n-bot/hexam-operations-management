/**
 * Web app entry point. Standalone script - the backing spreadsheet is
 * resolved by ID (see Utils.gs / Setup.gs), not by container binding.
 */
function doGet(e) {
  initializeSpreadsheet();

  if (e && e.parameter && e.parameter.debug) {
    return runDiagnostic_(e.parameter.debug);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * TEMPORARY diagnostic endpoint for tracking down the Fleet/driver
 * loading issue - visit the web app URL with ?debug=drivers (or trucks,
 * trailers, settings, sheetnames, rawdrivers) to see that function's raw
 * result or error as plain text, run with the real visiting user's
 * permissions. Remove once the underlying issue is found and fixed.
 */
function runDiagnostic_(which) {
  var output;
  try {
    var result;
    if (which === 'drivers') {
      result = getDrivers(true);
    } else if (which === 'trucks') {
      result = getTrucks();
    } else if (which === 'trailers') {
      result = getTrailers();
    } else if (which === 'settings') {
      result = getSettings();
    } else if (which === 'sheetnames') {
      result = getSpreadsheet_().getSheets().map(function (s) { return s.getName(); });
    } else if (which === 'rawdrivers') {
      var sheet = getSpreadsheet_().getSheetByName('Drivers');
      result = sheet ? sheet.getDataRange().getValues() : 'Drivers sheet not found by that exact name';
    } else if (which === 'whoami') {
      result = { email: Session.getActiveUser().getEmail(), effectiveUser: Session.getEffectiveUser().getEmail() };
    } else {
      result = 'Unknown debug target: ' + which + ' (try drivers, trucks, trailers, settings, sheetnames, rawdrivers, whoami)';
    }
    output = JSON.stringify(result, null, 2);
  } catch (err) {
    output = 'ERROR: ' + err.message + '\n\nStack:\n' + (err.stack || '(no stack)');
  }
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Inlines another HTML file's contents at template-render time.
 * Used by Index.html scriptlets, e.g. <?!= include('CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
