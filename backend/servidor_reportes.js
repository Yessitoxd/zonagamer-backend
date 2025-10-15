const mongoose = require('mongoose');
// Backend mínimo para exponer acciones.json como API pública
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: 'https://zonagamersrs.netlify.app',
  credentials: true
}));
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
// Conexión a MongoDB Atlas
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
function leerDatos() {
  try {
    const datos = JSON.parse(fs.readFileSync(__dirname + '/datos.json', 'utf8'));
    // Asegurar que session exista
    if (typeof datos.session === 'undefined') datos.session = null;
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
    res.status(201).json({ message: 'Consola añadida correctamente.' });
  } catch (err) {
    console.error('Error al añadir consola:', err);
    res.status(500).json({ message: 'Error al añadir consola.' });
  }
});
app.put('/consoles', (req, res) => {
  // Actualizar todas las consolas (sobrescribe)
  Console.deleteMany({})
    .then(() => Console.insertMany(req.body))
    .then(() => res.json({ ok: true }))
    .catch(err => {
      console.error('Error al guardar consolas en MongoDB:', err);
      res.status(500).json({ error: 'Error al guardar consolas en MongoDB' });
    });
});

app.get('/prices', (req, res) => {
  Price.find({})
    .then(prices => res.json(prices))
    .catch(err => {
      console.error('Error al leer precios desde MongoDB:', err);
      res.status(500).json({ error: 'Error al leer precios desde MongoDB' });
    });
});
app.put('/prices', (req, res) => {
  // Actualizar todos los precios (sobrescribe)
  Price.deleteMany({})
    .then(() => Price.insertMany(req.body))
    .then(() => res.json({ ok: true }))
    .catch(err => {
      console.error('Error al guardar precios en MongoDB:', err);
      res.status(500).json({ error: 'Error al guardar precios en MongoDB' });
    });
});

// Endpoint para recibir y guardar acciones nuevas (sesiones)
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body;
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  const session = new Session(nuevaAccion);
  session.save()
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

// Solo debe haber un app.listen al final del archivo
app.listen(PORT, () => {
  console.log(`Servidor Zonagamer escuchando en puerto ${PORT}`);
});
