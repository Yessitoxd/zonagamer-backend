const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function exportReportFromTemplate(rows, options = {}) {
  const templatePath = options.templatePath || path.resolve(__dirname, '..', 'Reporte Plantilla.xlsx');
  if (!fs.existsSync(templatePath)) throw new Error('Local template not found at ' + templatePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];

  // If payload provides summary values, write Reporte día -> H4 and Ganancia total -> H8
  try {
    const summary = options.summary || {};
    if (summary.dayReport) {
      worksheet.getCell('H4').value = summary.dayReport;
    } else if (summary.dayReportCellF4) {
      worksheet.getCell('H4').value = summary.dayReportCellF4;
    }
    if (typeof summary.totalMoney !== 'undefined') {
      worksheet.getCell('H8').value = summary.totalMoney;
    } else if (summary.dayTotalCellF8) {
      worksheet.getCell('H8').value = summary.dayTotalCellF8;
    }
  } catch (e) {
    // ignore
  }

  // Headers should be at row 12, columns C-J
  const headerRowIndex = 12;
  const headers = ['Fecha', 'Empleado', 'Consola', 'Dinero', 'Tiempo', 'Inicio', 'Fin', 'Comentario'];
  // Write headers into C12..J12
  for (let i = 0; i < headers.length; i++) {
    const cell = worksheet.getRow(headerRowIndex).getCell(3 + i);
    cell.value = headers[i];
    cell.font = { bold: true };
    cell.alignment = { wrapText: true, vertical: 'middle' };
  }

  const startRow = 13;
  if (!rows) rows = [];
  // Normalize rows array of objects
  const normalized = rows.map(r => {
    return {
      fecha: r.fecha || r.Fecha || r.date || '',
      empleado: r.empleado || r.Empleado || r.nombre || '',
      consola: r.consola || r.Consola || r.console || '',
      dinero: typeof r.dinero !== 'undefined' ? r.dinero : (typeof r.dinero === 'undefined' && typeof r.Dinero !== 'undefined' ? r.Dinero : ''),
      tiempo: r.tiempo || r.Tiempo || r.duration || '',
      inicio: r.inicio || r.Inicio || r.start || '',
      fin: r.fin || r.Fin || r.end || '',
      comentario: r.comentario || r.Comentario || r.comment || ''
    };
  });

  // Write rows starting at startRow
  let totalMoney = 0;
  for (let i = 0; i < normalized.length; i++) {
    const outRow = worksheet.getRow(startRow + i);
    const r = normalized[i];
    // Fecha: convert YYYY-MM-DD to dd/mm/yyyy string or keep as-is
    let fechaVal = r.fecha || '';
    try {
      if (typeof fechaVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaVal)) {
        const parts = fechaVal.split('-');
        fechaVal = parts[2] + '/' + parts[1] + '/' + parts[0];
      } else if (fechaVal instanceof Date) {
        const d = fechaVal;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        fechaVal = dd + '/' + mm + '/' + yy;
      }
    } catch (e) {}

    outRow.getCell(3).value = fechaVal; // C
    outRow.getCell(4).value = r.empleado; // D
    outRow.getCell(5).value = r.consola; // E
    // Dinero: keep numeric if possible
    const dineroVal = (r.dinero !== '' && r.dinero !== null && r.dinero !== undefined && !isNaN(Number(r.dinero))) ? Number(r.dinero) : (r.dinero || '');
    outRow.getCell(6).value = dineroVal; // F
    outRow.getCell(7).value = r.tiempo; // G
    outRow.getCell(8).value = r.inicio; // H
    outRow.getCell(9).value = r.fin; // I
    outRow.getCell(10).value = r.comentario; // J

    // Styles
    for (let c = 3; c <= 10; c++) {
      const cell = outRow.getCell(c);
      cell.alignment = { wrapText: true, vertical: 'top' };
    }
    try { worksheet.getRow(startRow + i).height = 66; } catch (e) {}

    if (typeof dineroVal === 'number') totalMoney += dineroVal;
    outRow.commit();
  }

  // Totals row: next row after data
  const totalsRowIndex = startRow + normalized.length;
  const totalsRow = worksheet.getRow(totalsRowIndex);
  // Put label 'Total' in column B
  totalsRow.getCell(2).value = 'Total';
  // total uses (count of rows) into column E (5)
  totalsRow.getCell(5).value = normalized.length;
  // total money into column F (6)
  totalsRow.getCell(6).value = totalMoney;
  // formatting
  totalsRow.getCell(5).font = { bold: true };
  totalsRow.getCell(6).font = { bold: true };
  try { totalsRow.getCell(6).numFmt = '#,##0.00'; } catch (e) {}
  totalsRow.commit();

  // Column widths (approx chars)
  try {
    worksheet.getColumn(3).width = 14; // Fecha
    worksheet.getColumn(4).width = 20; // Empleado
    worksheet.getColumn(5).width = 18; // Consola
    worksheet.getColumn(6).width = 14; // Dinero
    worksheet.getColumn(7).width = 12; // Tiempo
    worksheet.getColumn(8).width = 12; // Inicio
    worksheet.getColumn(9).width = 12; // Fin
    worksheet.getColumn(10).width = 40; // Comentario
  } catch (e) {}

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { exportReportFromTemplate };
