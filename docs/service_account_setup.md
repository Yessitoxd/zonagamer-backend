Service Account setup (resumen rápido)

1) Crear proyecto y habilitar APIs
- Console → API & Services → Library → habilitar Google Drive API y Google Sheets API.

2) Crear Service Account
- IAM & Admin → Service Accounts → Create Service Account.
- Nombre: zonagamer-exporter (ejemplo).

3) Generar clave JSON
- En la service account → Keys → Add Key → Create new key → JSON → Download.

4) Compartir plantilla con la Service Account
- Abre la plantilla en Sheets → Share → agrega el email de la SA con permiso Editor.

5) Subir variables a Render
- `GOOGLE_SERVICE_ACCOUNT_KEY_B64` = base64(key.json)
- `TEMPLATE_SPREADSHEET_ID` = id de la hoja (parte entre /d/ y /edit)

6) Probar localmente
- En PowerShell:
  $env:GOOGLE_SERVICE_ACCOUNT_KEY_B64 = Get-Content .\key.b64
  $env:TEMPLATE_SPREADSHEET_ID = '1AbC...'
  node backend/test_export.js
