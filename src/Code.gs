/**
 * Web app entry point. Standalone script - the backing spreadsheet is
 * resolved by ID (see Utils.gs / Setup.gs), not by container binding.
 */
function doGet(e) {
  initializeSpreadsheet();

  if (e && e.parameter && e.parameter.api) {
    return handleFleetApi_(e.parameter.api);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inlines another HTML file's contents at template-render time.
 * Used by Index.html scriptlets, e.g. <?!= include('CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Plain JSON GET endpoint for Fleet's read calls (trucks/trailers/drivers),
 * fetched client-side via fetch() rather than google.script.run - see
 * "Fleet loading" in JavaScript.html for why. Read-only; add/edit/
 * deactivate/reactivate stay on google.script.run.
 */
function handleFleetApi_(apiName) {
  var readers = {
    trucks: function () { return getTrucks(); },
    trailers: function () { return getTrailers(); },
    drivers: function () { return getDrivers(true); }
  };

  var body;
  if (!readers[apiName]) {
    body = { success: false, error: 'Unknown api: ' + apiName };
  } else {
    try {
      body = { success: true, data: readers[apiName]() };
    } catch (err) {
      body = { success: false, error: err.message };
    }
  }

  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
