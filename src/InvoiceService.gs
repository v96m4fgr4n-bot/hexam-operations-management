/**
 * Generates a branded PDF invoice for a saved trip. Built entirely in code
 * (no template file in Drive to maintain) via DocumentApp: a temporary
 * Google Doc is created, populated, exported as PDF bytes, and immediately
 * trashed - only the PDF is handed back to the browser.
 *
 * brandedDocHeader_() is factored out so other branded documents/reports
 * can reuse the same logo-and-title header without duplicating the
 * UrlFetchApp/fallback logic.
 */

var BRAND_LOGO_URL = 'https://hexhamexpress.com/img/hexham-bricks-logo-navy.png';
var BRAND_NAME = 'Hexham Bricks';

/**
 * Appends the shared branded header (logo, falling back to a text
 * wordmark if the fetch fails for any reason) plus a document title line.
 */
function brandedDocHeader_(body, docTitle) {
  var logoInserted = false;
  try {
    var response = UrlFetchApp.fetch(BRAND_LOGO_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var img = body.appendImage(response.getBlob());
      var originalWidth = img.getWidth();
      var originalHeight = img.getHeight();
      var targetWidth = 160;
      img.setWidth(targetWidth);
      img.setHeight(Math.round(originalHeight * (targetWidth / originalWidth)));
      logoInserted = true;
    }
  } catch (err) {
    logoInserted = false;
  }

  if (!logoInserted) {
    var wordmark = body.appendParagraph(BRAND_NAME.toUpperCase());
    wordmark.setFontSize(20).setBold(true).setForegroundColor('#0D1E2C');
  }

  var title = body.appendParagraph(docTitle);
  title.setFontSize(16).setBold(true).setSpacingBefore(10).setSpacingAfter(14);
}

function boldRow_(table, rowIndex) {
  var row = table.getRow(rowIndex);
  for (var c = 0; c < row.getNumCells(); c++) {
    row.getCell(c).editAsText().setBold(true);
  }
}

function invoiceNumber_(trip) {
  var tz = Session.getScriptTimeZone();
  var datePart = Utilities.formatDate(new Date(trip.tripDate), tz, 'yyyyMMdd');
  var shortId = String(trip.tripId).replace('trip_', '').split('-')[0].toUpperCase();
  return 'INV-' + datePart + '-' + shortId;
}

/** Builds the invoice as a temporary Doc and returns the PDF as a Blob. */
function buildTripInvoicePdf_(trip) {
  var symbol = getSettings().currencySymbol;
  var doc = DocumentApp.create('Invoice ' + invoiceNumber_(trip));
  var body = doc.getBody();
  body.setMarginTop(40).setMarginBottom(40).setMarginLeft(50).setMarginRight(50);

  brandedDocHeader_(body, 'TAX INVOICE');

  var meta = body.appendTable([
    ['Invoice #', invoiceNumber_(trip)],
    ['Date', new Date(trip.tripDate).toDateString()],
    ['Bill To', trip.clientName],
    ['Destination', trip.destination]
  ]);
  for (var m = 0; m < meta.getNumRows(); m++) {
    meta.getRow(m).getCell(0).editAsText().setBold(true);
  }

  body.appendParagraph('').setSpacingAfter(4);

  var rows = [['Description', 'Amount']];
  rows.push(['Fuel (' + trip.roundTripDistanceKm.toFixed(1) + ' km round trip)', formatCurrency_(trip.fuelCost, symbol)]);
  if (trip.tollFee > 0) rows.push(['Toll fee', formatCurrency_(trip.tollFee, symbol)]);
  if (trip.zrpFee > 0) rows.push(['ZRP fee', formatCurrency_(trip.zrpFee, symbol)]);
  if (trip.vidFee > 0) rows.push(['VID fee', formatCurrency_(trip.vidFee, symbol)]);
  if (trip.otherFeesAmount > 0) rows.push([trip.otherFeesDescription || 'Other fee', formatCurrency_(trip.otherFeesAmount, symbol)]);
  rows.push(['Service charge', formatCurrency_(trip.marginAmount, symbol)]);
  if (trip.orderType === 'Transport + Bricks') {
    rows.push([
      'Bricks (' + trip.brickQuantity + ' @ ' + formatCurrency_(trip.brickPricePer1000, symbol) + '/1000)',
      formatCurrency_(trip.brickCost, symbol)
    ]);
  }
  if (trip.loadLevyAmount > 0) rows.push(['Referral fee', formatCurrency_(trip.loadLevyAmount, symbol)]);
  if (trip.discountAmount > 0) {
    rows.push(['Discount' + (trip.discountReason ? ' (' + trip.discountReason + ')' : ''), '-' + formatCurrency_(trip.discountAmount, symbol)]);
  }
  rows.push(['TOTAL', formatCurrency_(trip.totalCost, symbol)]);

  var table = body.appendTable(rows);
  boldRow_(table, 0);
  boldRow_(table, table.getNumRows() - 1);

  if (trip.notes) {
    body.appendParagraph('Notes: ' + trip.notes).setItalic(true).setSpacingBefore(14);
  }

  body.appendParagraph('Thank you for your business.')
    .setSpacingBefore(24).setFontSize(9).setForegroundColor('#7B8899');

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdfBlob;
}

/**
 * Client-callable: returns a base64-encoded PDF for the browser to decode
 * and download (google.script.run doesn't hand back a directly-downloadable
 * Blob, so the client reconstructs one from this).
 */
function downloadTripInvoice(tripId) {
  validateNonEmptyString_(tripId, 'Trip id');
  var trip = getTrips({}).filter(function (t) { return t.tripId === tripId; })[0];
  if (!trip) {
    throw new Error('Trip not found: ' + tripId);
  }

  var pdfBlob = buildTripInvoicePdf_(trip);
  var base64 = Utilities.base64Encode(pdfBlob.getBytes());

  logAudit_('EXPORT', 'Trip', tripId, 'Downloaded invoice for ' + trip.clientName);

  return {
    fileName: invoiceNumber_(trip) + '.pdf',
    base64: base64,
    mimeType: 'application/pdf'
  };
}
