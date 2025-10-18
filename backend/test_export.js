const fs = require('fs')
const path = require('path')
const { exportReportAsXlsx } = require('./lib/googleReports')

async function main() {
  const rows = [
    { nombre: 'Juan', accion: 'login', hora: '2025-10-01 12:00' },
    { nombre: 'Ana', accion: 'compra', hora: '2025-10-01 12:05' }
  ]

  try {
    const buf = await exportReportAsXlsx(rows)
    const out = path.resolve(__dirname, 'out_test_reporte.xlsx')
    fs.writeFileSync(out, buf)
    console.log('Wrote', out)
  } catch (err) {
    console.error('Export failed:', err)
    process.exitCode = 2
  }
}

if (require.main === module) main()
