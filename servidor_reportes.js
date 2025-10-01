
// Backend mínimo para exponer acciones.json como API pública
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Ruta raíz para comprobar que el backend está vivo
app.get('/', (req, res) => {
  res.send('API Zonagamer Backend funcionando');
});


// Utilidad para leer y guardar datos.json
function leerDatos() {
  try {
    return JSON.parse(fs.readFileSync(__dirname + '/datos.json', 'utf8'));
  } catch (e) {
    return { consoles: [], prices: { ps5: {}, switch: {} }, employees: [], sessions: [], workDays: {}, users: [] };
  }
}
function guardarDatos(datos) {
  fs.writeFileSync(__dirname + '/datos.json', JSON.stringify(datos, null, 2));
}

// Endpoints REST para cada entidad
app.get('/consoles', (req, res) => {
  res.json(leerDatos().consoles);
});
app.post('/consoles', (req, res) => {
  const datos = leerDatos();
  datos.consoles.push(req.body);
  guardarDatos(datos);
  res.json({ ok: true });
});
app.put('/consoles', (req, res) => {
  const datos = leerDatos();
  datos.consoles = req.body;
  guardarDatos(datos);
  res.json({ ok: true });
});

app.get('/prices', (req, res) => {
  res.json(leerDatos().prices);
});
app.put('/prices', (req, res) => {
  const datos = leerDatos();
  datos.prices = req.body;
  guardarDatos(datos);
  res.json({ ok: true });
});

app.get('/employees', (req, res) => {
  res.json(leerDatos().employees);
});
app.post('/employees', (req, res) => {
  const datos = leerDatos();
  datos.employees.push(req.body);
  guardarDatos(datos);
  res.json({ ok: true });
});
app.put('/employees', (req, res) => {
  const datos = leerDatos();
  datos.employees = req.body;
  guardarDatos(datos);
  res.json({ ok: true });
});

app.get('/sessions', (req, res) => {
  res.json(leerDatos().sessions);
});
app.post('/sessions', (req, res) => {
  const datos = leerDatos();
  datos.sessions.push(req.body);
  guardarDatos(datos);
  res.json({ ok: true });
});
app.put('/sessions', (req, res) => {
  const datos = leerDatos();
  datos.sessions = req.body;
  guardarDatos(datos);
  res.json({ ok: true });
});

app.get('/workdays', (req, res) => {
  res.json(leerDatos().workDays);
});
app.put('/workdays', (req, res) => {
  const datos = leerDatos();
  datos.workDays = req.body;
  guardarDatos(datos);
  res.json({ ok: true });
});

app.get('/users', (req, res) => {
  res.json(leerDatos().users);
});
app.post('/users', (req, res) => {
  const datos = leerDatos();
  datos.users.push(req.body);
  guardarDatos(datos);
  res.json({ ok: true });
});
app.put('/users', (req, res) => {
  const datos = leerDatos();
  datos.users = req.body;
  guardarDatos(datos);
  res.json({ ok: true });
});

// Endpoint para recibir y guardar acciones nuevas (sesiones)
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body;
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  const datos = leerDatos();
  datos.sessions.push(nuevaAccion);
  guardarDatos(datos);
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
