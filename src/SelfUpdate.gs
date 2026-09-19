/**
 * Lets this Apps Script project update its own source code from GitHub,
 * using the authorization the project already has - no clasp/local login
 * needed. Run pullLatestCode() manually from the editor whenever there's a
 * new version to pick up.
 *
 * One-time setup required before first use:
 * Visit https://script.google.com/home/usersettings and turn on
 * "Google Apps Script API" (required for a script to modify its own
 * project - Google disables this by default).
 */

var GITHUB_OWNER = 'v96m4fgr4n-bot';
var GITHUB_REPO = 'hexam-operations-management';
var GITHUB_BRANCH = 'claude/eager-dijkstra-rlnvnx';

// name/type must match the Apps Script API's Content resource schema.
// This list REPLACES the project's entire file set, so every file must be
// included or it will be deleted from the project.
var SELF_UPDATE_FILES = [
  { path: 'src/appsscript.json', name: 'appsscript', type: 'JSON' },
  { path: 'src/Code.gs', name: 'Code', type: 'SERVER_JS' },
  { path: 'src/Utils.gs', name: 'Utils', type: 'SERVER_JS' },
  { path: 'src/Setup.gs', name: 'Setup', type: 'SERVER_JS' },
  { path: 'src/SelfUpdate.gs', name: 'SelfUpdate', type: 'SERVER_JS' },
  { path: 'src/SettingsService.gs', name: 'SettingsService', type: 'SERVER_JS' },
  { path: 'src/ClientService.gs', name: 'ClientService', type: 'SERVER_JS' },
  { path: 'src/TripService.gs', name: 'TripService', type: 'SERVER_JS' },
  { path: 'src/CSS.html', name: 'CSS', type: 'HTML' },
  { path: 'src/NewTripView.html', name: 'NewTripView', type: 'HTML' },
  { path: 'src/TripHistoryView.html', name: 'TripHistoryView', type: 'HTML' },
  { path: 'src/ClientsView.html', name: 'ClientsView', type: 'HTML' },
  { path: 'src/SettingsView.html', name: 'SettingsView', type: 'HTML' },
  { path: 'src/JavaScript.html', name: 'JavaScript', type: 'HTML' },
  { path: 'src/Index.html', name: 'Index', type: 'HTML' }
];

function pullLatestCode() {
  var files = SELF_UPDATE_FILES.map(fetchGithubFile_);

  var scriptId = ScriptApp.getScriptId();
  var response = UrlFetchApp.fetch(
    'https://script.googleapis.com/v1/projects/' + scriptId + '/content',
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ files: files }),
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(
      'Self-update failed (HTTP ' + response.getResponseCode() + '): ' + response.getContentText() +
      '. If this mentions permission or the Apps Script API, make sure it is turned on at ' +
      'https://script.google.com/home/usersettings'
    );
  }

  var message = 'Updated ' + files.length + ' files from ' + GITHUB_BRANCH + '. ' +
    'If this project is deployed as a web app, create a new deployment version to publish the change.';
  Logger.log(message);
  return message;
}

function fetchGithubFile_(fileSpec) {
  var url = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO +
    '/' + GITHUB_BRANCH + '/' + fileSpec.path;
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      'Failed to fetch ' + fileSpec.path + ' from GitHub (HTTP ' + response.getResponseCode() + '): ' +
      response.getContentText()
    );
  }

  return { name: fileSpec.name, type: fileSpec.type, source: response.getContentText() };
}
