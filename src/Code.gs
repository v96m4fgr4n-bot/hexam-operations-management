/**
 * Web app entry point. Standalone script - the backing spreadsheet is
 * resolved by ID (see Utils.gs / Setup.gs), not by container binding.
 */
function doGet(e) {
  initializeSpreadsheet();

  if (e && e.parameter && e.parameter.api) {
    return runApi_(e.parameter.api, e.parameter);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Plain JSON-over-HTTP endpoint (fetch() from the client), for read-only
 * calls that have proven unreliable over google.script.run's background-
 * call channel in the field (Fleet's truck/trailer/driver lists, New
 * Trip's driver dropdown) - a normal web request has been reliable every
 * time it's been tested, where the background-call channel intermittently
 * never resolves at all, on multiple devices/browsers/networks. Every
 * function here is read-only; writes (saveTrip, addTruck, etc.) still go
 * through google.script.run, which has not shown this problem.
 */
function runApi_(which, params) {
  var payload;
  try {
    var result;
    if (which === 'trucks') {
      result = getTrucks();
    } else if (which === 'trailers') {
      result = getTrailers();
    } else if (which === 'drivers') {
      result = getDrivers(params.includeInactive === 'true');
    } else {
      throw new Error('Unknown api target: ' + which);
    }
    payload = { success: true, data: result };
  } catch (err) {
    payload = { success: false, error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inlines another HTML file's contents at template-render time.
 * Used by Index.html scriptlets, e.g. <?!= include('CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
