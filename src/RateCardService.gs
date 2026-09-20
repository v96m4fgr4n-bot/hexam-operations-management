/**
 * Branded PDF rate card: the same quote formula New Trip uses
 * (computeTripQuote_ in TripService.gs), run for a list of one-way
 * distances with no toll/ZRP/VID, load bringer, or bricks - a clean
 * delivery-only baseline a dispatcher can hand out or reference without
 * opening the app. Reuses brandedDocHeader_()/boldRow_() from
 * InvoiceService.gs rather than duplicating the PDF build-up.
 */

var DEFAULT_RATE_CARD_DISTANCES_ = [35, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 240, 270];

function parseRateCardDistances_(distancesCsv) {
  var distances;
  if (distancesCsv && String(distancesCsv).trim()) {
    distances = String(distancesCsv).split(',')
      .map(function (s) { return Number(String(s).trim()); })
      .filter(function (n) { return isFinite(n) && n > 0; });
  } else {
    distances = DEFAULT_RATE_CARD_DISTANCES_.slice();
  }
  if (!distances.length) {
    throw new Error('Enter at least one valid distance in km.');
  }
  distances.sort(function (a, b) { return a - b; });
  return distances;
}

/** Builds the rate card as a temporary Doc and returns the PDF as a Blob. */
function buildRateCardPdf_(distances) {
  var settings = getSettings();
  var symbol = settings.currencySymbol;

  var doc = DocumentApp.create('Hexam Bricks Rate Card');
  var body = doc.getBody();
  body.setMarginTop(40).setMarginBottom(40).setMarginLeft(50).setMarginRight(50);

  brandedDocHeader_(body, 'DISTANCE RATE CARD');

  body.appendParagraph(
    'Delivery-only baseline quote by one-way distance. Toll/ZRP/VID fees, a load ' +
    'bringer\'s levy, or brick cost are added on top for a specific trip.'
  ).setFontSize(9).setForegroundColor('#7B8899').setSpacingAfter(14);

  var rows = [['Distance', 'Round trip', 'Fuel cost', 'Margin', 'Quote']];
  distances.forEach(function (km) {
    var quote = computeTripQuote_({ oneWayDistanceKm: km });
    rows.push([
      km + ' km',
      quote.roundTripDistanceKm.toFixed(0) + ' km',
      formatCurrency_(quote.fuelCost, symbol),
      formatCurrency_(quote.marginAmount, symbol),
      formatCurrency_(quote.totalCost, symbol)
    ]);
  });

  var table = body.appendTable(rows);
  boldRow_(table, 0);

  body.appendParagraph(
    'Generated ' + new Date().toDateString() + '. Fuel price ' +
    formatCurrency_(settings.fuelPricePerLitre, symbol) + '/L, consumption ' +
    settings.fuelConsumptionKmPerL + ' km/L, margin ' + settings.companyMarginPercent + '%.'
  ).setFontSize(9).setForegroundColor('#7B8899').setSpacingBefore(14);

  doc.saveAndClose();

  var pdfBlob = DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF);
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdfBlob;
}

/**
 * Client-callable: returns a base64-encoded PDF for the browser to decode
 * and download. distancesCsv is an optional comma-separated list of
 * one-way km values from the Settings screen's input; blank uses
 * DEFAULT_RATE_CARD_DISTANCES_.
 */
function downloadRateCard(distancesCsv) {
  var distances = parseRateCardDistances_(distancesCsv);
  var pdfBlob = buildRateCardPdf_(distances);
  var base64 = Utilities.base64Encode(pdfBlob.getBytes());

  logAudit_('EXPORT', 'Settings', 'rate-card', 'Downloaded rate card PDF (' + distances.length + ' distance bands)');

  return {
    fileName: 'Hexam-Bricks-Rate-Card.pdf',
    base64: base64,
    mimeType: 'application/pdf'
  };
}
