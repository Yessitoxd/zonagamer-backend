const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function exportReportFromTemplate(rows, options = {}) {
  const templatePath = options.templatePath || path.resolve(__dirname, '..', 'Reporte Plantilla.xlsx');
  if (!fs.existsSync(templatePath)) throw new Error('Local template not found at ' + templatePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const sheetName = options.sheetName || workbook.worksheets[0].name || 'Hoja 1';
  const worksheet = workbook.getWorksheet(sheetName) || workbook.worksheets[0];

  // Normalize rows: if array of objects, use keys as header
  let values = [];
  if (!rows) rows = [];
  if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    const keys = Object.keys(rows[0]);
    values.push(keys);
    for (const r of rows) values.push(keys.map(k => (r[k] != null ? r[k] : '')));
  } else if (Array.isArray(rows)) {
    values = rows;
  } else {
    values = [[rows]];
  }

  // Write values starting at A1 (overwrite existing region)
  for (let r = 0; r < values.length; r++) {
    const row = worksheet.getRow(r + 1);
    const vals = values[r];
    for (let c = 0; c < vals.length; c++) {
      row.getCell(c + 1).value = vals[c];
    }
    row.commit();
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { exportReportFromTemplate };
