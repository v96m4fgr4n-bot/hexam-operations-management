/**
 * Trips sheet: TripId | TripDate | ClientId | ClientName | Destination |
 * OneWayDistanceKm | RoundTripDistanceKm |
 * FuelPricePerLitre | FuelConsumptionKmPerL | FuelRatePerKm | FuelCost |
 * TollFee | ZrpFee | VidFee | OtherFeesDescription | OtherFeesAmount | TripExpenses |
 * Subtotal | MarginPercent | MarginAmount |
 * OrderType | BrickQuantity | BrickPricePer1000 | BrickCost |
 * LoadBringerId | LoadBringerName | LoadLevyAmount |
 * TotalBeforeDiscount | DiscountAmount | DiscountReason | TotalCost |
 * Notes | CreatedAt
 *
 * Quote build-up (all client-facing pricing derives from Settings, never
 * from a client-submitted number):
 *   fuelRatePerKm       = fuelPricePerLitre / fuelConsumptionKmPerL
 *   fuelCost            = roundTripDistanceKm x fuelRatePerKm
 *   tripExpenses        = tollFee + zrpFee + vidFee + otherFeesAmount
 *   subtotal            = fuelCost + tripExpenses
 *   marginAmount        = subtotal x (companyMarginPercent / 100)
 *   brickCost           = (brickQuantity / 1000) x Settings' BRICK_PRICE_PER_1000,
 *                         IF orderType is 'Transport + Bricks', else 0 - billed
 *                         at its set price, margin is not re-applied to it
 *   loadLevyAmount      = Settings' LOAD_LEVY_AMOUNT if a load bringer is
 *                         named for this trip, else 0 - baked into the
 *                         client's total (the client covers the referral
 *                         payout), not absorbed by the company
 *   totalBeforeDiscount = subtotal + marginAmount + brickCost + loadLevyAmount
 *   totalCost           = totalBeforeDiscount - discountAmount   <- the quote given to the client
 *
 * Net profit per trip (see AccountingService.gs/DashboardService.gs/
 * TrendsService.gs) is marginAmount + brickCost - discountAmount, since
 * brickCost has no tracked cost-of-goods to net against (only its client
 * sell price), and loadLevyAmount/fuelCost/tripExpenses are real costs
 * already excluded from that figure.
 */

var ORDER_TYPES = ['Delivery Only', 'Transport + Bricks'];

/**
 * Computes the full quote breakdown. Always re-reads fuel price, fuel
 * consumption, margin, load levy, and brick price from Settings server-side
 * so a stale client-side value can never be submitted as truth. Does not
 * persist anything.
 *
 * input: { oneWayDistanceKm, tollFee, zrpFee, vidFee, otherFeesAmount,
 *          orderType, brickQuantity, loadBringerName, discountAmount, discountReason }
 */
function computeTripQuote_(input) {
  input = input || {};
  var settings = getSettings();

  var oneWayDistanceKm = validatePositiveNumber_(input.oneWayDistanceKm, 'Distance');
  var tollFee = validateNonNegativeNumber_(input.tollFee !== undefined ? input.tollFee : settings.defaultTollFee, 'Toll fee');
  var zrpFee = validateNonNegativeNumber_(input.zrpFee !== undefined ? input.zrpFee : settings.defaultZrpFee, 'ZRP fee');
  var vidFee = validateNonNegativeNumber_(input.vidFee !== undefined ? input.vidFee : settings.defaultVidFee, 'VID fee');
  var otherFeesAmount = validateNonNegativeNumber_(input.otherFeesAmount || 0, 'Other fees');

  if (!(settings.fuelConsumptionKmPerL > 0)) {
    throw new Error('Fuel consumption (km per litre) must be set to a positive number in Settings before quoting a trip.');
  }

  var roundTripDistanceKm = round2_(oneWayDistanceKm * 2);
  var fuelRatePerKm = round2_(settings.fuelPricePerLitre / settings.fuelConsumptionKmPerL);
  var fuelCost = round2_(roundTripDistanceKm * fuelRatePerKm);
  var tripExpenses = round2_(tollFee + zrpFee + vidFee + otherFeesAmount);
  var subtotal = round2_(fuelCost + tripExpenses);
  var marginAmount = round2_(subtotal * settings.companyMarginPercent / 100);

  var orderType = ORDER_TYPES.indexOf(input.orderType) !== -1 ? input.orderType : 'Delivery Only';
  var brickQuantity = 0;
  var brickCost = 0;
  if (orderType === 'Transport + Bricks') {
    brickQuantity = validatePositiveNumber_(input.brickQuantity, 'Number of bricks');
    brickCost = round2_((brickQuantity / 1000) * settings.brickPricePer1000);
  }

  // Freehand-typed, like the client - resolved to an actual record (and
  // created if new) only at save time, never here, so previewing a quote
  // can't create a load bringer as a side effect.
  var loadBringerName = String(input.loadBringerName || '').trim();
  var loadLevyAmount = loadBringerName ? settings.loadLevyAmount : 0;

  var totalBeforeDiscount = round2_(subtotal + marginAmount + brickCost + loadLevyAmount);

  var discountAmount = validateNonNegativeNumber_(input.discountAmount || 0, 'Discount');
  if (discountAmount > totalBeforeDiscount) {
    throw new Error('Discount cannot be more than the quote total.');
  }
  var discountReason = String(input.discountReason || '').trim();

  var totalCost = round2_(totalBeforeDiscount - discountAmount);

  return {
    oneWayDistanceKm: oneWayDistanceKm,
    roundTripDistanceKm: roundTripDistanceKm,
    fuelPricePerLitre: settings.fuelPricePerLitre,
    fuelConsumptionKmPerL: settings.fuelConsumptionKmPerL,
    fuelRatePerKm: fuelRatePerKm,
    fuelCost: fuelCost,
    tollFee: tollFee,
    zrpFee: zrpFee,
    vidFee: vidFee,
    otherFeesAmount: otherFeesAmount,
    tripExpenses: tripExpenses,
    subtotal: subtotal,
    marginPercent: settings.companyMarginPercent,
    marginAmount: marginAmount,
    orderType: orderType,
    brickQuantity: brickQuantity,
    brickPricePer1000: settings.brickPricePer1000,
    brickCost: brickCost,
    loadBringerName: loadBringerName,
    loadLevyAmount: loadLevyAmount,
    totalBeforeDiscount: totalBeforeDiscount,
    discountAmount: discountAmount,
    discountReason: discountReason,
    totalCost: totalCost,
    currencySymbol: settings.currencySymbol
  };
}

/** Client-callable: live quote preview, nothing persisted. */
function getTripQuote(input) {
  return computeTripQuote_(input);
}

/**
 * Validates, computes, and persists a trip record. The client is entered
 * freehand (name + phone) rather than picked from a pre-existing list -
 * findOrCreateClient_ reuses a matching active client or creates a new one.
 * The load bringer name is freehand too (optional) - findOrCreateLoadBringer_
 * resolves/creates it the same way, but only once the quote is computed, so
 * a preview never creates either record as a side effect.
 *
 * tripInput: { clientName, clientPhone, destination, oneWayDistanceKm,
 *              tollFee, zrpFee, vidFee, otherFeesDescription, otherFeesAmount,
 *              loadBringerName, discountAmount, discountReason, notes }
 */
function saveTrip(tripInput) {
  tripInput = tripInput || {};

  var client = findOrCreateClient_(tripInput.clientName, tripInput.clientPhone);
  var clientId = client.id;
  var destination = validateNonEmptyString_(tripInput.destination, 'Destination');
  var otherFeesDescription = String(tripInput.otherFeesDescription || '').trim();
  var notes = String(tripInput.notes || '').trim();

  var quote = computeTripQuote_(tripInput);

  var loadBringerId = '';
  if (quote.loadBringerName) {
    var bringer = findOrCreateLoadBringer_(quote.loadBringerName);
    loadBringerId = bringer.id;
    quote.loadBringerName = bringer.name;
  }

  var sheet = getSpreadsheet_().getSheetByName('Trips');
  var id = generateId_('trip');
  var now = new Date();

  sheet.appendRow([
    id, now, clientId, client.name, destination,
    quote.oneWayDistanceKm, quote.roundTripDistanceKm,
    quote.fuelPricePerLitre, quote.fuelConsumptionKmPerL, quote.fuelRatePerKm, quote.fuelCost,
    quote.tollFee, quote.zrpFee, quote.vidFee, otherFeesDescription, quote.otherFeesAmount, quote.tripExpenses,
    quote.subtotal, quote.marginPercent, quote.marginAmount,
    quote.orderType, quote.brickQuantity, quote.brickPricePer1000, quote.brickCost,
    loadBringerId, quote.loadBringerName, quote.loadLevyAmount,
    quote.totalBeforeDiscount, quote.discountAmount, quote.discountReason, quote.totalCost,
    notes, now
  ]);

  logAudit_('CREATE', 'Trip', id, 'Quoted trip for ' + client.name + ' to ' + destination + ' (' + quote.currencySymbol + quote.totalCost.toFixed(2) + ')');

  return {
    success: true,
    trip: tripRowToObject_({
      TripId: id, TripDate: now, ClientId: clientId, ClientName: client.name, Destination: destination,
      OneWayDistanceKm: quote.oneWayDistanceKm, RoundTripDistanceKm: quote.roundTripDistanceKm,
      FuelPricePerLitre: quote.fuelPricePerLitre, FuelConsumptionKmPerL: quote.fuelConsumptionKmPerL,
      FuelRatePerKm: quote.fuelRatePerKm, FuelCost: quote.fuelCost,
      TollFee: quote.tollFee, ZrpFee: quote.zrpFee, VidFee: quote.vidFee,
      OtherFeesDescription: otherFeesDescription, OtherFeesAmount: quote.otherFeesAmount,
      TripExpenses: quote.tripExpenses, Subtotal: quote.subtotal,
      MarginPercent: quote.marginPercent, MarginAmount: quote.marginAmount,
      OrderType: quote.orderType, BrickQuantity: quote.brickQuantity,
      BrickPricePer1000: quote.brickPricePer1000, BrickCost: quote.brickCost,
      LoadBringerId: loadBringerId, LoadBringerName: quote.loadBringerName, LoadLevyAmount: quote.loadLevyAmount,
      TotalBeforeDiscount: quote.totalBeforeDiscount, DiscountAmount: quote.discountAmount,
      DiscountReason: quote.discountReason, TotalCost: quote.totalCost,
      Notes: notes, CreatedAt: now
    })
  };
}

function tripRowToObject_(row) {
  return {
    tripId: row.TripId,
    tripDate: row.TripDate,
    clientId: row.ClientId,
    clientName: row.ClientName,
    destination: row.Destination,
    oneWayDistanceKm: Number(row.OneWayDistanceKm),
    roundTripDistanceKm: Number(row.RoundTripDistanceKm),
    fuelPricePerLitre: Number(row.FuelPricePerLitre),
    fuelConsumptionKmPerL: Number(row.FuelConsumptionKmPerL),
    fuelRatePerKm: Number(row.FuelRatePerKm),
    fuelCost: Number(row.FuelCost),
    tollFee: Number(row.TollFee),
    zrpFee: Number(row.ZrpFee),
    vidFee: Number(row.VidFee),
    otherFeesDescription: row.OtherFeesDescription || '',
    otherFeesAmount: Number(row.OtherFeesAmount) || 0,
    tripExpenses: Number(row.TripExpenses),
    subtotal: Number(row.Subtotal),
    marginPercent: Number(row.MarginPercent),
    marginAmount: Number(row.MarginAmount),
    orderType: row.OrderType || 'Delivery Only',
    brickQuantity: Number(row.BrickQuantity) || 0,
    brickPricePer1000: Number(row.BrickPricePer1000) || 0,
    brickCost: Number(row.BrickCost) || 0,
    loadBringerId: row.LoadBringerId || '',
    loadBringerName: row.LoadBringerName || '',
    loadLevyAmount: Number(row.LoadLevyAmount) || 0,
    totalBeforeDiscount: Number(row.TotalBeforeDiscount),
    discountAmount: Number(row.DiscountAmount) || 0,
    discountReason: row.DiscountReason || '',
    totalCost: Number(row.TotalCost),
    notes: row.Notes || '',
    createdAt: row.CreatedAt
  };
}

/**
 * options: { clientId, limit }
 * Returns trips newest first.
 */
function getTrips(options) {
  options = options || {};
  var sheet = getSpreadsheet_().getSheetByName('Trips');
  var rows = sheetToObjects_(sheet).map(tripRowToObject_);

  if (options.clientId) {
    rows = rows.filter(function (t) { return t.clientId === options.clientId; });
  }

  rows.sort(function (a, b) { return new Date(b.tripDate) - new Date(a.tripDate); });

  if (options.limit) {
    rows = rows.slice(0, options.limit);
  }

  return rows;
}
