/**
 * Web app entry point. Standalone script - the backing spreadsheet is
 * resolved by ID (see Utils.gs / Setup.gs), not by container binding.
 */
function doGet(e) {
  initializeSpreadsheet();

  if (e && e.parameter && e.parameter.debug === 'rpctest') {
    return HtmlService.createHtmlOutput(RPC_TEST_HTML_)
      .setTitle('RPC test')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

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

/**
 * TEMPORARY - a minimal, standalone page (none of the app's other code
 * or concurrent calls) for isolating the Fleet/driver google.script.run
 * hang. Test 1 fires a single getDrivers() call alone. Test 2 fires
 * getTrucks/getTrailers/getDrivers simultaneously, exactly like Fleet's
 * loadFleet() does, to test whether firing multiple calls at once is
 * the trigger. Each row shows a live elapsed timer and the raw
 * success/failure result. Remove once the root cause is found.
 */
var RPC_TEST_HTML_ = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<style>body{font-family:-apple-system,sans-serif;padding:16px;font-size:15px;}' +
  '.row{margin-bottom:16px;padding:12px;border:1px solid #ccc;border-radius:8px;}' +
  '.row.pending{background:#fff8e1;}.row.ok{background:#e6f7ea;}.row.fail{background:#fde8e8;}' +
  'pre{white-space:pre-wrap;word-break:break-all;font-size:12px;}button{padding:10px 16px;font-size:15px;margin-bottom:16px;}</style>' +
  '</head><body>' +
  '<h3>RPC isolation test</h3>' +
  '<button onclick="runAll()">Run tests</button>' +
  '<div class="row pending" id="row-single"><strong>Test 1: getDrivers() alone</strong><div id="status-single">Not started</div><pre id="out-single"></pre></div>' +
  '<div class="row pending" id="row-trucks"><strong>Test 2a: getTrucks() (fired with 2b, 2c)</strong><div id="status-trucks">Not started</div><pre id="out-trucks"></pre></div>' +
  '<div class="row pending" id="row-trailers"><strong>Test 2b: getTrailers() (fired with 2a, 2c)</strong><div id="status-trailers">Not started</div><pre id="out-trailers"></pre></div>' +
  '<div class="row pending" id="row-drivers3"><strong>Test 2c: getDrivers() (fired with 2a, 2b)</strong><div id="status-drivers3">Not started</div><pre id="out-drivers3"></pre></div>' +
  '<script>' +
  'function track(rowId, statusId, outId, label, fn) {' +
  '  var start = Date.now();' +
  '  var row = document.getElementById(rowId);' +
  '  var status = document.getElementById(statusId);' +
  '  var out = document.getElementById(outId);' +
  '  var timer = setInterval(function () {' +
  '    status.textContent = "Waiting... " + Math.round((Date.now() - start) / 1000) + "s";' +
  '  }, 500);' +
  '  google.script.run' +
  '    .withSuccessHandler(function (result) {' +
  '      clearInterval(timer);' +
  '      row.className = "row ok";' +
  '      status.textContent = "SUCCESS after " + Math.round((Date.now() - start) / 1000) + "s";' +
  '      out.textContent = JSON.stringify(result, null, 2);' +
  '    })' +
  '    .withFailureHandler(function (err) {' +
  '      clearInterval(timer);' +
  '      row.className = "row fail";' +
  '      status.textContent = "FAILED after " + Math.round((Date.now() - start) / 1000) + "s";' +
  '      out.textContent = err.message || String(err);' +
  '    })[fn]();' +
  '}' +
  'function runAll() {' +
  '  track("row-single", "status-single", "out-single", "getDrivers");' +
  '  setTimeout(function () {' +
  '    track("row-trucks", "status-trucks", "out-trucks", "getTrucks");' +
  '    track("row-trailers", "status-trailers", "out-trailers", "getTrailers");' +
  '    track("row-drivers3", "status-drivers3", "out-drivers3", "getDrivers");' +
  '  }, 3000);' +
  '}' +
  '</script></body></html>';
