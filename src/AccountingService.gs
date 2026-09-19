/**
 * Derives income/expense totals from Trips - there is no separate ledger to
 * maintain by hand. Every saved trip already carries its own income
 * (totalCost, what the client paid) and real costs (fuel, toll/ZRP/VID/
 * other, load levy paid out to a bringer), so the accounting view just
 * rolls those up as trips come in.
 *
 * Net profit per trip works out to marginAmount - discountAmount, since the
 * load levy is a pass-through (charged to the client, paid out to the
 * bringer) and every other cost is subtracted back out here.
 */
function getAccountingSummary() {
  var trips = getTrips({});

  var summary = {
    tripCount: trips.length,
    totalIncome: 0,
    totalFuelExpense: 0,
    totalTripExpenses: 0,
    totalLoadLevyPaid: 0,
    totalDiscountsGiven: 0,
    currencySymbol: getSettings().currencySymbol
  };

  trips.forEach(function (t) {
    summary.totalIncome = round2_(summary.totalIncome + t.totalCost);
    summary.totalFuelExpense = round2_(summary.totalFuelExpense + t.fuelCost);
    summary.totalTripExpenses = round2_(summary.totalTripExpenses + t.tripExpenses);
    summary.totalLoadLevyPaid = round2_(summary.totalLoadLevyPaid + t.loadLevyAmount);
    summary.totalDiscountsGiven = round2_(summary.totalDiscountsGiven + t.discountAmount);
  });

  summary.totalExpenses = round2_(
    summary.totalFuelExpense + summary.totalTripExpenses + summary.totalLoadLevyPaid
  );
  summary.netProfit = round2_(summary.totalIncome - summary.totalExpenses);

  return summary;
}
