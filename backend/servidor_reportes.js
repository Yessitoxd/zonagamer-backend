// Requires y configuraciÃ³n inicial
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const cors = require('cors');
// intentar cargar el helper de exportación (opcional)
// Removed googleReports usage
let localReports;
try {
  localReports = require('./lib/localReports');
} catch (e) {
  localReports = null;
}

// Backend mÃ­nimo para exponer acciones.json como API pÃºblica
const app = express();
// CORS robusto para Netlify y localhost
const allowedOrigins = [
  'https://zonagamersrs.netlify.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
const corsOptions = {
  origin: function (origin, callback) {
    // permitir peticiones sin origin (como curl/postman) o si estÃ¡ en la lista
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
// Manejo universal de preflight sin usar comodÃ­n '*' que rompe en algunas versiones de path-to-regexp
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
const PORT = process.env.PORT || 3001;

// ConfiguraciÃ³n: URL del Apps Script Web App (server-side proxy). Puedes sobreescribir con variable de entorno SHEETS_WEBAPP_URL
// Actualizado al deployment pÃºblico verificado por el usuario (2025-10-17)
const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbzgOJ4E6OfdY-_mtlwi7GENES8ujy06hc46MnKG7n_fo8DzY3XbBiGKO933XKUUzJro/exec';

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

// Modelo para el estado de cada consola (usa mongoose, por eso va despuÃ©s de require)
const consoleStateSchema = new mongoose.Schema({
  consoleNumber: { type: Number, required: true, unique: true },
  state: { type: Object, required: true },
  stateHistory: { type: [mongoose.Schema.Types.Mixed], default: [] }
});
const ConsoleState = mongoose.model('ConsoleState', consoleStateSchema);
// Obtener el estado de una consola por nÃºmero
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

// Guardar o actualizar el estado de una consola por nÃºmero
app.post('/console-state/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const { state } = req.body;
    if (!state) return res.status(400).json({ error: 'Falta el estado' });
    const now = Date.now();
    const snapshot = { ...state, savedAt: Number(state.savedAt) || now };
    const previous = await ConsoleState.findOne({ consoleNumber: Number(number) });
    const history = Array.isArray(previous && previous.stateHistory) ? previous.stateHistory : [];
    const last = history[history.length - 1];
    // Una muestra por minuto basta para el retraso solicitado y limita el tamaño de la colección.
    if (!last || now - Number(last.savedAt || 0) >= 60 * 1000) history.push(snapshot);
    const recentHistory = history.filter(item => Number(item && item.savedAt) >= now - 2 * 60 * 60 * 1000);
    await ConsoleState.findOneAndUpdate(
      { consoleNumber: Number(number) },
      { state: snapshot, stateHistory: recentHistory },
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

// --- Manejo de sesiÃ³n persistente ---
let session = null;
app.get('/session', (req, res) => {
  res.json(session ? { username: session.username, role: session.role } : {});
});
app.post('/session', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password || !role) return res.status(400).json({ ok: false, error: 'Faltan credenciales' });
    if (role === 'trabajador') {
      let emp = await Employee.findOne({ username });
      // La dueña puede usar el panel operativo con la misma cuenta de admin.
      if (!emp && username === 'Yesseira') {
        const ownerAdmin = await Admin.findOne({ username });
        if (ownerAdmin && ownerAdmin.password === password) {
          session = { username: ownerAdmin.username, role: 'dueña' };
          return res.json({ ok: true, session });
        }
      }
      if (!emp || emp.password !== password) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      session = { username: emp.username, role: emp.role || 'trabajador' };
      return res.json({ ok: true, session });
    } else if (role === 'admin') {
      const adm = await Admin.findOne({ username });
      if (!adm || adm.password !== password) return res.status(401).json({ ok: false, error: 'Credenciales invÃ¡lidas' });
      session = { username: adm.username, role: adm.role || 'admin' };
      return res.json({ ok: true, session });
    }
    return res.status(400).json({ ok: false, error: 'Rol invÃ¡lido' });
  } catch (e) {
    console.error('POST /session error:', e);
    res.status(500).json({ ok: false, error: 'Error interno en sesiÃ³n' });
  }
});
app.delete('/session', (req, res) => {
  session = null;
  res.json({ ok: true });
});

// Ruta raÃ­z para comprobar que el backend estÃ¡ vivo
app.get('/', (req, res) => {
  res.send('API Zonagamer Backend funcionando');
});

// Health check simple para monitoreo (uptime y estado de mongoose)
app.get('/health', async (req, res) => {
  try {
    const uptime = process.uptime();
    const mongooseState = mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
    // opcional: intentar un ping sencillo a Mongo si estÃ¡ conectado
    let mongoPing = null;
    if (mongooseState === 1) {
      try {
        // usar comando admin ping si estÃ¡ disponible
        const admin = mongoose.connection.db.admin();
        await admin.ping();
        mongoPing = true;
      } catch (e) {
        mongoPing = false;
      }
    }
    res.json({ ok: true, uptime, mongooseState, mongoPing });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// ConexiÃ³n a MongoDB Atlas
console.log("Valor de process.env.Zonagamer:", process.env.Zonagamer);
console.log("Valor de process.env.MONGODB_URI:", process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch(err => console.error('Error de conexiÃ³n:', err));

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
  comment: String,
  // Optional override price info when owner sets a temporary price for a session
  overridePrice: { type: Number, default: null },
  override: { type: Boolean, default: false }
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

// Añadir empleado
app.post('/employees', async (req, res) => {
  try {
    const { username, password, role, dailyPay } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos requeridos.' });
    const nuevo = new Employee({ username, password, role, dailyPay });
    await nuevo.save();
    res.status(201).json({ message: 'Empleado añadido correctamente.' });
  } catch (err) {
    console.error('Error al añadir empleado:', err);
    res.status(500).json({ error: 'Error al añadir empleado.' });
  }
});

// Eliminar empleado
app.delete('/employees/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const deleted = await Employee.findOneAndDelete({ username });
    if (!deleted) return res.status(404).json({ message: 'Empleado no encontrado.' });
    res.json({ message: 'Empleado eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar empleado:', err);
    res.status(500).json({ error: 'Error al eliminar empleado.' });
  }
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
  price: { type: Number, required: true },
  label: { type: String, default: '' }
});
const Price = mongoose.model('Price', priceSchema);
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  imageUrl: { type: String, default: '' },
  category: { type: String, default: 'bebida' }
});
const Product = mongoose.model('Product', productSchema);
const productSaleSchema = new mongoose.Schema({
  employee: { type: String, default: '' },
  productId: { type: String, default: '' },
  productName: { type: String, required: true },
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  price: { type: Number, required: true },
  createdAt: { type: String, required: true }
});
const ProductSale = mongoose.model('ProductSale', productSaleSchema);
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

// Proxy endpoint: recibe el payload del frontend y lo reenvÃ­a al Apps Script Web App
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

// Endpoint server-side usando Service Account para exportar XLSX
app.post('/generate-report-sa', async (req, res) => {
  if (!localReports || !localReports.exportReportFromTemplate) {
    return res.status(500).json({ error: 'Server-side local exporter not available' });
  }
  try {
    const { rows, sheetName, summary, productRows } = req.body || {};
    const result = await localReports.exportReportFromTemplate(rows, { sheetName, summary, productRows });
    let buf;
    let filename = 'reporte.xlsx';
    if (result && result.buffer) {
      buf = result.buffer;
      filename = result.filename || filename;
    } else {
      buf = result;
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/\"/g, '')}"`);
    return res.send(buf);
  } catch (err) {
    console.error('Local export failed:', err);
    return res.status(500).json({ error: 'Local export failed', detail: err.message || String(err) });
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
    // Validar que no exista otra consola con ese nÃºmero
    const existe = await Console.findOne({ number, _id: { $ne: id } });
    if (existe) {
      return res.status(400).json({ message: 'Ya existe una consola con ese nÃºmero.' });
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

// Añadir admin
app.post('/admins', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos requeridos.' });
    const nuevo = new Admin({ username, password, role });
    await nuevo.save();
    res.status(201).json({ message: 'Admin añadido correctamente.' });
  } catch (err) {
    console.error('Error al añadir admin:', err);
    res.status(500).json({ error: 'Error al añadir admin.' });
  }
});

// Eliminar admin
app.delete('/admins/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const deleted = await Admin.findOneAndDelete({ username });
    if (!deleted) return res.status(404).json({ message: 'Admin no encontrado.' });
    res.json({ message: 'Admin eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar admin:', err);
    res.status(500).json({ error: 'Error al eliminar admin.' });
  }
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
// Monitoreo con retraso de 5 minutos: /monitoreo?consoleType=ps5&consoleNumber=1
app.get('/sessions', async (req, res) => {
  try {
    const { consoleType, consoleNumber, date, start, end } = req.query;
    const andFilter = [];
    if (consoleType) andFilter.push({ consoleType });
    if (consoleNumber) andFilter.push({ consoleNumber: Number(consoleNumber) });

    if (start && end) {
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

// Elimina exclusivamente las sesiones del día actual en Managua; no acepta fechas externas.
app.delete('/sessions/today', async (req, res) => {
  try {
    if (!session || !['dueña', 'admin'].includes(session.role)) {
      return res.status(403).json({ error: 'No autorizado para borrar sesiones.' });
    }
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'America/Managua' }).split(' ')[0];
    const result = await Session.deleteMany({ startDate: { $regex: `^${today}` } });
    res.json({ ok: true, deletedCount: result.deletedCount || 0, date: today });
  } catch (err) {
    console.error('Error al borrar sesiones de hoy:', err);
    res.status(500).json({ error: 'Error al borrar sesiones de hoy.' });
  }
});
// Limpieza operativa: elimina exclusivamente los datos del día actual en Managua.
app.delete('/maintenance/today', async (req, res) => {
  try {
    if (!session || !['dueña', 'admin'].includes(session.role)) {
      return res.status(403).json({ error: 'No autorizado para limpiar datos.' });
    }
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'America/Managua' }).split(' ')[0];
    const [sessions, earnings, productSales] = await Promise.all([
      Session.deleteMany({ startDate: { $regex: `^${today}` } }),
      Earning.deleteMany({ dateISO: today }),
      ProductSale.deleteMany({ createdAt: { $regex: `^${today}` } })
    ]);
    res.json({ ok: true, date: today, deleted: {
      sessions: sessions.deletedCount || 0,
      earnings: earnings.deletedCount || 0,
      productSales: productSales.deletedCount || 0
    }});
  } catch (err) {
    console.error('Error al limpiar datos de hoy:', err);
    res.status(500).json({ error: 'Error al limpiar los datos de hoy.' });
  }
});
// Endpoint de monitoreo con retraso de 5 minutos
app.get('/monitoreo', async (req, res) => {
  try {
    const { consoleType, consoleNumber } = req.query;
    const andFilter = [];
    if (consoleType) andFilter.push({ consoleType });
    if (consoleNumber) andFilter.push({ consoleNumber: Number(consoleNumber) });
    const consoleFilter = {};
    if (consoleType) consoleFilter.type = consoleType;
    if (consoleNumber) consoleFilter.number = Number(consoleNumber);
    const [consoles, states] = await Promise.all([
      Console.find(consoleFilter).sort({ number: 1 }),
      ConsoleState.find(consoleNumber ? { consoleNumber: Number(consoleNumber) } : {})
    ]);
    const cutoff = Date.now() - 5 * 60 * 1000;
    const statesByNumber = new Map(states.map(item => [item.consoleNumber, item]));
    res.json(consoles.map(consoleItem => {
      const stored = statesByNumber.get(consoleItem.number);
      const history = Array.isArray(stored && stored.stateHistory) ? stored.stateHistory : [];
      const delayed = history.filter(item => Number(item && item.savedAt) <= cutoff).pop();
      return { consoleType: consoleItem.type, consoleNumber: consoleItem.number, consoleName: consoleItem.name, delayedAt: delayed ? delayed.savedAt : null, state: delayed || null };
    }));
  } catch (err) {
    console.error('Error en monitoreo:', err);
    res.status(500).json({ error: 'Error en monitoreo' });
  }
});
// Endpoint para añadir una consola (POST)
app.post('/consoles', async (req, res) => {
  try {
    const { type, number } = req.body || {};
    if (!type || typeof number === 'undefined') {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
    // Validar que no exista otra consola con ese número
    const existe = await Console.findOne({ number });
    if (existe) return res.status(400).json({ message: 'Ya existe una consola con ese número.' });
    const name = type === 'ps5' ? 'Play Station 5' : (type === 'switch' ? 'Nintendo Switch' : type);
    const img = type === 'ps5' ? 'PS5.png' : (type === 'switch' ? 'Switch.png' : '');
    const nueva = new Console({ type, number, name, img });
    await nueva.save();
    res.status(201).json({ message: 'Consola añadida correctamente.' });
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
    const { console, duration, price, label } = req.body;
    const parsedDuration = Number(duration);
    const parsedPrice = Number(price);
    if (!console || isNaN(parsedDuration) || parsedDuration < 1 || isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
    const nuevoPrecio = new Price({
      console,
      duration: parsedDuration,
      price: parsedPrice,
      label: (label || '').toString().trim()
    });
    await nuevoPrecio.save();
    res.status(201).json({ message: 'Precio aÃ±adido correctamente.' });
  } catch (err) {
    console.error('Error al aÃ±adir precio:', err);
    res.status(500).json({ message: 'Error al aÃ±adir precio.' });
  }
});

// Editar precios (PUT, recibe array de precios a actualizar)
app.put('/prices', async (req, res) => {
  try {
    // Solo Yesseira puede editar precios libremente
    if (!session || session.username !== 'Yesseira' || (session.role !== 'dueña' && session.role !== 'admin')) {
      return res.status(403).json({ message: 'No autorizado. Solo Yesseira puede editar precios.' });
    }
    const precios = req.body;
    if (!Array.isArray(precios) || precios.length === 0) {
      return res.status(400).json({ message: 'No se enviaron precios para actualizar.' });
    }
    let updatedCount = 0;
    for (const precio of precios) {
      const parsedDuration = Number(precio.duration);
      const parsedPrice = Number(precio.price);
      if (!precio._id || !precio.console || isNaN(parsedDuration) || parsedDuration < 1 || isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: 'Datos de precio inválidos.' });
      }
      const updated = await Price.findByIdAndUpdate(precio._id, {
        console: precio.console,
        duration: parsedDuration,
        price: parsedPrice,
        label: (precio.label || '').toString().trim()
      }, { new: true });
      if (!updated) return res.status(404).json({ message: 'No se encontró el precio a editar.' });
      updatedCount++;
    }
    res.json({ message: 'Precios actualizados correctamente.', updatedCount });
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

// Productos de bebidas/snacks
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    console.error('Error al leer productos:', err);
    res.status(500).json({ error: 'Error al leer productos' });
  }
});

app.post('/products', async (req, res) => {
  try {
    const { name, description, price, imageUrl, category } = req.body || {};
    const parsedPrice = Number(price);
    if (!name || !description || isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Datos inválidos para producto' });
    }
    const created = await Product.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: parsedPrice,
      imageUrl: String(imageUrl || '').trim(),
      category: String(category || 'bebida').trim() || 'bebida'
    });
    res.status(201).json({ ok: true, product: created });
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

app.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, category } = req.body || {};
    const parsedPrice = Number(price);
    if (!name || !description || isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Datos inválidos para producto' });
    }
    const updated = await Product.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        description: String(description).trim(),
        price: parsedPrice,
        imageUrl: String(imageUrl || '').trim(),
        category: String(category || 'bebida').trim() || 'bebida'
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true, product: updated });
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// Endpoint para recibir y guardar acciones nuevas (sesiones)
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body || {};
  // Adjuntar empleado desde la sesión del backend si existe
  if (session && session.username && session.role === 'trabajador' && !nuevaAccion.employee) {
    nuevaAccion.employee = session.username;
  }
  // Si el frontend incluyó overridePrice, marcar override=true
  if (typeof nuevaAccion.overridePrice !== 'undefined' && nuevaAccion.overridePrice !== null) {
    const parsedOverride = Number(nuevaAccion.overridePrice);
    if (!isNaN(parsedOverride)) {
      nuevaAccion.overridePrice = parsedOverride;
      nuevaAccion.override = true;
    } else {
      nuevaAccion.overridePrice = null;
      nuevaAccion.override = false;
    }
  }
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }

  nuevaAccion.consoleNumber = Number(nuevaAccion.consoleNumber) || 0;
  nuevaAccion.totalPrice = Number(nuevaAccion.totalPrice ?? nuevaAccion.total ?? 0) || 0;
  nuevaAccion.durationSeconds = Number(nuevaAccion.durationSeconds ?? nuevaAccion.duration ?? 0) || 0;

  // Si mongoose está conectado, guardar en MongoDB; si no, usar fallback a datos.json (útil para pruebas locales)
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const mongoSession = new Session(nuevaAccion);
    mongoSession.save()
      .then(() => res.json({ ok: true, msg: 'Acción guardada en MongoDB' }))
      .catch(err => {
        console.error('Error al guardar sesión en MongoDB:', err);
        res.status(500).json({ error: 'Error al guardar sesión en MongoDB' });
      });
  } else {
    try {
      const datos = leerDatos();
      if (!Array.isArray(datos.sessions)) datos.sessions = [];
      datos.sessions.push(nuevaAccion);
      guardarDatos(datos);
      return res.json({ ok: true, msg: 'Acción guardada en datos locales (fallback)' });
    } catch (e) {
      console.error('Error al guardar sesión en datos locales:', e);
      return res.status(500).json({ error: 'Error guardando sesión en fallback local' });
    }
  }
});

// Endpoint para obtener todas las acciones en JSON
app.get('/acciones', async (req, res) => {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const sessions = await Session.find({});
      return res.json(sessions);
    }
    // Fallback local
    const datos = leerDatos();
    return res.json(datos.sessions || []);
  } catch (err) {
    console.error('Error al leer sesiones:', err);
    res.status(500).json({ error: 'Error al leer sesiones' });
  }
});

// Ventas de productos (bebidas, snacks, etc.)
app.post('/product-sales', async (req, res) => {
  try {
    const body = req.body || {};
    const quantity = Number(body.quantity || 1);
    const unitPrice = Number(typeof body.unitPrice !== 'undefined' ? body.unitPrice : body.price);
    if (!body.productName || !body.description || isNaN(quantity) || quantity < 1 || !Number.isFinite(quantity) || isNaN(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: 'Venta inválida' });
    }
    const finalQuantity = Math.floor(quantity);
    const totalPrice = Number((unitPrice * finalQuantity).toFixed(2));
    const baseDescription = String(body.description).trim();
    const finalDescription = finalQuantity > 1 ? `${finalQuantity} x ${baseDescription}` : baseDescription;
    const employeeFromSession = session && session.username ? session.username : '';
    const createdAt = body.createdAt || new Date().toISOString();
    const sale = await ProductSale.create({
      employee: body.employee || employeeFromSession || '',
      productId: body.productId || '',
      productName: String(body.productName).trim(),
      description: finalDescription,
      quantity: finalQuantity,
      unitPrice: Number(unitPrice.toFixed(2)),
      price: totalPrice,
      createdAt: String(createdAt)
    });
    res.status(201).json({ ok: true, sale });
  } catch (err) {
    console.error('Error al guardar venta de producto:', err);
    res.status(500).json({ error: 'Error al guardar venta de producto' });
  }
});

app.get('/product-sales', async (req, res) => {
  try {
    const { start, end } = req.query || {};
    const filter = {};
    if (start || end) {
      const from = start ? new Date(`${start}T00:00:00.000-06:00`) : null;
      const to = end ? new Date(`${end}T23:59:59.999-06:00`) : null;
      if (from || to) {
        filter.createdAt = {};
        if (from && !isNaN(from.getTime())) filter.createdAt.$gte = from.toISOString();
        if (to && !isNaN(to.getTime())) filter.createdAt.$lte = to.toISOString();
      }
    }
    const sales = await ProductSale.find(filter).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    console.error('Error al leer ventas de producto:', err);
    res.status(500).json({ error: 'Error al leer ventas de producto' });
  }
});

// Endpoints para persistir "Dinero obtenido" por empleado y por dÃ­a
// GET /earnings?date=YYYY-MM-DD -> retorna { username, dateISO, amount }
app.get('/earnings', async (req, res) => {
  try {
    if (!session || !session.username) return res.status(401).json({ error: 'No authenticated' });
    const username = session.username;
    const dateISO = req.query.date || null;
    if (!dateISO) {
      // Buscar la entrada mÃ¡s reciente del usuario
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
// Crea o actualiza la entrada para el usuario de la sesiÃ³n
app.post('/earnings', async (req, res) => {
  try {
    if (!session || !session.username) return res.status(401).json({ error: 'No authenticated' });
    const username = session.username;
    const { dateISO, amount } = req.body || {};
    if (!dateISO || typeof amount === 'undefined') return res.status(400).json({ error: 'Faltan parÃ¡metros' });
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
// Global error handler to ensure CORS headers and JSON on unexpected errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  try {
    const origin = req.headers && req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins && allowedOrigins.length) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  } catch (e) {
    console.error('Error setting CORS headers in error handler:', e);
  }
  const status = (err && err.status) ? err.status : 500;
  res.status(status).json({ error: (err && err.message) ? err.message : 'Internal Server Error' });
});

// Catch unhandled rejections and uncaught exceptions to aid debugging (will not exit the process here)
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err && err.stack ? err.stack : err);
});

app.listen(PORT, () => {
  console.log(`Servidor Zonagamer escuchando en puerto ${PORT}`);
});
