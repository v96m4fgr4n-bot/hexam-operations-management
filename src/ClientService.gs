/**
 * Clients sheet: ClientId | ClientName | ContactPerson | Phone | Email | Address | Active | CreatedAt
 * Clients are never hard-deleted (Trips reference ClientId) - deactivateClient
 * just flips Active to false, and reactivateClient flips it back.
 */

function clientRowToObject_(row) {
  return {
    id: row.ClientId,
    name: row.ClientName,
    contactPerson: row.ContactPerson || '',
    phone: row.Phone || '',
    email: row.Email || '',
    address: row.Address || '',
    active: row.Active === true || row.Active === 'TRUE',
    createdAt: row.CreatedAt
  };
}

function getClients(includeInactive) {
  var sheet = getSpreadsheet_().getSheetByName('Clients');
  var rows = sheetToObjects_(sheet).map(clientRowToObject_);
  if (!includeInactive) {
    rows = rows.filter(function (c) { return c.active; });
  }
  return rows;
}

function getClient(clientId) {
  var clients = getClients(true);
  for (var i = 0; i < clients.length; i++) {
    if (clients[i].id === clientId) return clients[i];
  }
  return null;
}

function addClient(clientData) {
  clientData = clientData || {};
  var name = validateNonEmptyString_(clientData.name, 'Client name');

  var sheet = getSpreadsheet_().getSheetByName('Clients');
  var id = generateId_('client');
  var now = new Date();

  sheet.appendRow([
    id,
    name,
    clientData.contactPerson || '',
    clientData.phone || '',
    clientData.email || '',
    clientData.address || '',
    true,
    now
  ]);

  return { success: true, client: getClient(id) };
}

function updateClient(clientId, clientData) {
  validateNonEmptyString_(clientId, 'Client id');
  clientData = clientData || {};

  var sheet = getSpreadsheet_().getSheetByName('Clients');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ClientId');

  for (var r = 1; r < data.length; r++) {
    if (data[r][idCol] === clientId) {
      var rowNum = r + 1;
      if (clientData.name !== undefined) {
        sheet.getRange(rowNum, headers.indexOf('ClientName') + 1)
          .setValue(validateNonEmptyString_(clientData.name, 'Client name'));
      }
      ['contactPerson', 'phone', 'email', 'address'].forEach(function (field) {
        if (clientData[field] !== undefined) {
          var colName = field.charAt(0).toUpperCase() + field.slice(1);
          sheet.getRange(rowNum, headers.indexOf(colName) + 1).setValue(clientData[field]);
        }
      });
      return { success: true, client: getClient(clientId) };
    }
  }

  throw new Error('Client not found: ' + clientId);
}

function setClientActive_(clientId, active) {
  validateNonEmptyString_(clientId, 'Client id');
  var sheet = getSpreadsheet_().getSheetByName('Clients');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('ClientId');
  var activeCol = headers.indexOf('Active');

  for (var r = 1; r < data.length; r++) {
    if (data[r][idCol] === clientId) {
      sheet.getRange(r + 1, activeCol + 1).setValue(active);
      return { success: true };
    }
  }

  throw new Error('Client not found: ' + clientId);
}

function deactivateClient(clientId) {
  return setClientActive_(clientId, false);
}

function reactivateClient(clientId) {
  return setClientActive_(clientId, true);
}

/**
 * Resolves a freehand client name/phone typed on the New Trip screen to a
 * client record - reusing an existing active client on an exact
 * (case-insensitive) name match, updating their phone if a new one was
 * given, or creating a new client otherwise. Never matches against an
 * inactive client, so quoting under a name that was deliberately
 * deactivated creates a fresh record rather than silently reactivating it.
 */
function findOrCreateClient_(name, phone) {
  name = validateNonEmptyString_(name, 'Client name');
  var phoneTrimmed = String(phone || '').trim();

  var existing = getClients(false).filter(function (c) {
    return c.name.trim().toLowerCase() === name.trim().toLowerCase();
  })[0];

  if (existing) {
    if (phoneTrimmed && phoneTrimmed !== existing.phone) {
      updateClient(existing.id, { phone: phoneTrimmed });
      existing.phone = phoneTrimmed;
    }
    return existing;
  }

  return addClient({ name: name, phone: phoneTrimmed }).client;
}
