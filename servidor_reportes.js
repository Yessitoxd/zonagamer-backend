// Backend mínimo para exponer acciones.json como API pública
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Utilidades para leer y guardar archivos JSON individuales
const dataDir = __dirname + '/data';
function readJson(file) {
  const filePath = `${dataDir}/${file}`;
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return content ? JSON.parse(content) : [];
}
function writeJson(file, data) {
  const filePath = `${dataDir}/${file}`;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Manejo de sesión persistente ---
let session = null;
app.get('/session', (req, res) => {
  res.json(session ? { username: session.username, role: session.role } : {});
});
app.post('/session', (req, res) => {
  const { username, role } = req.body;
  let users = [];
  if (role === 'admin') {
    users = readJson('admins.json');
  } else if (role === 'trabajador') {
    users = readJson('employees.json');
  }
  const user = users.find(u => u.username === username);
  if (user) {
    session = { username: user.username, role: user.role };
    res.json({ ok: true, session });
  } else {
    res.status(401).json({ ok: false, error: 'Usuario no válido' });
  }
});
app.delete('/session', (req, res) => {
  session = null;
  res.json({ ok: true });
});

// Ruta raíz para comprobar que el backend está vivo
app.get('/', (req, res) => {
  res.send('API Zonagamer Backend funcionando');
});
function leerDatos() {
  try {
    const datos = JSON.parse(fs.readFileSync(__dirname + '/datos.json', 'utf8'));
    // Asegurar que session exista
    if (typeof datos.session === 'undefined') datos.session = null;
    return datos;
  } catch (e) {
    return { consoles: [], prices: { ps5: {}, switch: {} }, employees: [], sessions: [], workDays: {}, users: [], session: null };
  }
}
function guardarDatos(datos) {
  fs.writeFileSync(__dirname + '/datos.json', JSON.stringify(datos, null, 2));
}

// Endpoints REST para cada entidad
app.get('/admins', (req, res) => {
  res.json(readJson('admins.json'));
});
app.put('/admins', (req, res) => {
  writeJson('admins.json', req.body);
  res.json({ ok: true });
});

app.get('/employees', (req, res) => {
  res.json(readJson('employees.json'));
});
app.put('/employees', (req, res) => {
  writeJson('employees.json', req.body);
  res.json({ ok: true });
});

app.get('/consoles', (req, res) => {
  res.json(readJson('consoles.json'));
});
app.put('/consoles', (req, res) => {
  writeJson('consoles.json', req.body);
  res.json({ ok: true });
});

app.get('/prices', (req, res) => {
  res.json(readJson('prices.json'));
});
app.put('/prices', (req, res) => {
  writeJson('prices.json', req.body);
  res.json({ ok: true });
});

app.get('/sessions', (req, res) => {
  res.json(readJson('sessions.json'));
});
app.post('/sessions', (req, res) => {
  const sessions = readJson('sessions.json');
  sessions.push(req.body);
  writeJson('sessions.json', sessions);
  res.json({ ok: true });
});
app.put('/sessions', (req, res) => {
  writeJson('sessions.json', req.body);
  res.json({ ok: true });
});

// Endpoint para recibir y guardar acciones nuevas (sesiones)
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body;
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  const sessions = readJson('sessions.json');
  sessions.push(nuevaAccion);
  writeJson('sessions.json', sessions);
  res.json({ ok: true, msg: 'Acción guardada en la nube' });
});

// Endpoint para obtener todas las acciones en JSON
app.get('/acciones', (req, res) => {
  let acciones = [];
  try {
    acciones = require('./acciones.json');
  } catch (e) {}
  res.json(acciones);
});

// Solo debe haber un app.listen al final del archivo
app.listen(PORT, () => {
  console.log(`Servidor Zonagamer escuchando en puerto ${PORT}`);
});
