const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://yesseiramartinez_db_user:24681012@cluster0.uuwrtvt.mongodb.net/zonagamer?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const employeeSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  dailyPay: Number
});
const Employee = mongoose.model('Employee', employeeSchema);

const employees = [
  { username: 'Marvin', password: 'zonagamer', role: 'trabajador', dailyPay: 200 }
];

Employee.insertMany(employees)
  .then(() => {
    console.log('Empleados migrados a MongoDB correctamente');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error al migrar empleados:', err);
    mongoose.disconnect();
  });