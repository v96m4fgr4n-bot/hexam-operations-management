/**
 * Branded PDF rate card: the same quote formula New Trip uses
 * (computeTripQuote_ in TripService.gs), run for a list of one-way
 * distances. Bakes in an averaged $100 combined ZRP + VID + load-referral
 * fee on every distance (a typical trip incurs some mix of these; toll fee
 * and brick cost still vary too much per trip to average sensibly, so
 * those stay excluded). Reuses brandedDocHeader_()/boldRow_() from
 * InvoiceService.gs rather than duplicating the PDF build-up.
 */

var DEFAULT_RATE_CARD_DISTANCES_ = [35, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 240, 270];

// Combined average of ZRP fee + VID fee + load-referral levy baked into
// every rate card row - split so the levy uses Settings' actual
// LOAD_LEVY_AMOUNT (capped at the average total) and ZRP/VID split the
// remainder evenly, keeping each piece consistent with how
// computeTripQuote_ actually treats it (ZRP/VID are margined trip
// expenses, the load levy isn't).
var RATE_CARD_AVG_EXTRAS_TOTAL_ = 100;

function rateCardAvgExtras_(settings) {
  var loadPortion = Math.min(settings.loadLevyAmount, RATE_CARD_AVG_EXTRAS_TOTAL_);
  var remaining = round2_(RATE_CARD_AVG_EXTRAS_TOTAL_ - loadPortion);
  var zrpFee = round2_(remaining / 2);
  var vidFee = round2_(remaining - zrpFee);
  return { zrpFee: zrpFee, vidFee: vidFee, loadLevyAmount: loadPortion };
}

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

  var extras = rateCardAvgExtras_(settings);

  body.appendParagraph(
    'Quote by one-way distance, including an averaged ' + formatCurrency_(RATE_CARD_AVG_EXTRAS_TOTAL_, symbol) +
    ' combined ZRP + VID + load-referral fee per trip. Toll fee and brick cost still vary too ' +
    'much per trip to average here and are added on top for a specific trip.'
  ).setFontSize(9).setForegroundColor('#7B8899').setSpacingAfter(14);

  var rows = [['Distance', 'Round trip', 'Fuel cost', 'Fees (avg)', 'Margin', 'Quote']];
  distances.forEach(function (km) {
    var quote = computeTripQuote_({
      oneWayDistanceKm: km,
      tollFee: 0,
      zrpFee: extras.zrpFee,
      vidFee: extras.vidFee,
      loadBringerName: extras.loadLevyAmount > 0 ? 'Average referral' : ''
    });
    rows.push([
      km + ' km',
      quote.roundTripDistanceKm.toFixed(0) + ' km',
      formatCurrency_(quote.fuelCost, symbol),
      formatCurrency_(RATE_CARD_AVG_EXTRAS_TOTAL_, symbol),
      formatCurrency_(quote.marginAmount, symbol),
      formatCurrency_(quote.totalCost, symbol)
    ]);
  });

  var table = body.appendTable(rows);
  boldRow_(table, 0);

  body.appendParagraph(
    'Generated ' + new Date().toDateString() + '. Fuel price ' +
    formatCurrency_(settings.fuelPricePerLitre, symbol) + '/L, consumption ' +
    settings.fuelConsumptionKmPerL + ' km/L, margin ' + settings.companyMarginPercent + '%. ' +
    'Averaged fees split as ZRP ' + formatCurrency_(extras.zrpFee, symbol) + ' + VID ' +
    formatCurrency_(extras.vidFee, symbol) + ' + load levy ' + formatCurrency_(extras.loadLevyAmount, symbol) +
    ' (load levy from Settings, margin not applied to it).'
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
