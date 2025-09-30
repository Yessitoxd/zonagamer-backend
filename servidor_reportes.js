// Backend mínimo para exponer acciones.json como API pública
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Endpoint para recibir y guardar acciones nuevas
app.post('/accion', (req, res) => {
  const nuevaAccion = req.body;
  if (!nuevaAccion || !nuevaAccion.startDate) {
    return res.status(400).json({ error: 'Acción inválida' });
  }
  let acciones = [];
  try {
    acciones = require('./acciones.json');
  } catch (e) {}
  acciones.push(nuevaAccion);
  fs.writeFileSync('./acciones.json', JSON.stringify(acciones, null, 2));
  res.json({ ok: true });
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
