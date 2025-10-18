/*
  googleReports.js

  Helper para exportar una plantilla de Google Sheets como XLSX usando una Service Account.

  Variables necesarias en el entorno:
    - GOOGLE_SERVICE_ACCOUNT_KEY_B64 : JSON key (base64)
    - TEMPLATE_SPREADSHEET_ID : id de la hoja plantilla
*/

const { google } = require('googleapis')

function getKeyFromEnv() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_B64 not set')
  try {
    const raw = Buffer.from(b64, 'base64').toString('utf8')
    return JSON.parse(raw)
  } catch (err) {
    throw new Error('Failed to parse service account key from GOOGLE_SERVICE_ACCOUNT_KEY_B64: ' + err.message)
  }
}

async function getClients() {
  const key = getKeyFromEnv()
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
  const jwt = new google.auth.JWT(key.client_email, null, key.private_key, scopes, null)
  await jwt.authorize()
  const drive = google.drive({ version: 'v3', auth: jwt })
  const sheets = google.sheets({ version: 'v4', auth: jwt })
  return { drive, sheets }
}

function normalizeRows(rows) {
  if (!rows) return []
  if (!Array.isArray(rows)) return [[rows]]
  if (rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    const keys = Object.keys(rows[0])
    const values = [keys]
    for (const r of rows) values.push(keys.map(k => r[k] != null ? r[k] : ''))
    return values
  }
  return rows
}

async function exportReportAsXlsx(rows, options = {}) {
  const templateId = options.templateSpreadsheetId || process.env.TEMPLATE_SPREADSHEET_ID
  if (!templateId) throw new Error('TEMPLATE_SPREADSHEET_ID not set')
  const sheetName = options.sheetName || 'Hoja 1'

  const { drive, sheets } = await getClients()

  // copiar plantilla
  const copyRes = await drive.files.copy({ fileId: templateId, requestBody: { name: `reporte-${Date.now()}` } })
  const copyId = copyRes.data.id

  try {
    const values = normalizeRows(rows)
    await sheets.spreadsheets.values.update({
      spreadsheetId: copyId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    })

    const res = await drive.files.export({ fileId: copyId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, { responseType: 'arraybuffer' })
    return Buffer.from(res.data)
  } finally {
    try { await drive.files.delete({ fileId: copyId }) } catch (e) { /* ignore */ }
  }
}

module.exports = { exportReportAsXlsx }
