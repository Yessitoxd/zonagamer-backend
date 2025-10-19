const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function exportReportFromTemplate(rows, options = {}) {
  const templatePath = options.templatePath || path.resolve(__dirname, '..', 'Reporte Plantilla.xlsx');
  if (!fs.existsSync(templatePath)) throw new Error('Local template not found at ' + templatePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];

  // Helpers for date formatting and duration parsing/formatting
  function formatISOToDDMMYYYY(iso) {
    if (!iso) return '';
    // accept Date or YYYY-MM-DD
    try {
      if (iso instanceof Date) {
        const d = iso;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = d.getFullYear();
        return `${dd}-${mm}-${yy}`;
      }
      if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-');
        return `${d}-${m}-${y}`;
      }
      // fallback: try Date parse
      const pd = new Date(iso);
      if (!isNaN(pd.getTime())) return formatISOToDDMMYYYY(pd);
    } catch (e) {}
    return String(iso || '');
  }

  function parseDurationToMinutes(val) {
    if (val === null || typeof val === 'undefined') return 0;
    if (typeof val === 'number' && !isNaN(val)) return Math.round(val);
    const s = String(val).trim();
    if (!s) return 0;
    // Common patterns: "90", "90 min", "45m", "1:30", "1h 30m", "1.5h"
    // If contains ':' assume H:MM
    const colon = /^\s*(\d+):(\d{1,2})\s*$/.exec(s);
    if (colon) {
      const h = Number(colon[1]);
      const mm = Number(colon[2]);
      return h * 60 + mm;
    }
    // h or hr patterns
    const hmatch = /^\s*(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*$/i.exec(s) || /^\s*(\d+(?:\.\d+)?)\s*horas?\s*$/i.exec(s);
    if (hmatch) {
      return Math.round(Number(hmatch[1]) * 60);
    }
    // patterns like '1.5h'
    const decimalH = /^\s*(\d+(?:\.\d+))\s*h\s*$/i.exec(s);
    if (decimalH) return Math.round(Number(decimalH[1]) * 60);
    // minutes patterns
    const mMatch = /^(?:~)?\s*(\d+(?:\.\d+)?)\s*(?:min|m|mins|minutes|mins?)?\s*$/i.exec(s);
    if (mMatch) return Math.round(Number(mMatch[1]));
    // fallback: try to extract integer
    const digits = /(-?\d+)/.exec(s);
    if (digits) return Math.round(Number(digits[1]));
    return 0;
  }

  function formatMinutesSmart(totalMinutes) {
    if (typeof totalMinutes !== 'number' || isNaN(totalMinutes)) return '';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }

  // If payload provides summary values, write Reporte día -> H4 and Ganancia total -> H8
  try {
    const summary = options.summary || {};
    // Determine single date or range (support summary.start/summary.end or summary.dayReport)
    let displayDate = '';
    if (summary.start && summary.end) {
      displayDate = `${formatISOToDDMMYYYY(summary.start)} al ${formatISOToDDMMYYYY(summary.end)}`;
    } else if (Array.isArray(summary.dayReport) && summary.dayReport.length === 2) {
      displayDate = `${formatISOToDDMMYYYY(summary.dayReport[0])} al ${formatISOToDDMMYYYY(summary.dayReport[1])}`;
    } else if (summary.dayReport) {
      // single day
      displayDate = formatISOToDDMMYYYY(summary.dayReport);
    }
    if (displayDate) worksheet.getCell('H4').value = displayDate;

    // Total money: prefer numeric if provided
    if (typeof summary.totalMoney !== 'undefined' && summary.totalMoney !== null && summary.totalMoney !== '') {
      const nm = Number(summary.totalMoney);
      if (!isNaN(nm)) {
        worksheet.getCell('H8').value = nm;
        try { worksheet.getCell('H8').numFmt = '#,##0.00'; } catch (e) {}
      } else {
        worksheet.getCell('H8').value = summary.totalMoney;
      }
    }
  } catch (e) {
    // ignore errors while writing summary
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
  let totalMinutes = 0;
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
    // accumulate tiempo in minutes when possible
    try {
      const mins = parseDurationToMinutes(r.tiempo);
      if (!isNaN(mins) && mins > 0) totalMinutes += mins;
    } catch (e) {}
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
  // total tiempo into column G (7) formatted as minutes or hours
  totalsRow.getCell(7).value = formatMinutesSmart(totalMinutes);
  // formatting
  totalsRow.getCell(5).font = { bold: true };
  totalsRow.getCell(6).font = { bold: true };
  totalsRow.getCell(7).font = { bold: true };
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
  // Build a filename based on summary (single day or range)
  let filename = 'reporte.xlsx';
  try {
    const summary = options.summary || {};
    let nameDate = '';
    if (summary.start && summary.end) {
      nameDate = `${formatISOToDDMMYYYY(summary.start)} al ${formatISOToDDMMYYYY(summary.end)}`;
    } else if (Array.isArray(summary.dayReport) && summary.dayReport.length === 2) {
      nameDate = `${formatISOToDDMMYYYY(summary.dayReport[0])} al ${formatISOToDDMMYYYY(summary.dayReport[1])}`;
    } else if (summary.dayReport) {
      nameDate = formatISOToDDMMYYYY(summary.dayReport);
    }
    if (nameDate) filename = `Reporte ${nameDate}.xlsx`;
  } catch (e) {}

  return { buffer: Buffer.from(buffer), filename };
}

module.exports = { exportReportFromTemplate };
