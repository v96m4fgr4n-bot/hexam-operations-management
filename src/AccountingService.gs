/**
 * Derives income/expense totals from Trips (there is no separate ledger to
 * maintain by hand for trip-level numbers - every saved trip already
 * carries its own income and real costs) plus manually-recorded business
 * expenses from the Expenses sheet (repairs, insurance, salaries, etc. -
 * see ExpenseService.gs), which trips have no way to capture on their own.
 *
 * Net profit per trip works out to marginAmount + brickCost - discountAmount:
 * the load levy is a pass-through (charged to the client, paid out to the
 * bringer), every other real trip cost is subtracted back out here, and
 * brick revenue has no tracked cost-of-goods to net against (only its
 * client sell price), so it falls straight to profit. Manual expenses are
 * then subtracted on top for the true business net profit.
 */
function getAccountingSummary() {
  var trips = getTrips({});
  var expenses = getExpenses({});

  var summary = {
    tripCount: trips.length,
    totalIncome: 0,
    totalFuelExpense: 0,
    totalTripExpenses: 0,
    totalBrickRevenue: 0,
    totalLoadLevyPaid: 0,
    totalDiscountsGiven: 0,
    totalManualExpenses: 0,
    currencySymbol: getSettings().currencySymbol
  };

  trips.forEach(function (t) {
    summary.totalIncome = round2_(summary.totalIncome + t.totalCost);
    summary.totalFuelExpense = round2_(summary.totalFuelExpense + t.fuelCost);
    summary.totalTripExpenses = round2_(summary.totalTripExpenses + t.tripExpenses);
    summary.totalBrickRevenue = round2_(summary.totalBrickRevenue + t.brickCost);
    summary.totalLoadLevyPaid = round2_(summary.totalLoadLevyPaid + t.loadLevyAmount);
    summary.totalDiscountsGiven = round2_(summary.totalDiscountsGiven + t.discountAmount);
  });

  var byCategory = {};
  expenses.forEach(function (e) {
    summary.totalManualExpenses = round2_(summary.totalManualExpenses + e.amount);
    byCategory[e.category] = round2_((byCategory[e.category] || 0) + e.amount);
  });

  summary.expensesByCategory = Object.keys(byCategory)
    .map(function (category) { return { category: category, total: byCategory[category] }; })
    .sort(function (a, b) { return b.total - a.total; });

  summary.totalExpenses = round2_(
    summary.totalFuelExpense + summary.totalTripExpenses + summary.totalLoadLevyPaid + summary.totalManualExpenses
  );
  summary.netProfit = round2_(summary.totalIncome - summary.totalExpenses);

  return summary;
}
