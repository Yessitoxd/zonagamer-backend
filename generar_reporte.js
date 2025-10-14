// generar_reporte.js
// Script Node.js para generar un reporte Excel usando la plantilla y mantener el diseño, logo y bordes.
// Instrucciones:
// 1. Instala Node.js si no lo tienes: https://nodejs.org/
// 2. Instala exceljs: abre terminal en esta carpeta y ejecuta: npm install exceljs
// 3. Coloca tu plantilla 'Reporte Plantilla.xlsx' en la misma carpeta que este archivo.
// 4. Ejecuta: node generar_reporte.js
// 5. El archivo generado será 'reporte_sesiones.xlsx'.

const ExcelJS = require('exceljs');
const fs = require('fs');

// --- CONFIGURACIÓN ---
const PLANTILLA = 'Reporte Plantilla.xlsx'; // nombre de la plantilla

// La variable SALIDA se define dinámicamente después de calcular las fechas

// --- DATOS REALES ---
// Este script espera que el backend le pase el array de acciones reales (por ejemplo, desde una base de datos, API, o archivo generado automáticamente)
// Ejemplo de integración:
//   const acciones = require('./acciones.json');
//   o recibirlo como parámetro de una función, o desde una petición HTTP, etc.

// Aquí solo se define la función de agrupación:
function agruparSesionesLogicas(acciones) {
  let sesionesLogicas = [];
  let usadas = new Set();
  for (let i = 0; i < acciones.length; i++) {
    if (usadas.has(i)) continue;
    const base = acciones[i];
    // Agrupar solo por cliente, startDate, consola y tipo (NO por totalPrice)
    let grupo = [base];
    usadas.add(i);
    for (let j = i + 1; j < acciones.length; j++) {
      const s2 = acciones[j];
      if (
        s2.clientName === base.clientName &&
        s2.startDate === base.startDate &&
        s2.consoleType === base.consoleType &&
        s2.consoleNumber === base.consoleNumber
      ) {
        grupo.push(s2);
        usadas.add(j);
      }
    }
    // Solo mostrar comentarios de cambio/detener que ocurrieron dentro de esa sesión
    let cambio = null;
    let detener = false;
    for (let s of grupo) {
      if (!cambio && s.action === 'cambio' && s.fromConsole) {
        cambio = `Cambio de ${s.fromConsole} a ${s.consoleType} #${s.consoleNumber}`;
      }
      if (s.action === 'detener') {
        detener = true;
      }
    }
    let comentarios = [];
    if (cambio) comentarios.push(cambio);
    if (detener) comentarios.push('Se detuvo');
    let comentarioFinal = comentarios.length ? comentarios.join('; ') : 'Sin comentarios';
    sesionesLogicas.push({
      clientName: base.clientName,
      consoleType: base.consoleType,
      consoleNumber: base.consoleNumber,
      totalPrice: base.totalPrice,
      startDate: base.startDate,
      endDate: grupo.map(s => s.endDate).filter(Boolean).pop() || base.endDate,
      comment: comentarioFinal
    });
  }
  return sesionesLogicas;
}

// El backend debe pasar el array de acciones reales aquí:

// Lee automáticamente el archivo acciones.json generado por el sistema
let acciones = [];
try {
  acciones = require('./acciones.json');
} catch (e) {
  console.error('No se pudo leer acciones.json. Asegúrate de que el archivo exista y tenga el formato correcto.');
  process.exit(1);
}
const sesiones = agruparSesionesLogicas(acciones);

// --- FUNCIONES AUXILIARES ---
// Convierte una fecha ISO a objeto Date en zona Nicaragua
function toNicaDate(dateStr) {
  if (!dateStr) return null;
  // Usa Intl para forzar la zona horaria
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Managua',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(dateStr));
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  const h = parts.find(p => p.type === 'hour').value;
  const min = parts.find(p => p.type === 'minute').value;
  const s = parts.find(p => p.type === 'second').value;
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
}
function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  const d = toNicaDate(dateStr);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function formatTime(dateStr) {
  if (!dateStr) return '-';
  const d = toNicaDate(dateStr);
  if (!d) return '-';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// --- PROCESO PRINCIPAL ---
(async () => {

  // 1. Cargar plantilla
  if (!fs.existsSync(PLANTILLA)) {
    console.error('No se encontró la plantilla:', PLANTILLA);
    process.exit(1);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(PLANTILLA);

  // 2. Seleccionar hoja (ajusta el nombre si tu plantilla es diferente)
  const ws = workbook.getWorksheet('Hoja1') || workbook.worksheets[0];

  // 3. Calcular totales y fechas
  const totalGanancias = sesiones.reduce((sum, s) => sum + (parseFloat(s.totalPrice) || 0), 0);
  // Forzar fechas a zona Nicaragua para el rango
  let fechaInicio = sesiones[0]?.startDate || '';
  let fechaFin = sesiones[sesiones.length - 1]?.endDate || '';
  if (!fechaInicio || !fechaFin) {
    fechaInicio = fechaFin = '';
  }
  // Usar fechas en zona Nicaragua para el texto y nombre de archivo
  let fechaRangoTexto = '';
  let nombreArchivo = '';
  function formatFileDate(dateStr) {
    if (!dateStr) return '';
    const d = toNicaDate(dateStr);
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}_${mm}_${yyyy}`;
  }
  if (fechaInicio && fechaFin && formatFileDate(fechaInicio) === formatFileDate(fechaFin)) {
    fechaRangoTexto = formatDateDMY(fechaInicio);
    nombreArchivo = `reporte_sesiones_${formatFileDate(fechaInicio)}.xlsx`;
  } else if (fechaInicio && fechaFin) {
    fechaRangoTexto = `del ${formatDateDMY(fechaInicio)} al ${formatDateDMY(fechaFin)}`;
    nombreArchivo = `reporte_sesiones_${formatFileDate(fechaInicio)}_al_${formatFileDate(fechaFin)}.xlsx`;
  } else {
    nombreArchivo = 'reporte_sesiones.xlsx';
  }

  // 4. Escribir en las celdas correctas: F4, H4, F7, H7
  ws.getCell('F4').value = 'Reporte del día:';
  ws.getCell('H4').value = fechaRangoTexto;
  ws.getCell('F7').value = 'Ganancias totales del día:';
  ws.getCell('H7').value = `C$ ${totalGanancias.toFixed(2)}`;
  // Opcional: ajustar ancho de columna para que se vea completo
  ws.getColumn('H').width = 25;
  ws.getColumn('F').width = 25;

  // 5. Escribir desglose de sesiones a partir de la fila 13 (ajusta si tu plantilla es diferente)
  let row = 13;
  sesiones.forEach(s => {
    ws.getCell(`B${row}`).value = s.clientName || '-';
    ws.getCell(`C${row}`).value = `${s.consoleType} #${s.consoleNumber}`;
    ws.getCell(`D${row}`).value = `C$ ${(parseFloat(s.totalPrice) || 0).toFixed(2)}`;
    // Calcular tiempo comprado en minutos
    let minutos = '-';
    if (s.startDate && s.endDate) {
      const start = toNicaDate(s.startDate);
      const end = toNicaDate(s.endDate);
      const diff = Math.round((end - start) / 60000);
      minutos = diff > 0 ? `${diff} min` : '-';
    }
    ws.getCell(`E${row}`).value = minutos;
    ws.getCell(`F${row}`).value = formatTime(s.startDate);
    ws.getCell(`G${row}`).value = formatTime(s.endDate);
    ws.getCell(`H${row}`).value = s.comment || '';
    row++;
  });

  // 6. Guardar el archivo nuevo
  // Si es un solo día, siempre poner la fecha en el nombre
  if (fechaInicio && fechaFin && fechaInicio.slice(0,10) === fechaFin.slice(0,10)) {
    nombreArchivo = `reporte_sesiones_${formatFileDate(fechaInicio)}.xlsx`;
  } else if (fechaInicio && fechaFin) {
    nombreArchivo = `reporte_sesiones_${formatFileDate(fechaInicio)}_al_${formatFileDate(fechaFin)}.xlsx`;
  } else {
    nombreArchivo = 'reporte_sesiones.xlsx';
  }
  await workbook.xlsx.writeFile(nombreArchivo);
  console.log('Reporte generado:', nombreArchivo);
})();
