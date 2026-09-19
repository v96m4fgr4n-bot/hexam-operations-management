/**
 * Expenses sheet: ExpenseId | ExpenseDate | Category | Description | Amount | CreatedBy | CreatedAt
 *
 * Manual business expenses that aren't tied to a specific trip (trip-level
 * costs - fuel, toll/ZRP/VID, load levy - are already captured on Trips
 * itself). These feed into AccountingService.gs's expense total and net
 * profit, but not into Dashboard/Trends, which stay scoped to trip margin.
 */

var EXPENSE_CATEGORIES = [
  'Vehicle Maintenance & Repairs',
  'Fuel (Bulk/Other)',
  'Insurance',
  'Licensing & Permits',
  'Salaries & Wages',
  'Tolls & Road Levies',
  'Office & Admin',
  'Bank & Transaction Fees',
  'Other'
];

/** Client-callable: the fixed category list, so the UI never hardcodes it separately. */
function getExpenseCategories() {
  return EXPENSE_CATEGORIES;
}

function expenseRowToObject_(row) {
  return {
    id: row.ExpenseId,
    date: row.ExpenseDate,
    category: row.Category,
    description: row.Description || '',
    amount: Number(row.Amount) || 0,
    createdBy: row.CreatedBy || '',
    createdAt: row.CreatedAt
  };
}

/** options: { limit } - newest first. */
function getExpenses(options) {
  options = options || {};
  var sheet = getSpreadsheet_().getSheetByName('Expenses');
  var rows = sheetToObjects_(sheet).map(expenseRowToObject_);

  rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

  if (options.limit) {
    rows = rows.slice(0, options.limit);
  }

  return rows;
}

function addExpense(data) {
  data = data || {};
  var category = validateNonEmptyString_(data.category, 'Category');
  if (EXPENSE_CATEGORIES.indexOf(category) === -1) {
    throw new Error('Category must be one of: ' + EXPENSE_CATEGORIES.join(', '));
  }
  var amount = validatePositiveNumber_(data.amount, 'Amount');
  var description = String(data.description || '').trim();
  var expenseDate = data.date ? new Date(data.date) : new Date();
  if (isNaN(expenseDate.getTime())) {
    throw new Error('Invalid date.');
  }

  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (err) {
    email = '';
  }

  var sheet = getSpreadsheet_().getSheetByName('Expenses');
  var id = generateId_('expense');
  var now = new Date();

  sheet.appendRow([id, expenseDate, category, description, amount, email, now]);
  logAudit_('CREATE', 'Expense', id, 'Added expense: ' + category + ' (' + amount + ')' + (description ? ' - ' + description : ''));

  return {
    success: true,
    expense: expenseRowToObject_({
      ExpenseId: id, ExpenseDate: expenseDate, Category: category,
      Description: description, Amount: amount, CreatedBy: email, CreatedAt: now
    })
  };
}

function deleteExpense(expenseId) {
  validateNonEmptyString_(expenseId, 'Expense id');
  var sheet = getSpreadsheet_().getSheetByName('Expenses');
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var idCol = headers.indexOf('ExpenseId');
  var categoryCol = headers.indexOf('Category');
  var amountCol = headers.indexOf('Amount');

  for (var r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === expenseId) {
      var summary = 'Deleted expense: ' + rows[r][categoryCol] + ' (' + rows[r][amountCol] + ')';
      sheet.deleteRow(r + 1);
      logAudit_('DELETE', 'Expense', expenseId, summary);
      return { success: true };
    }
  }

  throw new Error('Expense not found: ' + expenseId);
}
