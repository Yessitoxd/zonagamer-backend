// Ruta raíz para comprobar que el backend está vivo
app.get('/', (req, res) => {
  res.send('API Zonagamer Backend funcionando');
});
// Backend mínimo para exponer acciones.json como API pública
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Endpoint para recibir y guardar acciones nuevas
// Solo acepta el POST pero no guarda nada (para pruebas en Render)
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body;
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  // No guardar en archivo, solo responder ok
  res.json({ ok: true, msg: 'Acción recibida (no guardada en Render)' });
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
