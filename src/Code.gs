/**
 * Web app entry point. Standalone script - the backing spreadsheet is
 * resolved by ID (see Utils.gs / Setup.gs), not by container binding.
 */
function doGet(e) {
  // TEMPORARY - one-shot diagnostic for the "The string did not match the
  // expected pattern" error now seen on Fleet. Remove once diagnosed.
  if (e && e.parameter && e.parameter.debug === 'spreadsheetid') {
    var out;
    try {
      out = JSON.stringify(debugSpreadsheetProperty_());
    } catch (err) {
      out = JSON.stringify({ fatalError: err.message });
    }
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
  }
  if (e && e.parameter && e.parameter.debug === 'fleetcalls') {
    var out2;
    try {
      out2 = JSON.stringify(debugFleetCalls_());
    } catch (err) {
      out2 = JSON.stringify({ fatalError: err.message, stack: err.stack || null });
    }
    return ContentService.createTextOutput(out2).setMimeType(ContentService.MimeType.JSON);
  }

  initializeSpreadsheet();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Inlines another HTML file's contents at template-render time.
 * Used by Index.html scriptlets, e.g. <?!= include('CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
