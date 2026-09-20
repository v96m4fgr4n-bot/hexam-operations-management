/**
 * Web app entry point. Standalone script - the backing spreadsheet is
 * resolved by ID (see Utils.gs / Setup.gs), not by container binding.
 */
function doGet(e) {
  initializeSpreadsheet();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Hexam Bricks Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inlines another HTML file's contents at template-render time.
 * Used by Index.html scriptlets, e.g. <?!= include('CSS'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
