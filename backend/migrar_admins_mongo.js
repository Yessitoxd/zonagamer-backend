const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://yesseiramartinez_db_user:NuevaPass2025!@cluster0.uuwrtvt.mongodb.net/zonagamer?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String
});
const Admin = mongoose.model('Admin', adminSchema);

const admins = [
  { username: 'Hector', password: '24681012', role: 'admin' },
  { username: 'Larry', password: 'Lavn180524', role: 'admin' }
];

Admin.insertMany(admins)
  .then(() => {
    console.log('Admins migrados a MongoDB correctamente');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error al migrar admins:', err);
    mongoose.disconnect();
  });