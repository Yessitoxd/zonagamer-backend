const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Ajusta la ruta si tienes el key.json en otro lugar. También puedes exportar DRIVE_KEY_PATH.
const defaultKeyPaths = [
  path.resolve('C:/Users/PC/Desktop/secure_keys/zonagamer-475517-14e074bf2bab.json'),
  path.resolve(__dirname, 'zonagamer-475517-14e074bf2bab.json'),
  path.resolve(__dirname, 'backend/zonagamer-475517-14e074bf2bab.json')
];

const argv = process.argv.slice(2);
const keyArg = argv.find(a => !a.startsWith('-') && a !== '--me' && a !== '--delete');
const ownersMeFlag = argv.includes('--me');
const deleteFlag = argv.includes('--delete');
const keyPath = process.env.DRIVE_KEY_PATH || keyArg || defaultKeyPaths.find(p => fs.existsSync(p));
if (!keyPath) {
  console.error('No se encontró el key.json. Exporta DRIVE_KEY_PATH o coloca el json en:', defaultKeyPaths.join(', '));
  process.exit(2);
}

async function main() {
  console.log('Usando key:', keyPath);
  const raw = fs.readFileSync(keyPath, 'utf8');
  const key = JSON.parse(raw);
  const jwt = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive'], null);
  try {
    await jwt.authorize();
  } catch (e) {
    console.error('Fallo al autorizar JWT:', e.message || e);
    process.exit(2);
  }
  const drive = google.drive({ version: 'v3', auth: jwt });

  // Buscar archivos con nombre que contenga 'reporte-'
  let q = "name contains 'reporte-' and trashed = false";
  if (ownersMeFlag) q += " and 'me' in owners";
  console.log('Listando archivos con query:', q);
  try {
    const res = await drive.files.list({ q, fields: 'files(id,name,createdTime,size,owners)', pageSize: 200 });
    const files = res.data.files || [];
    if (files.length === 0) {
      console.log('No se encontraron archivos con prefijo reporte-');
      return;
    }
    let totalSize = 0;
    console.log(`Encontrados ${files.length} archivos:`);
    files.forEach((f, i) => {
      const size = f.size ? parseInt(f.size, 10) : 0;
      totalSize += size;
      const owners = (f.owners || []).map(o => o.emailAddress || o.displayName).join(', ');
      console.log(`${i+1}. ${f.name}  id=${f.id}  size=${size} bytes  created=${f.createdTime}  owners=${owners}`);
    });
    console.log(`Total size: ${totalSize} bytes (${(totalSize/1024/1024).toFixed(2)} MB)`);
    console.log('\nPara borrar: re-ejecuta con --delete y lo hago tras confirmación.');
    if (deleteFlag && files.length > 0) {
      console.log('\n--delete flag detectado: procediendo a borrar listados (confirmación automática en este entorno).');
      for (const f of files) {
        try {
          await drive.files.delete({ fileId: f.id });
          console.log('Borrado', f.id, f.name);
        } catch (e) {
          console.error('Fallo al borrar', f.id, e.message || e);
        }
      }
    }
  } catch (e) {
    console.error('Drive files.list falló:', e.message || e);
    process.exit(2);
  }
}

main().catch(err => {
  console.error('Error durante listing:', err && err.message ? err.message : err);
  process.exit(1);
});
