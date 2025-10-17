// Google Apps Script Web App to populate a template spreadsheet and return an XLSX download URL
// Usage: deploy this script as a Web App (anyone with link) and set the TEMPLATE_SPREADSHEET_ID
// The POST body expects JSON:
// {
//   templateId: 'TEMPLATE_SPREADSHEET_ID', // optional if using the fixed TEMPLATE_SPREADSHEET_ID below
//   title: 'Reporte ...',
//   summary: { dayReportCellF5: 'C$ 100', dayTotalCellF8: 'C$ 300' },
//   rows: [ { fecha:'2025-10-17', empleado:'Ana', consola:'PS5 #1', dinero:100, tiempo:'1 h', inicio:'08:00', fin:'09:00', comentario:'...' }, ... ],
// }

// ID de la plantilla insertado desde la URL que proporcionaste.
// Si quieres cambiarlo más tarde, reemplaza el valor abajo por otro ID o pásalo como templateId en el POST.
var TEMPLATE_SPREADSHEET_ID = '14P68SCjUZk129M77W9x95KO068zLzg4WnxklvU0nlSg';

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var templateId = payload.templateId || TEMPLATE_SPREADSHEET_ID;
    if (!templateId) return ContentService.createTextOutput(JSON.stringify({ error: 'Missing templateId' })).setMimeType(ContentService.MimeType.JSON);

    // Make a copy of the template so we don't overwrite it
    var copy = DriveApp.getFileById(templateId).makeCopy('Reporte - ' + (payload.title || new Date().toISOString()));
    var ss = SpreadsheetApp.openById(copy.getId());
    var sheet = ss.getSheets()[0];

    // Write summary cells: F5 -> H5, F8 -> H8
    try { sheet.getRange('H5').setValue(payload.summary && payload.summary.dayReportCellF5 || ''); } catch(e){}
    try { sheet.getRange('H8').setValue(payload.summary && payload.summary.dayTotalCellF8 || ''); } catch(e){}

    // Headers are expected at C16-J16 already in the template; ensure they exist (optional)
    // Write rows starting at C17..J17 (row 17) — each row is columns C..J
    var startRow = 17;
    var values = [];
    (payload.rows || []).forEach(function(r){
      values.push([
        r.fecha || '',
        r.empleado || '',
        r.consola || '',
        typeof r.dinero !== 'undefined' ? r.dinero : '',
        r.tiempo || '',
        r.inicio || '',
        r.fin || '',
        r.comentario || ''
      ]);
    });

    if (values.length > 0) {
      sheet.getRange(startRow, 3, values.length, values[0].length).setValues(values);
    }

    // After rows, add Totals row: in column B put 'Total', in column E put totalUses, in column F put totalMoney
    var totalsRow = startRow + values.length;
    sheet.getRange(totalsRow, 2).setValue('Total'); // column B
    // compute totals if not provided
    var totalUses = payload.totals && payload.totals.totalUses != null ? payload.totals.totalUses : (values.length);
    var totalMoney = payload.totals && payload.totals.totalMoney != null ? payload.totals.totalMoney : values.reduce(function(a,b){ return a + (Number(b[3])||0); },0);
    sheet.getRange(totalsRow, 5).setValue(totalUses); // column E
    sheet.getRange(totalsRow, 6).setValue(totalMoney); // column F

    // Optional: auto-resize columns or set wrap
    sheet.autoResizeColumns(3,8);
    // Return an export URL for XLSX
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';

    return ContentService.createTextOutput(JSON.stringify({ ok: true, downloadUrl: url, fileId: ss.getId() })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message, stack: err.stack })).setMimeType(ContentService.MimeType.JSON);
  }
}
