// Requires y configuración inicial
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const cors = require('cors');

// Backend mínimo para exponer acciones.json como API pública
const app = express();
// CORS robusto para Netlify y localhost
const allowedOrigins = [
  'https://zonagamersrs.netlify.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
const corsOptions = {
  origin: function (origin, callback) {
    // permitir peticiones sin origin (como curl/postman) o si está en la lista
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
// Manejo universal de preflight sin usar comodín '*' que rompe en algunas versiones de path-to-regexp
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Configuración: URL del Apps Script Web App (server-side proxy). Puedes sobreescribir con variable de entorno SHEETS_WEBAPP_URL
// Actualizado al deployment público verificado por el usuario (2025-10-17)
const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyo48CAtZ_3MkMV2NTc_8cJkO8QjhBeVkFg0RqBCx-ijVDmuFE_kB9i29ivfbP-xbO9/exec';

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

// Modelo para el estado de cada consola (usa mongoose, por eso va después de require)
const consoleStateSchema = new mongoose.Schema({
  consoleNumber: { type: Number, required: true, unique: true },
  state: { type: Object, required: true }
});
const ConsoleState = mongoose.model('ConsoleState', consoleStateSchema);
// Obtener el estado de una consola por número
app.get('/console-state/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const found = await ConsoleState.findOne({ consoleNumber: Number(number) });
    if (!found) return res.json(null);
    res.json(found.state);
  } catch (err) {
    console.error('Error al obtener estado de consola:', err);
    res.status(500).json({ error: 'Error al obtener estado de consola' });
  }
});

// Guardar o actualizar el estado de una consola por número
app.post('/console-state/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const { state } = req.body;
    if (!state) return res.status(400).json({ error: 'Falta el estado' });
    const updated = await ConsoleState.findOneAndUpdate(
      { consoleNumber: Number(number) },
      { state },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al guardar estado de consola:', err);
    res.status(500).json({ error: 'Error al guardar estado de consola' });
  }
});

// Eliminar el estado de una consola (p.ej., al restablecer la tarjeta)
app.delete('/console-state/:number', async (req, res) => {
  try {
    const { number } = req.params;
    await ConsoleState.deleteOne({ consoleNumber: Number(number) });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar estado de consola:', err);
    res.status(500).json({ error: 'Error al eliminar estado de consola' });
  }
});

// --- Manejo de sesión persistente ---
let session = null;
app.get('/session', (req, res) => {
  res.json(session ? { username: session.username, role: session.role } : {});
});
app.post('/session', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) return res.status(400).json({ ok: false, error: 'Faltan credenciales' });
    if (role === 'trabajador') {
      const emp = await Employee.findOne({ username });
      if (!emp || emp.password !== password) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      session = { username: emp.username, role: emp.role || 'trabajador' };
      return res.json({ ok: true, session });
    } else if (role === 'admin') {
      const adm = await Admin.findOne({ username });
      if (!adm || adm.password !== password) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      session = { username: adm.username, role: adm.role || 'admin' };
      return res.json({ ok: true, session });
    }
    return res.status(400).json({ ok: false, error: 'Rol inválido' });
  } catch (e) {
    console.error('POST /session error:', e);
    res.status(500).json({ ok: false, error: 'Error interno en sesión' });
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
// Conexión a MongoDB Atlas
console.log("Valor de process.env.Zonagamer:", process.env.Zonagamer);
console.log("Valor de process.env.MONGODB_URI:", process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch(err => console.error('Error de conexión:', err));

// Modelo Admins
// Modelo Consoles
// Modelo Prices
// Modelo Employees
// Modelo Sessions
const sessionSchema = new mongoose.Schema({
  clientName: String,
  employee: String,
  consoleType: String,
  consoleNumber: Number,
  startDate: String,
  endDate: String,
  totalPrice: Number,
  durationSeconds: Number,
  action: String,
  fromConsole: String,
  comment: String
});
const Session = mongoose.model('Session', sessionSchema);
// Modelo para ganancias diarias por usuario (username + dateISO)
const earningSchema = new mongoose.Schema({
  username: { type: String, required: true },
  dateISO: { type: String, required: true }, // YYYY-MM-DD (zona Managua en cliente)
  amount: { type: Number, default: 0 }
});
earningSchema.index({ username: 1, dateISO: 1 }, { unique: true });
const Earning = mongoose.model('Earning', earningSchema);
const employeeSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'trabajador' },
  dailyPay: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 }
});
const Employee = mongoose.model('Employee', employeeSchema);
// Endpoint Employees
app.get('/employees', (req, res) => {
  Employee.find({})
    .then(employees => res.json(employees))
    .catch(err => {
      console.error('Error al leer empleados desde MongoDB:', err);
      res.status(500).json({ error: 'Error al leer empleados desde MongoDB' });
    });
});

app.put('/employees', (req, res) => {
  // Actualizar todos los empleados (sobrescribe)
  Employee.deleteMany({})
    .then(() => Employee.insertMany(req.body))
    .then(() => res.json({ ok: true }))
    .catch(err => {
      console.error('Error al guardar empleados en MongoDB:', err);
      res.status(500).json({ error: 'Error al guardar empleados en MongoDB' });
    });
});
const priceSchema = new mongoose.Schema({
  console: { type: String, required: true },
  duration: { type: Number },
  price: { type: Number, required: true }
});
const Price = mongoose.model('Price', priceSchema);
const consoleSchema = new mongoose.Schema({
  type: { type: String, required: true },
  number: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  img: { type: String }
});
const Console = mongoose.model('Console', consoleSchema);
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' }
});
const Admin = mongoose.model('Admin', adminSchema);

// Proxy endpoint: recibe el payload del frontend y lo reenvía al Apps Script Web App
app.post('/generate-report', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'Falta payload' });

    // Use global fetch if available (Node 18+), otherwise try to require node-fetch
    let fetchFn = global.fetch;
    if (!fetchFn) {
      try { fetchFn = require('node-fetch'); } catch (e) { }
    }
    if (!fetchFn) return res.status(500).json({ error: 'fetch no disponible en el servidor' });

    const r = await fetchFn(SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    // intentar parsear JSON de respuesta
    try {
      const json = JSON.parse(text);
      return res.json(json);
    } catch (e) {
      // Detect HTML responses (Google login page, 401/404 HTML, etc.)
      const snippet = (text || '').toString().slice(0, 1000);
      const isHtml = /^\s*<\!doctype html/i.test(snippet) || /^\s*<html/i.test(snippet) || (r.headers && (r.headers.get ? (r.headers.get('content-type') || '') : '').includes('text/html'));
      console.error('Sheets webapp proxy: non-JSON response', { status: r.status, isHtml });
      if (isHtml) {
        // Return a JSON error instead of raw HTML to keep front-end readable
        return res.status(502).json({ error: 'Sheets webapp returned HTML (possible auth/permissions issue)', status: r.status, bodySnippet: snippet });
      }
      // Unknown non-JSON case
      return res.status(r.status || 200).json({ error: 'Invalid JSON from sheets webapp', status: r.status, bodySnippet: snippet });
    }
  } catch (err) {
    console.error('Error proxying generate-report:', err);
    res.status(500).json({ error: err.message });
  }
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
// Editar una consola por _id
app.put('/consoles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, number } = req.body;
    if (!type || !number) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
    // Validar que no exista otra consola con ese número
    const existe = await Console.findOne({ number, _id: { $ne: id } });
    if (existe) {
      return res.status(400).json({ message: 'Ya existe una consola con ese número.' });
    }
    let name = type === 'ps5' ? 'Play Station 5' : (type === 'switch' ? 'Nintendo Switch' : type);
    let img = type === 'ps5' ? 'PS5.png' : (type === 'switch' ? 'Switch.png' : '');
    const updated = await Console.findByIdAndUpdate(id, { type, number, name, img }, { new: true });
    if (!updated) {
      return res.status(404).json({ message: 'Consola no encontrada.' });
    }
    res.json({ message: 'Consola actualizada correctamente.' });
  } catch (err) {
    console.error('Error al editar consola:', err);
    res.status(500).json({ message: 'Error al editar consola.' });
  }
});

// Eliminar una consola por _id
app.get('/consoles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const consola = await Console.findById(id);
    if (!consola) {
      return res.status(404).json({ message: 'Consola no encontrada.' });
    }
    res.json(consola);
  } catch (err) {
    console.error('Error al buscar consola:', err);
    res.status(500).json({ message: 'Error al buscar consola.' });
  }
});

app.delete('/consoles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Console.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Consola no encontrada.' });
    }
    res.json({ message: 'Consola eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar consola:', err);
    res.status(500).json({ message: 'Error al eliminar consola.' });
  }
});
app.get('/admins', (req, res) => {
  Admin.find({})
    .then(admins => res.json(admins))
    .catch(err => {
      console.error('Error al leer admins desde MongoDB:', err);
      res.status(500).json({ error: 'Error al leer admins desde MongoDB' });
    });
});

app.get('/consoles', (req, res) => {
  Console.find({})
    .then(consoles => res.json(consoles))
    .catch(err => {
      console.error('Error al leer consolas desde MongoDB:', err);
      res.status(500).json({ error: 'Error al leer consolas desde MongoDB' });
    });
});

// Obtener sesiones filtradas por consola y fecha (query params)
// Ej: /sessions?consoleType=ps5&consoleNumber=1&date=2025-10-16
app.get('/sessions', async (req, res) => {
  try {
    const { consoleType, consoleNumber, date, start, end } = req.query;
    const andFilter = [];
    if (consoleType) andFilter.push({ consoleType });
    if (consoleNumber) andFilter.push({ consoleNumber: Number(consoleNumber) });

    if (start && end) {
      // Build date strings [YYYY-MM-DD] inclusive using UTC to avoid TZ shifts
      function toUTCDateParts(s) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      }
      const sDate = toUTCDateParts(start);
      const eDate = toUTCDateParts(end);
      const dates = [];
      for (let d = new Date(sDate); d.getTime() <= eDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
        const yy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        dates.push(`${yy}-${mm}-${dd}`);
      }
      // Strict prefix match for speed/accuracy
      const orClauses = dates.map(dt => ({ startDate: { $regex: `^${dt}` } }));
      if (orClauses.length) andFilter.push({ $or: orClauses });
    } else if (date) {
      andFilter.push({ startDate: { $regex: `^${date}` } });
    }

    const filter = andFilter.length ? { $and: andFilter } : {};
    const sessions = await Session.find(filter).sort({ startDate: 1 });
    res.json(sessions);
  } catch (err) {
    console.error('Error al leer sesiones filtradas:', err);
    res.status(500).json({ error: 'Error al leer sesiones filtradas' });
  }
});
// Endpoint para añadir una consola (POST)
app.post('/consoles', async (req, res) => {
  try {
    const { type, number } = req.body;
    if (!type || !number) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
    // Validar que no exista una consola con ese número
    const existe = await Console.findOne({ number });
    if (existe) {
      return res.status(400).json({ message: 'Ya existe una consola con ese número.' });
    }
    // Crear nombre e imagen automáticamente
    let name = type === 'ps5' ? 'Play Station 5' : (type === 'switch' ? 'Nintendo Switch' : type);
    let img = type === 'ps5' ? 'PS5.png' : (type === 'switch' ? 'Switch.png' : '');
    const nuevaConsola = new Console({ type, number, name, img });
    await nuevaConsola.save();
    console.log('POST /consoles - nueva consola añadida:', { type, number });
    res.status(201).json({ message: 'Consola añadida correctamente.' });
  } catch (err) {
    console.error('Error al añadir consola:', err);
    res.status(500).json({ message: 'Error al añadir consola.' });
  }
});
app.put('/consoles', async (req, res) => {
  // Para evitar sobrescrituras accidentales, solo aceptamos un array para reemplazar
  const body = req.body;
  console.log('PUT /consoles payload type:', Array.isArray(body) ? 'array' : typeof body);
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Payload inválido: se espera un arreglo de consolas para sobrescribir. Usa POST para añadir una consola individual.' });
  }
  // Validar elementos
  const valid = body.every(c => c && typeof c.type === 'string' && typeof c.number === 'number');
  if (!valid) return res.status(400).json({ error: 'Array de consolas inválido. Cada elemento debe tener { type: string, number: number }' });
  try {
    // Normalizar nombre e imagen antes de insertar
    const toInsert = body.map(c => ({
      type: c.type,
      number: c.number,
      name: c.type === 'ps5' ? 'Play Station 5' : (c.type === 'switch' ? 'Nintendo Switch' : c.type),
      img: c.type === 'ps5' ? 'PS5.png' : (c.type === 'switch' ? 'Switch.png' : '')
    }));
    await Console.deleteMany({});
    await Console.insertMany(toInsert);
    console.log('PUT /consoles - sobrescribiendo consolas, count:', toInsert.length);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al guardar consolas en MongoDB:', err);
    res.status(500).json({ error: 'Error al guardar consolas en MongoDB' });
  }
});


// Obtener todos los precios
app.get('/prices', (req, res) => {
  Price.find({})
    .then(prices => res.json(prices))
    .catch(err => {
      console.error('Error al leer precios desde MongoDB:', err);
      res.status(500).json({ error: 'Error al leer precios desde MongoDB' });
    });
});

// Crear un nuevo precio
app.post('/prices', async (req, res) => {
  try {
    const { console, duration, price } = req.body;
    if (!console || !duration || !price) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
    const nuevoPrecio = new Price({ console, duration, price });
    await nuevoPrecio.save();
    res.status(201).json({ message: 'Precio añadido correctamente.' });
  } catch (err) {
    console.error('Error al añadir precio:', err);
    res.status(500).json({ message: 'Error al añadir precio.' });
  }
});

// Editar precios (PUT, recibe array de precios a actualizar)
app.put('/prices', async (req, res) => {
  try {
    const precios = req.body;
    if (!Array.isArray(precios) || precios.length === 0) {
      return res.status(400).json({ message: 'No se enviaron precios para actualizar.' });
    }
    for (const precio of precios) {
      if (!precio._id || !precio.console || !precio.duration || !precio.price) continue;
      await Price.findByIdAndUpdate(precio._id, {
        console: precio.console,
        duration: precio.duration,
        price: precio.price
      });
    }
    res.json({ message: 'Precios actualizados correctamente.' });
  } catch (err) {
    console.error('Error al actualizar precios:', err);
    res.status(500).json({ message: 'Error al actualizar precios.' });
  }
});

// Eliminar un precio por _id
app.delete('/prices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Price.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Precio no encontrado.' });
    }
    res.json({ message: 'Precio eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar precio:', err);
    res.status(500).json({ message: 'Error al eliminar precio.' });
  }
});

// Endpoint para recibir y guardar acciones nuevas (sesiones)
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body;
  // Adjuntar empleado desde la sesión del backend si existe
  if (session && session.username && session.role === 'trabajador' && !nuevaAccion.employee) {
    nuevaAccion.employee = session.username;
  }
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  const mongoSession = new Session(nuevaAccion);
  mongoSession.save()
    .then(() => res.json({ ok: true, msg: 'Acción guardada en MongoDB' }))
    .catch(err => {
      console.error('Error al guardar sesión en MongoDB:', err);
      res.status(500).json({ error: 'Error al guardar sesión en MongoDB' });
    });
});

// Endpoint para obtener todas las acciones en JSON
app.get('/acciones', (req, res) => {
  Session.find({})
    .then(sessions => res.json(sessions))
    .catch(err => {
      console.error('Error al leer sesiones desde MongoDB:', err);
      res.status(500).json({ error: 'Error al leer sesiones desde MongoDB' });
    });
});

// Endpoints para persistir "Dinero obtenido" por empleado y por día
// GET /earnings?date=YYYY-MM-DD -> retorna { username, dateISO, amount }
app.get('/earnings', async (req, res) => {
  try {
    if (!session || !session.username) return res.status(401).json({ error: 'No authenticated' });
    const username = session.username;
    const dateISO = req.query.date || null;
    if (!dateISO) {
      // Buscar la entrada más reciente del usuario
      const last = await Earning.findOne({ username }).sort({ dateISO: -1 });
      return res.json(last || { username, dateISO: null, amount: 0 });
    }
    const found = await Earning.findOne({ username, dateISO });
    if (!found) return res.json({ username, dateISO, amount: 0 });
    res.json(found);
  } catch (e) {
    console.error('GET /earnings error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /earnings { dateISO: 'YYYY-MM-DD', amount: 123 }
// Crea o actualiza la entrada para el usuario de la sesión
app.post('/earnings', async (req, res) => {
  try {
    if (!session || !session.username) return res.status(401).json({ error: 'No authenticated' });
    const username = session.username;
    const { dateISO, amount } = req.body || {};
    if (!dateISO || typeof amount === 'undefined') return res.status(400).json({ error: 'Faltan parámetros' });
    const numeric = Number(amount) || 0;
    const updated = await Earning.findOneAndUpdate(
      { username, dateISO },
      { $set: { amount: numeric } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, earning: updated });
  } catch (e) {
    console.error('POST /earnings error:', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Solo debe haber un app.listen al final del archivo
app.listen(PORT, () => {
  console.log(`Servidor Zonagamer escuchando en puerto ${PORT}`);
});
